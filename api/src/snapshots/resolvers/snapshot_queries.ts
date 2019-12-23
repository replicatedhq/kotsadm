import * as _ from "lodash";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Context } from "../../context";
import {
  RestoreDetail,
  Snapshot,
  SnapshotDetail,
  SnapshotTrigger,
} from "../snapshot";
import { Phase } from "../velero";
import { SnapshotConfig, AzureCloudName, SnapshotProvider } from "../snapshot_config";
import { VeleroClient } from "./veleroClient";

export function SnapshotQueries(stores: Stores, params: Params) {
  return {
    async snapshotConfig(root: any, args: any, context: Context): Promise<SnapshotConfig> {
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
        store: {
          provider: SnapshotProvider.S3AWS,
          bucket: "",
          path: "",
          s3AWS: {
            region: "us-west-1",
            accessKeyID: "",
            accessKeySecret: "",
          },
          azure: {
            tenantID: "",
            resourceGroup: "",
            storageAccount: "",
            subscriptionID: "",
            clientID: "",
            clientSecret: "",
            cloudName: AzureCloudName.Public,
          },
          s3Compatible: {
            endpoint: "/s3-comp-endpoint",
            region: "us-west-1",
            accessKeyID: "23543423543245",
            accessKeySecret: "adsf2sdfg3245642sdfsf",
          },
          google: {
            serviceAccount: `{ "key": "value" }`
          }
        },
      };
    },

    async listSnapshots(root: any, args: any, context: Context): Promise<Array<Snapshot>> {
      const { slug } = args;
      const client = new VeleroClient("velero"); // TODO namespace
      const snapshots = await client.listSnapshots();

      return _.filter(snapshots, { appSlug: slug });
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
