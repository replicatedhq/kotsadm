import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Context } from "../../context";
import {
  Snapshot,
  SnapshotDetail,
} from "../snapshot";
import { SnapshotConfig } from "../snapshot_config";

export function SnapshotQueries(stores: Stores, params: Params) {
  return {
    async snapshotConfig(root: any, args: any, context: Context): Promise<SnapshotConfig> {
      return {
        enabled: true,
        schedule: "* * * * * *",
        ttl: "720h",
        store: {
          provider: aws,
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
        namespaces: [],
        hooks: [],
        volumes: [],
        errors: [],
        warnings: [],
      };
    },
  };
}
