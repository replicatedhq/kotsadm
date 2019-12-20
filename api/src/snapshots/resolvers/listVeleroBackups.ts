import * as _ from "lodash";
import {
  KubeConfig,
} from "@kubernetes/client-node";
import { ReplicatedError } from "../../server/errors";
import request, { RequestPromiseOptions } from "request-promise";
import { Snapshot, SnapshotTrigger } from "../snapshot";
import { Backup } from "../velero";

export async function listVeleroBackups(): Promise<Array<Snapshot>> {
  const kc = new KubeConfig();
  kc.loadFromDefault();

  const cluster = kc.getCurrentCluster();
  if (!cluster) {
    throw new ReplicatedError("no cluster");
  }

  const url = `${cluster.server}/apis/velero.io/v1/namespaces/velero/backups`
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
    throw new ReplicatedError("RBAC misconfigured for reading from Velero namespace");
  case 404:
    throw new ReplicatedError("Velero is not installed in this cluster");
  }

  throw new Error(`List velero.io/v1 Backups: ${response.statusCode}`);
}

function snapshotFromBackup(backup: Backup): Snapshot {
  return {
    name: backup.metadata.name!,
    status: backup.status.phase, // ?
    // TODO
    trigger: SnapshotTrigger.Manual,
    // TODO
    appVersion: backup.metadata.annotations && backup.metadata.annotations["kots.io/app-version"],
    started: backup.status.startTimestamp,
    finished: backup.status.completionTimestamp,
    expires: backup.status.expiration,
    // TODO
    volumeCount: 0,
    // TODO
    volumeSuccessCount: 0,
    // TODO
    volumeBytes: 0,
  };
}
