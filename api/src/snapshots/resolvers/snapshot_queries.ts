import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Context } from "../../context";
import {
  RestoreDetail,
  Snapshot,
  SnapshotDetail,
  SnapshotStatus,
} from "../snapshot";
import { SnapshotConfig, SnapshotProvider } from "../snapshot_config";

export function SnapshotQueries(stores: Stores, params: Params) {
  return {
    async snapshotConfig(root: any, args: any, context: Context): Promise<SnapshotConfig> {
      return {
        enabled: true,
        schedule: "* * * * * *",
        ttl: "720h",
        store: {
          provider: SnapshotProvider.S3AWS,
          bucket: "",
          prefix: "",
        },
      };
    },

    async listSnapshots(root: any, args: any, context: Context): Promise<Array<Snapshot>> {
      return [];
    },

    async snapshotDetail(root: any, args: any, context: Context): Promise<SnapshotDetail> {
      return {
        name: "azure-4",
        namespaces: [],
        hooks: [],
        volumes: [],
        errors: [],
        warnings: [],
      };
    },

    async restoreDetail(root: any, args: any, context: Context): Promise<RestoreDetail> {
      return {
        name: "azure-4-20191212175928",
        phase: SnapshotStatus.InProgress,
        volumes: [{
          name: "azure-4-20191212175928",
          phase: SnapshotStatus.InProgress,
          podName: "kotsadm-api-855f6f6d48-z497z",
          podNamespace: "default",
          podVolumeName: "backups",
          doneBytes: 350810305,
          sizeBytes: 11968975360,
          started: "2019-12-12T17:59:34Z",
        }],
        errors: [],
        warnings: [{
          namespace: "default",
          title: "could not restore",
          message: `replicasets.apps "kotsadm-web-6c6fb454db" already exists. Warning: the in-cluster version is different than the backed-up version.`,
        }],
      };
    },
  };
}
