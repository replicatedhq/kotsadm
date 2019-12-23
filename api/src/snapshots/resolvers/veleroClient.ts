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

export async function listVeleroBackups(): Promise<Array<Snapshot>> {
  const kc = new KubeConfig();
  kc.loadFromDefault();

  const cluster = kc.getCurrentCluster();
  if (!cluster) {
    throw new ReplicatedError("no cluster");
  }

  const url = `${cluster.server}/apis/velero.io/v1/namespaces/velero/backups`; // TODO namespace
  const req = { url };
  await kc.applyToRequest(req);

  const options: RequestPromiseOptions = {
    resolveWithFullResponse: true,
    simple: true,
  };
  Object.assign(options, req);

  const response = await request(url, options);
  switch (response.statusCode) {
  case 200:
    const body = JSON.parse(response.body);
    const snapshots: Array<Snapshot> = [];
    for (let backup of body.items) {
      const snapshot = await snapshotFromBackup(backup);
      snapshots.push(snapshot);
    }
    return snapshots;
  case 403:
    // TODO namespae
    throw new ReplicatedError("RBAC misconfigured for reading velero.io/v1 Backups from Velero namespace");
  case 404:
    throw new ReplicatedError("Velero is not installed in this cluster");
  }

  throw new Error(`List velero.io/v1 Backups: ${response.statusCode}`);
}

async function snapshotFromBackup(backup: Backup): Promise<Snapshot> {
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

  let volumeCount = maybeParseInt(backup.metadata.annotations && backup.metadata.annotations[snapshotVolumeCountKey]);
  let volumeSuccessCount = maybeParseInt(backup.metadata.annotations && backup.metadata.annotations[snapshotVolumeSuccessCountKey]);
  let volumeBytes = maybeParseInt(backup.metadata.annotations && backup.metadata.annotations[snapshotVolumeBytesKey]);

  if (_.isUndefined(volumeCount) || _.isUndefined(volumeSuccessCount) || _.isUndefined(volumeBytes)) {
    const { count, success, bytes } = await getSnapshotVolumeSummary(backup.metadata.name!);
    volumeCount = count;
    volumeSuccessCount = success;
    volumeBytes = bytes;
  }

  return {
    name: backup.metadata.name!,
    status: backup.status ? backup.status.phase : Phase.New,
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

function maybeParseInt(s: string|undefined): number|undefined {
  if (_.isString(s)) {
    const i = parseInt(s)
    if (_.isNumber(i)) {
      return i;
    }
    return;
  }
}

interface VolumeSummary {
  count: number,
  success: number,
  bytes: number,
}

// TODO test this
// https://github.com/vmware-tanzu/velero/blob/be140985c5232710c9ed5ff6f85d630b96b9b7be/pkg/label/label.go#L31
function getValidName(label: string): string {
  // https://github.com/kubernetes/apimachinery/blob/master/pkg/util/validation/validation.go#L180
  const DNS1035LabelMaxLength = 63;

  if (label.length <= DNS1035LabelMaxLength) {
    return label;
  }
  const shasum = crypto.createHash("sha256");
  shasum.update(label);
  const sha = shasum.digest("hex");

  return label.slice(0, DNS1035LabelMaxLength - 6) + sha.slice(0, 6);
}

async function getSnapshotVolumeSummary(backupName: string): Promise<VolumeSummary> {
  let count = 0;
  let success = 0;
  let bytes = 0;

  const kc = new KubeConfig();
  kc.loadFromDefault();
  const cluster = kc.getCurrentCluster();
  if (!cluster) {
    throw new ReplicatedError("no cluster");
  }
  const url = `${cluster.server}/apis/velero.io/v1/namespaces/velero/podvolumebackups?labelSelector=velero.io/backup-name=${getValidName(backupName)}`;
  const req = { url };
  await kc.applyToRequest(req);
  const options: RequestPromiseOptions = {
    resolveWithFullResponse: true,
    strictSSL: false,
    simple: true,
  };
  Object.assign(options, req);

  const response = await request(url, options);
  switch (response.statusCode) {
  case 200:
    const body = JSON.parse(response.body);
    _.each(body.items, (pvb) => {
      count++;
      if (pvb.status.phase === "Completed") {
        success++;
      }
      if (_.isNumber(pvb.status.progress.bytesDone)) {
        bytes += pvb.status.progress.bytesDone;
      }
    });
    break;
  case 403:
    // TODO namespae
    throw new ReplicatedError("RBAC misconfigured for reading velero.io/v1 PodVolumeSnapshots from Velero namespace");
  case 404:
    throw new ReplicatedError("Velero is not installed in this cluster");
  }

  return { count, success, bytes };
}

export async function createVeleroBackup(backup: Backup): Promise<Backup> {
  const kc = new KubeConfig();
  kc.loadFromDefault();

  const cluster = kc.getCurrentCluster();
  if (!cluster) {
    throw new Error("no cluster");
  }

  const url = `${cluster.server}/apis/velero.io/v1/namespaces/velero/backups`;
  const req = { url };
  await kc.applyToRequest(req);

  const options: RequestPromiseOptions = {
    method: "POST",
    resolveWithFullResponse: true,
    simple: true,
    body: backup,
    json: true,
  };
  Object.assign(options, req);

  const response = await request(url, options);
  switch (response.statusCode) {
  case 201:
    return response.body;
    break;
  case 403:
    // TODO namespace
    throw new ReplicatedError("RBAC misconfigured for creating velero.io/v1 Backups in Velero namespace");
    break;
  case 404:
    throw new ReplicatedError("Velero is not installed in this cluster");
    break;
  }

  throw new Error(`Create velero.io/v1 Backups: ${response.statusCode}`);
}
