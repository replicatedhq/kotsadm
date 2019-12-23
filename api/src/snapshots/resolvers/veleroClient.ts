import * as _ from "lodash";
import {
  KubeConfig,
} from "@kubernetes/client-node";
import { ReplicatedError } from "../../server/errors";
import request, { RequestPromiseOptions } from "request-promise";
import { kotsAppSlugKey, kotsAppSequenceKey, snapshotTriggerKey, Snapshot, SnapshotTrigger } from "../snapshot";
import { Backup, Phase } from "../velero";

export async function listVeleroBackups(): Promise<Array<Snapshot>> {
  const kc = new KubeConfig();
  kc.loadFromDefault();

  const cluster = kc.getCurrentCluster();
  if (!cluster) {
    throw new ReplicatedError("no cluster");
  }

  const url = `${cluster.server}/apis/velero.io/v1/namespaces/velero/backups`;
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
    return _.map(body.items, snapshotFromBackup);
  case 403:
    // TODO namespae
    throw new ReplicatedError("RBAC misconfigured for reading velero.io/v1 Backups from Velero namespace");
  case 404:
    throw new ReplicatedError("Velero is not installed in this cluster");
  }

  throw new Error(`List velero.io/v1 Backups: ${response.statusCode}`);
}

function snapshotFromBackup(backup: Backup): Snapshot {
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

  return {
    name: backup.metadata.name!,
    status: backup.status ? backup.status.phase : Phase.New,
    trigger,
    appSlug: backup.metadata.annotations && backup.metadata.annotations[kotsAppSlugKey],
    appVersion: backup.metadata.annotations && backup.metadata.annotations[kotsAppSequenceKey],
    started: backup.status!.startTimestamp,
    finished: backup.status!.completionTimestamp,
    expires: backup.status!.expiration,
    // TODO
    volumeCount: 0,
    // TODO
    volumeSuccessCount: 0,
    // TODO
    volumeBytes: 0,
  };
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
