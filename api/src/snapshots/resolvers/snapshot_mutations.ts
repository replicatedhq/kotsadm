import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import { Backup } from "../velero";
import { createVeleroBackup } from "./veleroClient";

export function SnapshotMutations(stores: Stores) {
  return {
    async saveSnapshotConfig(root: any, args: any, context: Context): Promise<void> {
      // ttl and schedule

    },

    async saveSnapshotStore(root: any, args: any, context: Context): Promise<void> {
      // provider
    },

    async manualSnapshot(root: any, args: any, context: Context): Promise<void> {
      const { appId, sequence } = args;
      const name = `manual-${Date.now()}`;

      // TODO is the yaml templated or are individual properties templated?
      const base = await stores.snapshotsStore.getKotsBackupSpec(appId, sequence);
      const spec = (base && base.spec) || {};

      let backup: Backup = {
        metadata: {
          name,
        },
        spec: {
          excludedNamespaces: spec.excludedNamespaces,
          // TODO add in kotsadm if it's same namespace
          excludedResources: spec.excludedResources,
          hooks: spec.hooks,
          includedNamespaces: spec.includedNamespaces,
          ttl: spec.ttl,
          // TODO
          storageLocation: "local-ceph-rgw",
        }
      };

      backup = await createVeleroBackup(backup);
      console.log(backup);
    },

    async restoreSnapshot(root: any, args: any, context: Context): Promise<void> {

    },

    async deleteSnapshot(root: any, args: any, context: Context): Promise<void> {

    },
  };
}
