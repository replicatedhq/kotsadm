import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Context } from "../../context";
import {
  RestoreDetail,
  Snapshot,
  SnapshotDetail,
  SnapshotStatus,
  SnapshotTrigger,
  SnapshotHookPhase,
} from "../snapshot";
import { SnapshotConfig, AzureCloudName, SnapshotProvider } from "../snapshot_config";

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
      console.log(slug);
      return [{
        name: "v.482 Manual Snapshot",
        status: SnapshotStatus.Completed,
        trigger: SnapshotTrigger.Manual,
        appVersion: "1.0.0",
        started: "2019-12-18T20:45:32+00:00",
        finished: "2019-12-18T21:49:37+00:00",
        expires: "2020-01-12T00:00:00+00:00",
        volumeCount: 5,
        volumeSuccessCount: 5,
        volumeBytes: 350810305
      }];
    },

    async snapshotDetail(root: any, args: any, context: Context): Promise<SnapshotDetail> {
      return {
        name: "azure-4",
        namespaces: ["sentry-enterprise-1", "sentry-enterprise-2"],
        hooks: [{
          name: "",
          phase: SnapshotHookPhase.Pre,
          command: "",
          selector: "",
          container: "",
          execs: [{
            name: "",
            started: "",
            finished: "",
            stdout: "",
            stderr: "",
            warning: {
              title: "",
              message: ""
            },
            error: {
              title: "",
              message: ""
            }
          }]
        }],
        volumes: [
          {
            name: "Redis",
            sizeBytes: 350810305,
            doneBytes: 350810305,
            started: "",
            finished: ""
          },
          {
            name: "Postgres",
            sizeBytes: 750810305,
            doneBytes: 750810305,
            started: "",
            finished: ""
          },
          {
            name: "Postgres-2",
            sizeBytes: 150810305,
            doneBytes: 150810305,
            started: "",
            finished: ""
          }
        ],
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
