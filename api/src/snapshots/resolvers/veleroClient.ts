import crypto from "crypto";
import zlib from "zlib";
import { parse } from "logfmt";
import * as _ from "lodash";
import {
  CoreV1Api,
  KubeConfig,
  V1Secret,
} from "@kubernetes/client-node";
import { ReplicatedError } from "../../server/errors";
import request, { RequestPromiseOptions } from "request-promise";
import {
  kotsAppSlugKey,
  kotsAppSequenceKey,
  snapshotTriggerKey,
  snapshotVolumeCountKey,
  snapshotVolumeSuccessCountKey,
  snapshotVolumeBytesKey,
  Snapshot,
  SnapshotDetail,
  SnapshotError,
  SnapshotHook,
  SnapshotHookPhase,
  SnapshotTrigger,
  SnapshotVolume } from "../snapshot";
import {
  SnapshotProvider,
  SnapshotStore,
  SnapshotStoreAzure,
  SnapshotStoreS3AWS,
  SnapshotStoreGoogle } from "../";
import { Backup, Phase } from "../velero";
import { sleep } from "../../util/utilities";
import { parseBackupLogs, ParsedBackupLogs } from "./parseBackupLogs";
import { AzureCloudName } from "../snapshot_config";
import { base64Decode } from '../../util/utilities';

export const backupStorageLocationName = "kotsadm-velero-backend";
const awsSecretName = "aws-credentials";
const googleSecretName = "google-credentials";
const azureSecretName = "azure-credentials";
const redacted = "--- REDACTED ---";

interface VolumeSummary {
  count: number,
  success: number,
  bytes: number,
}

export class VeleroClient {
  private readonly kc: KubeConfig;
  private readonly server: string;

  constructor(
    private readonly ns: string,
  ) {
    this.kc = new KubeConfig();
    this.kc.loadFromDefault();

    const cluster = this.kc.getCurrentCluster();
    if (!cluster) {
      throw new Error("No cluster available from kubeconfig");
    }
    this.server = cluster.server;
  }

  async request(method: string, path: string, body?: any): Promise<any> {
    let url = `${this.server}/apis/velero.io/v1/namespaces/${this.ns}/${path}`;
    const req = { url };
    await this.kc.applyToRequest(req);
    const options: RequestPromiseOptions = {
      method,
      body,
      simple: false,
      resolveWithFullResponse: true,
      json: true,
    };
    Object.assign(options, req);

    const response = await request(url, options);
    switch (response.statusCode) {
    case 200: // fallthrough
    case 201: // fallthrough
    case 204:
      return response.body
    case 400:
      console.log(response.body);
      break
    case 403:
      throw new ReplicatedError(`RBAC misconfigured for ${method} velero.io/v1 ${path} in namespace ${this.ns}`);
    case 404:
      throw new ReplicatedError("Velero is not installed in this cluster");
    case 422:
      console.log(response.body);
      break
    }

    throw new Error(`${method} ${url}: ${response.statusCode}`);
  }

  async listSnapshots(): Promise<Array<Snapshot>> {
    const body = await this.request("GET", "backups");
    const snapshots: Array<Snapshot> = [];

    for (let backup of body.items) {
      const snapshot = await this.snapshotFromBackup(backup);
      snapshots.push(snapshot);
    }

    return snapshots;
  }

  async snapshotFromBackup(backup: Backup): Promise<Snapshot> {
    let trigger: SnapshotTrigger|undefined = undefined;

    switch (backup.metadata.annotations && backup.metadata.annotations[snapshotTriggerKey]) {
    case SnapshotTrigger.Manual:
      trigger = SnapshotTrigger.Manual;
      break;
    case SnapshotTrigger.PreUpgrade:
      trigger = SnapshotTrigger.PreUpgrade;
      break;
    case SnapshotTrigger.Schedule:
      trigger = SnapshotTrigger.Schedule;
      break;
    }

    const status = backup.status ? backup.status.phase : Phase.New;

    let volumeCount = maybeParseInt(backup.metadata.annotations && backup.metadata.annotations[snapshotVolumeCountKey]);
    let volumeSuccessCount = maybeParseInt(backup.metadata.annotations && backup.metadata.annotations[snapshotVolumeSuccessCountKey]);
    let volumeBytes = maybeParseInt(backup.metadata.annotations && backup.metadata.annotations[snapshotVolumeBytesKey]);

    if (_.isUndefined(volumeCount) || _.isUndefined(volumeSuccessCount) || _.isUndefined(volumeBytes)) {
      const { count, success, bytes } = await this.getSnapshotVolumeSummary(backup.metadata.name!);
      volumeCount = count;
      volumeSuccessCount = success;
      volumeBytes = bytes;

      // save computed summary as annotations if snapshot is finished
      if (status !== Phase.New && status !== Phase.InProgress) {
        backup.metadata.annotations = backup.metadata.annotations || {};
        backup.metadata.annotations[snapshotVolumeCountKey] = volumeCount.toString();
        backup.metadata.annotations[snapshotVolumeSuccessCountKey] = volumeSuccessCount.toString();
        backup.metadata.annotations[snapshotVolumeBytesKey] = volumeBytes.toString();
        await this.request("PUT", `backups/${backup.metadata.name}`, backup);
      }
    }

    return {
      name: backup.metadata.name!,
      status,
      trigger,
      appSlug: backup.metadata.annotations && backup.metadata.annotations[kotsAppSlugKey],
      appVersion: backup.metadata.annotations && backup.metadata.annotations[kotsAppSequenceKey],
      started: backup.status!.startTimestamp,
      finished: backup.status!.completionTimestamp,
      expires: backup.status!.expiration,
      volumeCount,
      volumeSuccessCount,
      volumeBytes,
    };
  }

  async getSnapshotVolumeSummary(backupName: string): Promise<VolumeSummary> {
    let count = 0;
    let success = 0;
    let bytes = 0;

    const selector = `velero.io/backup-name=${getValidName(backupName)}`;
    const body = await this.request("GET", `podvolumebackups?lableSelector=${selector}`);

    _.each(body.items, (pvb) => {
      count++;
      if (pvb.status.phase === "Completed") {
        success++;
      }
      if (_.isNumber(pvb.status.progress.bytesDone)) {
        bytes += pvb.status.progress.bytesDone;
      }
    });

    return { count, success, bytes };
  }

  async createBackup(backup: Backup): Promise<Backup> {
    const body = await this.request("POST", "backups", backup);

    return body;
  }

  async getSnapshotDetail(name: string): Promise<SnapshotDetail> {
    const path = `backups/${name}`;
    const backup = await this.request("GET", path);
    const snapshot = await this.snapshotFromBackup(backup);

    const selector = `velero.io/backup-name=${getValidName(name)}`;
    const volumeList = await this.request("GET", `podvolumebackups?labelSelector=${selector}`);
    const volumes: Array<SnapshotVolume> = [];

    _.each(volumeList.items, (pvb) => {
      volumes.push({
        name: pvb.metadata.name,
        sizeBytes: pvb.status.progress.totalBytes,
        doneBytes: pvb.status.progress.bytesDone,
        started: pvb.status.startTimestamp,
        finished: pvb.status.completionTimestamp,
      });
    });

    let logs
    if (snapshot.status === Phase.Completed || snapshot.status === Phase.PartiallyFailed || snapshot.status === Phase.Failed) {
      try {
        logs = await this.getBackupLogs(name);
      } catch(e) {
        console.log(`Failed to get backup logs: ${e.message}`);
      }
    }

    const errors: Array<SnapshotError> = logs ? logs.error : [];

    _.each(backup.status.validationErrors, (message: string) => {
      errors.push({
        title: "Validation Error",
        message,
      });
    });

    return {
      ...snapshot,
      namespaces: backup.spec.includedNamespaces,
      volumes,
      errors,
      hooks: logs && logs.execs,
      warnings: logs && logs.warnings,
    };
  }

  async getBackupLogs(name: string): Promise<ParsedBackupLogs> {
    const url = await this.getLogsURL("backup", name);
    const options = {
      method: "GET",
      simple: true,
      encoding: null, // get a Buffer for the response
    };
    const buffer = await request(url, options);

    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, buffer) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(parseBackupLogs(buffer));
      });
    });
  }

  async getLogsURL(kind, name: string): Promise<string> {
    const drname = getValidName(`${kind}-logs-${name}-${Date.now()}`);

    let downloadrequest = {
      apiVersion: "velero.io/v1",
      kind: "DownloadRequest",
      metadata: {
        name: drname,
      },
      spec: {
        target: {
          kind: "BackupLog",
          name,
        },
      }
    };
    await this.request("POST", "downloadrequests", downloadrequest);

    for (let i = 0; i < 30; i++) {
      const body = await this.request("GET", `downloadrequests/${drname}`);
      if (body.status && body.status.downloadURL) {
        await this.request("DELETE", `downloadrequests/${drname}`);
        return body.status.downloadURL;
      }
      await sleep(1);
    }

    throw new Error(`Timed out waiting for DownloadRequest for ${kind}/${name} logs`);
  }

  async readSnapshotStore(): Promise<SnapshotStore> {
    const corev1 = this.kc.makeApiClient(CoreV1Api);
    try {
      const bsl = await this.request("GET", `backupstoragelocations/${backupStorageLocationName}`); 

      const store: SnapshotStore = {
        provider: bsl.spec.provider,
        bucket: bsl.spec.objectStorage.bucket,
        path: bsl.spec.objectStorage.prefix,
      };

      switch (store.provider) {
      case SnapshotProvider.S3AWS:
        const {accessKeyID, accessKeySecret} = await readAWSCredentialsSecret(corev1, this.ns);

        store.s3AWS = {
          region: bsl.spec.config.region,
          accessKeyID,
        };
        if (accessKeySecret) {
          store.s3AWS.accessKeySecret = redacted;
        }
        break;

      case SnapshotProvider.S3Compatible:
        const s3Creds = await readAWSCredentialsSecret(corev1, this.ns);

        store.s3Compatible = {
          region: bsl.spec.config.region,
          endpoint: bsl.spec.config.endpoint,
          accessKeyID: s3Creds.accessKeyID,
        };
        if (s3Creds.accessKeySecret) {
          store.s3Compatible.accessKeySecret = redacted;
        }
        break;

      case SnapshotProvider.Azure:
        const creds = await readAzureCredentialsSecret(corev1, this.ns);

        store.azure = {
          resourceGroup: bsl.spec.config.resourceGroup,
          storageAccount: bsl.spec.config.storageAccount,
          subscriptionID: bsl.spec.config.subscriptionId,
          tenantID: creds.tenantID || "",
          clientID: creds.clientID || "",
          clientSecret: creds.clientSecret ? redacted : "",
          cloudName: creds.cloudName || AzureCloudName.Public,
        };
        break;

      case SnapshotProvider.Google:
        const serviceAccount = await readGoogleCredentialsSecret(corev1, this.ns);

        store.google = {
          serviceAccount: serviceAccount ? redacted : "",
        };
      }

      return store;
    } catch (e) {
      throw e;
    }
  }

  async saveSnapshotStore(store: SnapshotStore): Promise<void> {
    const backupStorageLocation = {
      apiVersion: "velero.io/v1",
      kind: "BackupStorageLocation",
      metadata: {
        name: backupStorageLocationName,
        namespace: this.ns,
      },
      spec: {
        provider: store.provider,
        objectStorage: {
          bucket: store.bucket,
          prefix: store.path,
        },
        config: {},
      },
    };
    const corev1 = this.kc.makeApiClient(CoreV1Api);
    let credentialsSecret: V1Secret|null;

    switch (store.provider) {
    case SnapshotProvider.S3AWS:
      if (!_.isObject(store.s3AWS)) {
        throw new ReplicatedError("s3AWS store configuration is required");
      }
      backupStorageLocation.spec.config = {
        region: store.s3AWS!.region,
      };
      credentialsSecret = await awsCredentialsSecret(corev1, this.ns, store.s3AWS!);
      break;

    case SnapshotProvider.S3Compatible:
      if (!_.isObject(store.s3Compatible)) {
        throw new ReplicatedError("s3Compatible store configuration is required");
      }
      backupStorageLocation.spec.config = {
        region: store.s3Compatible!.region,
        endpoint: store.s3Compatible!.endpoint,
      };
      credentialsSecret = await awsCredentialsSecret(corev1, this.ns, store.s3Compatible!);
      break;

    case SnapshotProvider.Azure:
      if (!_.isObject(store.azure)) {
        throw new ReplicatedError("azure store configuration is required");
      }
      backupStorageLocation.spec.config = {
        resourceGroup: store.azure!.resourceGroup,
        storageAccount: store.azure!.storageAccount,
        subscriptionId: store.azure!.subscriptionID,
      };
      credentialsSecret = await azureCredentialsSecret(corev1, this.ns, store.azure!);
      break;

    case SnapshotProvider.Google:
      if (!_.isObject(store.google)) {
        throw new ReplicatedError("google store configuration is required");
      }
      backupStorageLocation.spec.config = {};
      credentialsSecret = await googleCredentialsSecret(corev1, this.ns, store.google!);
      break;

    default:
      throw new ReplicatedError(`unknown snapshot provider: ${_.escape(store.provider)}`);
    }

    try {
      const body = await this.request("GET", `backupstoragelocations/${backupStorageLocationName}`);
      body.spec = backupStorageLocation.spec;
      await this.request("PUT", `backupstoragelocations/${backupStorageLocationName}`, body);
    } catch(e) {
      console.log(e);
      try {
        await this.request("POST", "backupstoragelocations", backupStorageLocation);
      } catch(e) {
        console.log(e);
        return;
      }
    }

    if (!credentialsSecret) {
      return;
    }

    try {
      const { response } = await corev1.readNamespacedSecret(credentialsSecret.metadata!.name!, this.ns);
      if (response.statusCode === 200) {
        try {
          await corev1.replaceNamespacedSecret(credentialsSecret.metadata!.name!, this.ns, credentialsSecret);
        } catch(e) {
          console.log(e);
          return;
        }
      } else {
        try {
          await corev1.createNamespacedSecret(this.ns, credentialsSecret);
        } catch(e) {
          console.log(e);
          return;
        }
      }
    } catch(e) {
      console.log(e);
      try {
        await corev1.createNamespacedSecret(this.ns, credentialsSecret);
      } catch(e) {
        console.log(e);
        return;
      }
    }
  }

  async listBackends(): Promise<Array<string>> {
    const body = await this.request("GET", "backupstoragelocations");

    return _.map(body.items, (item: any) => {
      return item.metadata.name;
    });
  }

  async deleteSnapshot(backupName: string): Promise<void> {
    const dbr = {
      apiVersion: "velero.io/v1",
      kind: "DeleteBackupRequest",
      metadata: {
        name: `${backupName}-${Date.now()}`,
        namespace: this.ns,
      },
      spec: { backupName },
    };
    await this.request("POST", "deletebackuprequests", dbr);
  }
}

function maybeParseInt(s: string|undefined): number|undefined {
  if (_.isString(s)) {
    const i = parseInt(s)
    if (_.isNumber(i)) {
      return i;
    }
    return;
  }
}

// https://github.com/vmware-tanzu/velero/blob/be140985c5232710c9ed5ff6f85d630b96b9b7be/pkg/label/label.go#L31
function getValidName(label: string): string {
  const DNS1035LabelMaxLength = 63;

  if (label.length <= DNS1035LabelMaxLength) {
    return label;
  }
  const shasum = crypto.createHash("sha256");
  shasum.update(label);
  const sha = shasum.digest("hex");

  return label.slice(0, DNS1035LabelMaxLength - 6) + sha.slice(0, 6);
}

async function azureCredentialsSecret(corev1: CoreV1Api, namespace: string, azure: SnapshotStoreAzure): Promise<V1Secret> {
  let clientSecret = azure.clientSecret;
  if (clientSecret === redacted) {
    const creds = await readAzureCredentialsSecret(corev1, namespace);
    clientSecret = creds.clientSecret || "";
  }

  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: "azure-credentials",
    },
    stringData: {
      cloud: `AZURE_SUBSCRIPTION_ID=${azure.subscriptionID}
AZURE_TENANT_ID=${azure.tenantID}
AZURE_CLIENT_ID=${azure.clientID}
AZURE_CLIENT_SECRET=${clientSecret}
AZURE_RESOURCE_GROUP=${azure.resourceGroup}
AZURE_CLOUD_NAME=${azure.cloudName}`,
    },
  };
}

interface azureCreds {
  tenantID?: string,
  clientID?: string,
  clientSecret?: string,
  resourceGroup?: string,
  cloudName?: AzureCloudName,
}
async function readAzureCredentialsSecret(corev1: CoreV1Api, namespace: string): Promise<azureCreds> {
  try {
    const creds: azureCreds = {};

    const { response, body: secret } = await corev1.readNamespacedSecret(azureSecretName, namespace);
    if (response.statusCode !== 200 || !secret.data!.cloud) {
      return creds;
    }
    const cloud = base64Decode(secret.data!.cloud);

    const tenantID = cloud.match(/AZURE_TENANT_ID=([^\n]+)/);
    const clientID = cloud.match(/AZURE_CLIENT_ID=([^\n]+)/);
    const clientSecret = cloud.match(/AZURE_CLIENT_SECRET=([^\n]+)/);
    const resourceGroup = cloud.match(/AZURE_RESOURCE_GROUP=([^\n]+)/);
    const cloudName = cloud.match(/AZURE_CLOUD_NAME=([^\n]+)/);

    if (tenantID) {
      creds.tenantID = tenantID[1];
    }
    if (clientID) {
      creds.clientID = clientID[1];
    }
    if (clientSecret) {
      creds.clientSecret = clientSecret[1];
    }
    if (resourceGroup) {
      creds.resourceGroup = resourceGroup[1];
    }
    if (cloudName) {
      creds.cloudName = cloudName[1] as AzureCloudName;
    }

    return creds;
  } catch (e) {
    throw e;
  }
}

async function awsCredentialsSecret(corev1: CoreV1Api, namespace: string, aws: SnapshotStoreS3AWS): Promise<V1Secret|null> {
  let accessKeySecret = aws.accessKeySecret;
  if (accessKeySecret === redacted) {
    ({ accessKeySecret } = await readAWSCredentialsSecret(corev1, namespace));
  }

  if (!accessKeySecret && !aws.accessKeyID) {
    const { response } = await corev1.deleteNamespacedSecret(awsSecretName, namespace);
    if (response.statusCode !== 200 && response.statusCode !== 404) {
      throw new ReplicatedError(`Failed to delete secret ${awsSecretName} from namespace ${namespace}. Velero will continue using the credentials in the secret if it exists rather than EC2 instance profiles`);
    }
    return null;
  }

  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: awsSecretName,
      namespace,
    },
    stringData: {
      cloud: `[default]
aws_access_key_id=${aws.accessKeyID}
aws_secret_access_key=${accessKeySecret}`,
    },
  };
}

interface awsCreds {
  accessKeyID?: string,
  accessKeySecret?: string,
}
async function readAWSCredentialsSecret(corev1: CoreV1Api, namespace: string): Promise<awsCreds> {
  const creds: awsCreds = {};

  const  { response, body: secret } = await corev1.readNamespacedSecret(awsSecretName, namespace);
  if (response.statusCode !== 200 || !secret.data!.cloud) {
    return {};
  }
  const cloud = base64Decode(secret.data!.cloud);

  const keyID = cloud.match(/aws_access_key_id=([^\n]+)/);
  const keySecret = cloud.match(/aws_secret_access_key=([^\n]+)/);
  if (keyID) {
    creds.accessKeyID = keyID[1];
  }
  if (keySecret) {
    creds.accessKeySecret = keySecret[1];
  }

  return creds;
}

async function googleCredentialsSecret(corev1: CoreV1Api, namespace: string, google: SnapshotStoreGoogle): Promise<V1Secret> {
  let serviceAccount = google.serviceAccount;
  if (serviceAccount === redacted) {
    const sa = await readGoogleCredentialsSecret(corev1, namespace);
    if (sa) {
      serviceAccount = sa;
    } else {
      serviceAccount = "";
    }
  }

  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: googleSecretName,
      namespace,
    },
    stringData: {
      cloud: serviceAccount,
    },
  }
}

async function readGoogleCredentialsSecret(corev1: CoreV1Api, namespace: string): Promise<string|void> {
  try {
    const { response, body: secret } = await corev1.readNamespacedSecret(googleSecretName, namespace);
    if (response.statusCode !== 200 || !secret.data!.cloud) {
      return;
    }

    return base64Decode(secret.data!.cloud);
  } catch(e) {
    throw e;
  }
}
