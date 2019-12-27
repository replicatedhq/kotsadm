import * as _ from "lodash";
import * as yaml from "js-yaml";
import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Backup } from "../velero";
import { VeleroClient } from "./veleroClient";
import { ReplicatedError } from "../../server/errors";
import { kotsAppSlugKey, kotsAppSequenceKey, snapshotTriggerKey, SnapshotTrigger } from "../snapshot";
import { getK8sNamespace, kotsRenderFile } from "../../kots_app/kots_ffi";

export function SnapshotMutations(stores: Stores) {
  return {
    async saveSnapshotConfig(root: any, args: any, context: Context): Promise<void> {
      // ttl and schedule
    },

    async saveSnapshotStore(root: any, args: any, context: Context): Promise<void> {
      // provider
    },

    async manualSnapshot(root: any, args: any, context: Context): Promise<void> {
      const { appId } = args;
      const app = await stores.kotsAppStore.getApp(appId);
      const kotsVersion = await stores.kotsAppStore.getCurrentAppVersion(appId);
      if (!kotsVersion) {
        throw new ReplicatedError("App does not have a current version");
      }

      const name = `manual-${Date.now()}`;

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
          // TODO
          storageLocation: "local-ceph-rgw",
        }
      };

      if (_.includes(namespaces, ownNS)) {
        backup.spec.labelSelector = {
          matchExpressions: [{
            key: "app.kubernetes.io/name",
            operator: "NotIn",
            values: ["kotsadm"],
          }],
        }
      }

      // TODO namespace
      const velero = new VeleroClient("velero");
      await velero.createBackup(backup);
    },

    async restoreSnapshot(root: any, args: any, context: Context): Promise<void> {

    },

    async deleteSnapshot(root: any, args: any, context: Context): Promise<void> {

    },
  };
}
