import crypto from "crypto";
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
  SnapshotTrigger} from "../snapshot";
import { Backup, Phase } from "../velero";

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

  async request(method: string, kind: string, selector?: string, body?: any): Promise<any> {
    let url = `${this.server}/apis/velero.io/v1/namespaces/${this.ns}/${kind}`;
    if (method === "PUT") {
      url += `/${body.metadata.name}`;
    }
    if (selector) {
      url += `?labelSelector=${selector}`;
    }
    const req = { url };
    await this.kc.applyToRequest(req);
    const options: RequestPromiseOptions = {
      method,
      body,
      resolveWithFullResponse: true,
      simple: true,
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
      throw new ReplicatedError(`RBAC misconfigured for ${method} velero.io/v1 ${kind} from namespace ${this.ns}`);
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
        await this.request("PUT", "backups", void 0, backup);
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
    const body = await this.request("GET", "podvolumebackups", selector);

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
    const body = await this.request("POST", "backups", void 0, backup);

    return body;
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
