import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import { Backup } from "../velero";
import { VeleroClient } from "./veleroClient";
import { ReplicatedError } from "../../server/errors";
import { kotsAppSlugKey, kotsAppSequenceKey, snapshotTriggerKey, SnapshotTrigger } from "../snapshot";

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

      // TODO is the yaml templated or are individual properties templated?
      const base = await stores.snapshotsStore.getKotsBackupSpec(appId, kotsVersion.sequence);
      const spec = (base && base.spec) || {};

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
          // TODO template and maybe modify
          includedNamespaces: spec.includedNamespaces,
          ttl: spec.ttl,
          // TODO
          storageLocation: "local-ceph-rgw",
        }
      };

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
