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
import { ReplicatedError } from "../../server/errors";

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
      const { appId } = args;
      const { restoreInProgressName: name } = await stores.kotsAppStore.getApp(appId);
      if (!name) {
        throw new ReplicatedError("No restore is in progress");
      }
      const velero = new VeleroClient("velero"); // TODO namespace
      const restore = await velero.readRestore(name);
      if (!restore) {
        return {
          name,
          phase: Phase.New,
          volumes: [],
          errors: [],
          warnings: [],
        };
      }

      const volumes = await velero.listRestoreVolumes(name);
      const detail = {
        name,
        phase: restore.status ? restore.status.phase : Phase.New,
        volumes,
        errors: [],
        warnings: [],
      };

      if (detail.phase === Phase.Completed || detail.phase === Phase.PartiallyFailed || detail.phase === Phase.Failed) {
        const results = await velero.getRestoreResults(name);
        console.log(results);
      }

      return detail;
    },
  };
}
