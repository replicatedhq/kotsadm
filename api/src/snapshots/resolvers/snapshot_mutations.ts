import { Context } from "../../context";
import { Stores } from "../../schema/stores";

export function SnapshotMutations(stores: Stores) {
  return {
    async saveSnapshotConfig(root: any, args: any, context: Context): Promise<void> {
      // ttl and schedule

    },

    async saveSnapshotStore(root: any, args: any, context: Context): Promise<void> {
      // provider
    },

    async manualSnapshot(root: any, args: any, context: Context): Promise<void> {

    },

    async restoreSnapshot(root: any, args: any, context: Context): Promise<void> {

    },

    async deleteSnapshot(root: any, args: any, context: Context): Promise<void> {

    },
  };
}
