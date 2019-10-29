import * as _ from "lodash";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { ReplicatedError } from "../../server/errors";
import { Context } from "../../context";
import {
  KubeConfig,
  CoreV1Api,
  PolicyV1beta1Api,
  V1beta1Eviction,
  V1OwnerReference,
  V1Pod } from "@kubernetes/client-node";
import { logger } from "../../server/logger";

const waitAndRetryErr = new Error("Wait and retry: PolicyDisruptionBudget may be temporarily blocking deletion");
const misconfiguredPolicyDisruptionBudgetErr = new Error("Eviction not possible: pod may have misconfigured PolicyDisruptionBudget");

export function KurlMutations(stores: Stores, params: Params) {
  return {
    async drainNode(root: any, { name }, context: Context) {
      context.requireSingleTenantSession();

      await drain(name);

      return false;
    },

    async deleteNode(root: any, { name }, context: Context) {
      context.requireSingleTenantSession();

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
  const policyV1beta1Client: PolicyV1beta1Api = kc.makeApiClient(PolicyV1beta1Api);

  // 1. cordon the node
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

  // 2. Don't evict self yet
  const labelSelector = `app!=kotsadm-api`;
  const fieldSelector = `spec.nodeName=${name}`;
  let pods;
  ({ response, body: pods } = await coreV1Client.listPodForAllNamespaces(undefined, undefined, fieldSelector, labelSelector));

  let waitAndRetry = false;
  let misconfiguredPolicyDisruptionBudget = false;

  for (let i = 0; i < pods.items; i++) {
    const pod = pods.items[i];

    if (shouldDrain(pod)) {
      const result = await evict(coreV1Client, pod);

      waitAndRetry = waitAndRetry || result.waitAndRetry;
      misconfiguredPolicyDisruptionBudget = misconfiguredPolicyDisruptionBudget || result.misconfiguredPolicyDisruptionBudget;
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
  case 200:
    return result;
  case 429:
    // Can't be deleted right now. Should try again.
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
