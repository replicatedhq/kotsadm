import * as _ from "lodash";
import * as yaml from "js-yaml";
import { Stores } from "../schema/stores";
import { ReplicatedError } from "../server/errors";
import { getK8sNamespace, kotsRenderFile } from "../kots_app/kots_ffi";
import { Backup } from "./velero";
import { backupStorageLocationName, VeleroClient } from "./resolvers/veleroClient";
import { kotsAppSlugKey, kotsAppSequenceKey, snapshotTriggerKey, SnapshotTrigger } from "./snapshot";

// must match kots
const kotsadmLabelKey = "app.kubernetes.io/name"; // TODO duplicated

export async function backup(stores: Stores, appId: string, scheduled: boolean) {
  const app = await stores.kotsAppStore.getApp(appId);
  const kotsVersion = await stores.kotsAppStore.getCurrentAppVersion(appId);
  if (!kotsVersion) {
    throw new ReplicatedError("App does not have a current version");
  }

  let name = `manual-${Date.now()}`;
  if (scheduled) {
    name = `scheduled-${Date.now()}`;
  }

  const tmpl = await stores.snapshotsStore.getKotsBackupSpec(appId, kotsVersion.sequence);
  const rendered = await kotsRenderFile(app, stores, tmpl);
  const base = yaml.safeLoad(rendered) as Backup;
  const spec = (base && base.spec) || {};

  const namespaces = _.compact(spec.includedNamespaces);
  // TODO operator may have a different target namespace
  const ownNS = getK8sNamespace();
  if (namespaces.length === 0) {
    namespaces.push(getK8sNamespace());
  }

  // TODO namespace
  const velero = new VeleroClient("velero");

  let backend: string;
  try {
    const backends = await velero.listBackends();
    if (_.includes(backends, backupStorageLocationName)) {
      backend = backupStorageLocationName;
    } else if (_.includes(backends, "local-ceph-rgw")) {
      backend = "local-ceph-rgw";
    } else {
      throw new ReplicatedError("No backupstoragelocation configured");
    }
  } catch (e) {
    throw e;
  }

  let backup: Backup = {
    apiVersion: "velero.io/v1",
    kind: "Backup",
    metadata: {
      name,
      annotations: {
        [snapshotTriggerKey]: SnapshotTrigger.Manual,
        [kotsAppSlugKey]: app.slug,
        [kotsAppSequenceKey]: kotsVersion.sequence.toString(),
      }
    },
    spec: {
      hooks: spec.hooks,
      includedNamespaces: namespaces,
      ttl: spec.ttl,
      storageLocation: backend,
    }
  };

  if (_.includes(namespaces, ownNS)) {
    backup.spec.labelSelector = {
      matchExpressions: [{
        key: kotsadmLabelKey,
        operator: "NotIn",
        values: ["kotsadm"],
      }],
    }
  }

  await velero.createBackup(backup);
}
