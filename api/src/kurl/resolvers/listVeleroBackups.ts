import {
  KubeConfig,
} from "@kubernetes/client-node";
import { ReplicatedError } from "../../server/errors";
import request, { RequestPromiseOptions } from "request-promise";

export async function listVeleroBackups(): Promise<any> {
  const kc = new KubeConfig();
  kc.loadFromDefault();

  const cluster = kc.getCurrentCluster();
  if (!cluster) {
    throw new ReplicatedError("no cluster");
  }

  const url = `${cluster.server}/apis/velero.io/v1/namespaces/velero/backups`
  const req = { url };
  await kc.applyToRequest(req);

  const options: RequestPromiseOptions = {};
  Object.assign(options, req);

  const response = await request(url, options);

  if (response.statusCode !== 200) {
    throw new ReplicatedError(`List velero.io/v1 Backups: ${response.statusCode}`);
  }

  return JSON.parse(response);
}
