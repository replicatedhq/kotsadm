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
import { readSchedule } from "../schedule";
import { convertTTL } from "../backup";

export function SnapshotQueries(stores: Stores, params: Params) {
  return {
    async snapshotConfig(root: any, args: any, context: Context): Promise<SnapshotConfig> {
      const velero = new VeleroClient("velero"); // TODO namespace
      const store = await velero.readSnapshotStore();
      const schedule = await readSchedule(args.slug);
      const appId = await stores.kotsAppStore.getIdFromSlug(args.slug);
      const app = await stores.kotsAppStore.getApp(appId);
      const converted = convertTTL(app.snapshotTTL || "");

      let ttl = {
        inputValue: "1",
        inputTimeUnit: "month",
        converted: "720h",
      };
      if (app.snapshotTTL) {
        const [inputValue, inputTimeUnit ] = app.snapshotTTL.split(" ");
        ttl = {
          inputValue,
          inputTimeUnit,
          converted: convertTTL(app.snapshotTTL),
        };
      }

      return {
        autoEnabled: !!schedule,
        autoSchedule: schedule ? { userSelected: schedule.selection, schedule: schedule.schedule } : { userSelected: "weekly", schedule: "0 0 * * MON" },
        ttl,
        store,
      };
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
