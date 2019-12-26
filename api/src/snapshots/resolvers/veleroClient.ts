import crypto from "crypto";
import zlib from "zlib";
import { parse } from "logfmt";
import * as _ from "lodash";
import {
  KubeConfig,
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
import { Backup, Phase } from "../velero";
import { sleep } from "../../util/utilities";
import { parseBackupLogs, ParsedBackupLogs } from "./parseBackupLogs";

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
    case 403:
      throw new ReplicatedError(`RBAC misconfigured for ${method} velero.io/v1 ${path} in namespace ${this.ns}`);
    case 404:
      throw new ReplicatedError("Velero is not installed in this cluster");
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
