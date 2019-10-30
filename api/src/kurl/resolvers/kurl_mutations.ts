import fs from "fs";
import * as _ from "lodash";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { ReplicatedError } from "../../server/errors";
import { Context } from "../../context";
import {
  KubeConfig,
  AppsV1Api,
  CoreV1Api,
  V1beta1Eviction,
  V1Node,
  V1OwnerReference,
  V1Pod } from "@kubernetes/client-node";
import { logger } from "../../server/logger";
import { IncomingMessage } from "http";
import { Etcd3 } from "etcd3";
import * as yaml from "js-yaml";

export function KurlMutations(stores: Stores, params: Params) {
  return {
    async drainNode(root: any, { name }, context: Context) {
      context.requireSingleTenantSession();

      await drain(name);

      return false;
    },

    async deleteNode(root: any, { name }, context: Context) {
      context.requireSingleTenantSession();

      await purge(name);

      return false;
    }
  }
}

export interface drainResult {
  waitAndRetry: boolean;
  misconfiguredPolicyDisruptionBudget: boolean;
}

async function drain(name: string) {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  const coreV1Client: CoreV1Api = kc.makeApiClient(CoreV1Api);

  // cordon the node
  let { response, body: node } = await coreV1Client.readNode(name);

  if (response.statusCode !== 200) {
    throw new ReplicatedError("Node not found");
  }

  if (!node.spec) {
    throw new ReplicatedError("Node spec not found");
  }

  node.spec.unschedulable = true;

  ({ response, body: node } = await coreV1Client.replaceNode(name, node));

  if (response.statusCode !== 200) {
    throw new ReplicatedError(`Cordon node: ${response.statusCode}`);
  }

  // list and evict pods
  let waitAndRetry = false;
  let misconfiguredPolicyDisruptionBudget = false;
  const labelSelectors = [
    // Defer draining self and pods that provide cluster services to other pods
    "app notin (rook-ceph-mon,rook-ceph-osd,rook-ceph-operator,kotsadm-api),k8s-app!=kube-dns",
    // Drain Rook pods
    "app in (rook-ceph-mon,rook-ceph-osd,rook-ceph-operator)",
    // Drain dns pod
    "k8s-app=kube-dns",
    // Drain self
    "app=kotsadm-api",
  ];
  for (let i = 0; i < labelSelectors.length; i++) {
    const labelSelector = labelSelectors[i];
    const fieldSelector = `spec.nodeName=${name}`;
    const { response, body: pods } = await coreV1Client.listPodForAllNamespaces(undefined, undefined, fieldSelector, labelSelector);

    if (response.statusCode !== 200) {
      throw new Error(`List pods response status: ${response.statusCode}`);
    }

    logger.debug(`Found ${pods.items.length} pods matching labelSelector ${labelSelector}`);
    for (let j = 0; j < pods.items.length; j++) {
      const pod = pods.items[j];

      if (shouldDrain(pod)) {
        const result = await evict(coreV1Client, pod);

        waitAndRetry = waitAndRetry || result.waitAndRetry;
        misconfiguredPolicyDisruptionBudget = misconfiguredPolicyDisruptionBudget || result.misconfiguredPolicyDisruptionBudget;
      }
    }
  }

  return { waitAndRetry, misconfiguredPolicyDisruptionBudget };
}

async function evict(coreV1Client: CoreV1Api, pod: V1Pod): Promise<drainResult> {
  const name = _.get(pod, "metadata.name", "");
  const namespace = _.get(pod, "metadata.namespace", "");
  const eviction: V1beta1Eviction = {
    apiVersion: "policy/v1beta1",
    kind: "Eviction",
    metadata: {
      name,
      namespace,
    },
  };

  logger.info(`Evicting pod ${name} in namespace ${namespace} from node ${_.get(pod, "spec.nodeName")}`);

  const result = { waitAndRetry: false, misconfiguredPolicyDisruptionBudget: false };

  const { response } = await coreV1Client.createNamespacedPodEviction(name, namespace, eviction);
  switch (response.statusCode) {
  case 200: // fallthrough
  case 201:
    return result;
  case 429:
    logger.warn(`Failed to delete pod ${name}: 429: PodDisruptionBudget is preventing deletion`);
    result.waitAndRetry = true;
    return result;
  case 500:
    // Misconfigured, e.g. included in multiple budgets
    logger.error(`Failed to evict pod ${name}: 500: possible PodDisruptionBudget misconfiguration`);
    result.misconfiguredPolicyDisruptionBudget = true;
    return result;
  default:
    throw new Error(`Unexpected response code ${response.statusCode}`);
  }
}

function shouldDrain(pod: V1Pod): boolean {
  // completed pods always ok to drain
  if (isFinished(pod)) {
    return true;
  }

  if (isMirror(pod)) {
    logger.info(`Skipping drain of mirror pod ${_.get(pod, "metadata.name")} in namespace ${_.get(pod, "metadata.namespace")}`);
    return false;
  }
  // TODO if orphaned it's ok to delete the pod
  if (isDaemonSetPod(pod)) {
    logger.info(`Skipping drain of DaemonSet pod ${_.get(pod, "metadata.name")} in namespace ${_.get(pod, "metadata.namespace")}`);
    return false;
  }

  return true;
}

function isFinished(pod: V1Pod): boolean {
  const phase = _.get(pod, "status.phase");
  // https://github.com/kubernetes/api/blob/5524a3672fbb1d8e9528811576c859dbedffeed7/core/v1/types.go#L2414
  const succeeded = "Succeeded";
  const failed = "Failed";

  return phase === succeeded || phase === failed;
}

function isMirror(pod: V1Pod): boolean {
  const mirrorAnnotation = "kubernetes.io/config.mirror";
  const annotations = pod.metadata && pod.metadata.annotations;

  return annotations ? _.has(annotations, mirrorAnnotation) : false;
}

function isDaemonSetPod(pod: V1Pod): boolean {
  return _.some(_.get(pod, "metadata.ownerReferences", []), (ownerRef: V1OwnerReference) => {
    return ownerRef.controller && ownerRef.kind === "DaemonSet";
  });
}

async function purge(name: string) {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  const coreV1Client: CoreV1Api = kc.makeApiClient(CoreV1Api);
  const appsV1Client: AppsV1Api = kc.makeApiClient(AppsV1Api);

  let { response, body: node } = await coreV1Client.readNode(name);

  if (response.statusCode !== 200) {
    throw new ReplicatedError(`get node ${name} response: ${response.statusCode}`);
  }

  ({ response } = await coreV1Client.deleteNode(name));

  if (response.statusCode !== 204) {
    throw new Error(`Delete node returned status code ${response.statusCode}`);
  }

  await purgeOSD(coreV1Client, appsV1Client, name);

  const isMaster = node.metadata!.labels && node.metadata!.labels!["node-role.kubernetes.io/master"];
  if (isMaster) {
    await purgeMaster(coreV1Client, node);
  }
}

async function purgeMaster(coreV1Client: CoreV1Api, node: V1Node) {
  const remainingMasterIPs: Array<string> = [];
  let purgedMasterIP = "";

  // 1. Remove the purged endpoint from kubeadm's list of API endpoints in the kubeadm-config 
  // ConfigMap in the kube-system  namespace. Keep the list of all master IPs for step 2.
  const configMapName = "kubeadm-config";
  const configMapNS = "kube-system";
  const configMapKey = "ClusterStatus";
  const { response: cmResponse, body: kubeadmCM } = await coreV1Client.readNamespacedConfigMap(configMapName, configMapNS);
  if (cmResponse.statusCode !== 200) {
    throw new Error(`Get kubeadm-config map from kube-system namespace: ${cmResponse.statusCode}`);
  }

  const clusterStatus = yaml.safeLoad(kubeadmCM.data![configMapKey]);
  _.each(clusterStatus.apiEndpoints, (obj, nodeName) => {
    if (nodeName === node.metadata!.name) {
      purgedMasterIP = obj.advertiseAddress;
    } else {
      remainingMasterIPs.push(obj.advertiseAddress);
    }
  });
  delete(clusterStatus.apiEndpoints[node.metadata!.name!]);
  kubeadmCM.data![configMapKey] = yaml.safeDump(clusterStatus);
  await coreV1Client.replaceNamespacedConfigMap(configMapName, configMapNS, kubeadmCM);

  // 2. Use the credentials from the mounted etcd client cert secret to connect to the remaining
  // etcd members and tell them to forget the purged member.
  const etcd = new Etcd3({
    credentials: {
      rootCertificate: fs.readFileSync("/etc/kubernetes/pki/etcd/tls.crt"),
      privateKey: fs.readFileSync("/etc/kubernetes/pki/etcd/tls.key"),
    },
    hosts: _.map(remainingMasterIPs, (ip) => `https://${ip}:2379`),
  });
  const peerURL = `https://${purgedMasterIP}:2380`;
}

async function purgeOSD(coreV1Client: CoreV1Api, appsV1Client: AppsV1Api, nodeName: string) {
  const namespace = "rook-ceph";
  // 1. Find the Deployment for the OSD on the purged node and lookup its osd ID from labels
  // before deleting it.
  const osdLabelSelector = "app=rook-ceph-osd";
  let { response, body: deployments } = await appsV1Client.listNamespacedDeployment(namespace, undefined, undefined, undefined, undefined, osdLabelSelector);

  if (response.statusCode !== 200) {
    throw new Error(`List osd deployments in rook-ceph namespace returned status code ${response.statusCode}`);
  }

  let osdID = "";

  for (let i = 0; i < deployments.items.length; i++) {
    const deploy = deployments.items[0];
    const nodeSelectors = deploy.spec!.template!.spec!.nodeSelector;
    const hostname = nodeSelectors ? nodeSelectors["kubernetes.io/hostname"] : "";

    if (hostname === nodeName) {
      osdID = deploy.metadata!.labels!["ceph-osd-id"];
      ({ response } = await appsV1Client.deleteNamespacedDeployment(deploy.metadata!.name!, namespace, undefined, undefined, undefined, undefined, "Background"));
      if (response.statusCode !== 200) {
        throw new Error(`Got response status code ${response.statusCode}`);
      }
      break;
    }
  }

  // 2. Using the osd ID discovered in step 1, exec into the Rook operator pod and run the ceph
  // command to purge the OSD
	const operatorLabelSelector = "app=rook-ceph-operator";
  let { response: resp, body: pods } = await coreV1Client.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, operatorLabelSelector);

  if (resp.statusCode !== 200) {
    throw new Error(`List operator pod in rook-ceph namespace returned status code ${resp.statusCode}`);
  }

  if (pods.items.length !== 1) {
    logger.warn(`Found ${pods.items.length} rook operator pods: skipping osd purge command`);
    return;
  }
  const pod = pods.items[0];
  ({ response: resp } = await coreV1Client.connectPostNamespacedPodExec(pod.metadata!.name!, namespace, `ceph osd purge ${osdID}`));

  if (resp.statusCode !== 200) {
    const output = await readAll(resp);
    throw new Error(`Failed to exec "ceph osd purge": ${output}`);
  }
}

function readAll(stream: IncomingMessage): Promise<string> {
  const chunks: Array<any> = [];

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
