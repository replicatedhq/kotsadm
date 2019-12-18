import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Context } from "../../context";
import {
  RestoreDetail,
  Snapshot,
  SnapshotDetail,
  SnapshotStatus,
  SnapshotTrigger,
} from "../snapshot";
import { SnapshotConfig, AzureCloudName, SnapshotProvider } from "../snapshot_config";

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
          s3AWS: {
            region: "",
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
            endpoint: "",
            region: "",
            accessKeyID: "",
            accessKeySecret: "",
          }
        },
      };
    },

    async listSnapshots(root: any, args: any, context: Context): Promise<Array<Snapshot>> {
      const { slug } = args;
      console.log(slug);
      // return [{
      //   name: "v.482 Manual Snapshot",
      //   status: SnapshotStatus.Completed,
      //   trigger: SnapshotTrigger.Manual,
      //   appVersion: "1.0.0",
      //   started: "2019-12-18T20:45:32+00:00",
      //   finished: "2019-12-18T21:49:37+00:00",
      //   expires: "2020-01-12T00:00:00+00:00",
      //   volumeCount: 5,
      //   volumeSuccessCount: 5,
      //   volumeBytes: 350810305
      // }];
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
