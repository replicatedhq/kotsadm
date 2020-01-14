import * as _ from "lodash";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Context } from "../../context";
import {
  RestoreDetail,
  Snapshot,
  SnapshotDetail,
  SnapshotTrigger,
  SnapshotHookPhase,
} from "../snapshot";
import { Phase } from "../velero";
import { SnapshotConfig, AzureCloudName, SnapshotProvider } from "../snapshot_config";
import { VeleroClient } from "./veleroClient";

export function SnapshotQueries(stores: Stores, params: Params) {
  return {
    async snapshotConfig(root: any, args: any, context: Context): Promise<SnapshotConfig> {
      try {
        const velero = new VeleroClient("velero"); // TODO namespace
        const store = await velero.readSnapshotStore();

        return {
          autoEnabled: true,
          autoSchedule: {
            userSelected: "weekly",
            schedule: "0 0 12 ? * MON *",
          },
          ttl: {
            inputValue: "2",
            inputTimeUnit: "weeks",
            converted: "336h",
          },
          store,
        };
      } catch (e) {
        throw e;
      }
    },

    async listSnapshots(root: any, args: any, context: Context): Promise<Array<Snapshot>> {
      const { slug } = args;
      const client = new VeleroClient("velero"); // TODO namespace
      const snapshots = await client.listSnapshots();

      // TODO filter earlier
      return _.filter(snapshots, { appSlug: slug });
    },

    async snapshotDetail(root: any, args: any, context: Context): Promise<SnapshotDetail> {
      const { slug, id } = args;

      const client = new VeleroClient("velero"); // TODO namespace
      return await client.getSnapshotDetail(id);
    },

    async restoreDetail(root: any, args: any, context: Context): Promise<RestoreDetail> {
      return {
        name: "azure-4-20191212175928",
        phase: Phase.InProgress,
        volumes: [{
          name: "azure-4-20191212175928",
          phase: Phase.InProgress,
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
