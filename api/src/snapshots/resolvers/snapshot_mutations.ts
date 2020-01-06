import * as _ from "lodash";
import * as yaml from "js-yaml";
import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Backup } from "../velero";
import { backupStorageLocationName, VeleroClient } from "./veleroClient";
import { ReplicatedError } from "../../server/errors";
import { kotsAppSlugKey, kotsAppSequenceKey, snapshotTriggerKey, SnapshotTrigger } from "../snapshot";
import { SnapshotStore, SnapshotProvider } from "../snapshot_config";
import { getK8sNamespace, kotsRenderFile } from "../../kots_app/kots_ffi";

export function SnapshotMutations(stores: Stores) {
  return {
    async saveSnapshotConfig(root: any, args: any, context: Context): Promise<void> {
      // ttl and schedule
    },

    async snapshotProviderAWS(root: any, args: any, context: Context): Promise<void> {
      const { bucket, prefix, region, accessKeyID, accessKeySecret } = args;
      const config: SnapshotStore = {
        bucket,
        path: prefix,
        provider: SnapshotProvider.S3AWS,
        s3AWS: {
          region,
          accessKeyID,
          accessKeySecret,
        },
      };
      const client = new VeleroClient("velero"); // TODO velero namespace

      return client.saveSnapshotStore(config);
    },

    async snapshotProviderS3Compatible(root: any, args: any, context: Context): Promise<void> {
      const { bucket, prefix, region, endpoint, accessKeyID, accessKeySecret } = args;
    },

    async snapshotProviderAzure(root: any, args: any, context: Context): Promise<void> {
      const { bucket, prefix, tenantID, resourceGroup,  storageAccount, subscriptionID, clientID, clientSecret, cloudName } = args;
    },

    async snapshotProviderGoogle(root: any, args: any, context: Context): Promise<void> {
      const { bucket, prefix, serviceAccount } = args;
    },

    async manualSnapshot(root: any, args: any, context: Context): Promise<void> {
      const { appId } = args;
      const app = await stores.kotsAppStore.getApp(appId);
      const kotsVersion = await stores.kotsAppStore.getCurrentAppVersion(appId);
      if (!kotsVersion) {
        throw new ReplicatedError("App does not have a current version");
      }

      const name = `manual-${Date.now()}`;

      const tmpl = await stores.snapshotsStore.getKotsBackupSpec(appId, kotsVersion.sequence);
      const rendered = await kotsRenderFile(app, stores, tmpl);
      const base = yaml.safeLoad(rendered) as Backup;
      const spec = (base && base.spec) || {};

      const namespaces = _.compact(spec.includedNamespaces);
      // TODO operator may have a different target namespace
      const ownNS = getK8sNamespace();
      if (namespaces.length === 0) {
        namespaces.push(getK8sNamespace());
      }

      // TODO namespace
      const velero = new VeleroClient("velero");

      let backend: string;
      try {
        const backends = await velero.listBackends();
        if (_.includes(backends, backupStorageLocationName)) {
          backend = backupStorageLocationName;
        } else if (_.includes(backends, "local-ceph-rgw")) {
          backend = "local-ceph-rgw";
        } else {
          throw new ReplicatedError("No backupstoragelocation configured");
        }
      } catch (e) {
        throw e;
      }

      let backup: Backup = {
        apiVersion: "velero.io/v1",
        kind: "Backup",
        metadata: {
          name,
          annotations: {
            [snapshotTriggerKey]: SnapshotTrigger.Manual,
            [kotsAppSlugKey]: app.slug,
            [kotsAppSequenceKey]: kotsVersion.sequence.toString(),
          }
        },
        spec: {
          hooks: spec.hooks,
          includedNamespaces: namespaces,
          ttl: spec.ttl,
          storageLocation: backend,
        }
      };

      if (_.includes(namespaces, ownNS)) {
        backup.spec.labelSelector = {
          matchExpressions: [{
            key: "app.kubernetes.io/name",
            operator: "NotIn",
            values: ["kotsadm"],
          }],
        }
      }

      try {
        await velero.createBackup(backup);
      } catch (e) {
        throw e;
      }
    },

    async restoreSnapshot(root: any, args: any, context: Context): Promise<void> {

    },

    async deleteSnapshot(root: any, args: any, context: Context): Promise<void> {

    },
  };
}
