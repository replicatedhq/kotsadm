import * as _ from "lodash";
import * as yaml from "js-yaml";
import * as cronstrue from "cronstrue";
import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import { Params } from "../../server/params";
import { Backup } from "../velero";
import { backupStorageLocationName, VeleroClient } from "./veleroClient";
import { ReplicatedError } from "../../server/errors";
import {
  kotsAppSlugKey,
  kotsAppIdKey,
  kotsClusterIdKey,
  kotsAppSequenceKey,
  kotsadmLabelKey,
  snapshotTriggerKey,
  RestoreDetail,
  SnapshotTrigger
} from "../snapshot";
import { Phase } from "../velero";
import { SnapshotStore, SnapshotProvider } from "../snapshot_config";
import { deleteSchedule, schedule } from "../schedule";
import { getK8sNamespace, kotsRenderFile } from "../../kots_app/kots_ffi";
import {
  BatchV1beta1Api,
  V1beta1CronJob } from "@kubernetes/client-node";
import { logger } from "../../server/logger";
import { backup } from "../backup";
import { sleep } from "../../util/utilities";

export function SnapshotMutations(stores: Stores) {
  return {
    async saveSnapshotConfig(root: any, args: any, context: Context): Promise<void> {
      try {
        context.requireSingleTenantSession();

        const {
          appId,
          inputValue: retentionQuantity,
          inputTimeUnit: retentionUnit,
          userSelected: scheduleSelected,
          schedule: scheduleExpression,
          autoEnabled,
        } = args;

        const app = await stores.kotsAppStore.getApp(appId);

        const ttlN = parseInt(retentionQuantity);
        if (_.isNaN(ttlN) || ttlN < 1) {
          throw new ReplicatedError(`Invalid snapshot retention: ${retentionQuantity} ${retentionUnit}`);
        }

        switch (retentionUnit) {
        case "seconds":
        case "minutes":
        case "hours":
        case "days":
        case "weeks":
        case "months":
        case "years":
          break;
        default:
          throw new ReplicatedError(`Invalid snapshot retention: ${retentionQuantity} ${retentionUnit}`);
        }

        const retention = `${ttlN} ${retentionUnit}`;
        if (app.snapshotTTL !== retention) {
          await stores.kotsAppStore.updateAppSnapshotTTL(appId, retention);
        }

        if (autoEnabled) {
          try {
            cronstrue.toString(scheduleExpression);
          } catch(e) {
            throw new ReplicatedError(`Invalid snapshot schedule: ${scheduleExpression}`);
          }
          if (scheduleExpression.split(" ").length > 5) {
            throw new ReplicatedError("Snapshot schedule expression does not support seconds or years");
          }

          switch (scheduleSelected) {
          case "hourly":
          case "daily":
          case "weekly":
          case "custom":
            break;
          default:
            throw new ReplicatedError(`Invalid schedule selection: ${scheduleSelected}`);
          }

          await schedule(app.slug, scheduleExpression, scheduleSelected);
        } else {
          await deleteSchedule(app.slug);
        }
      } catch (e) {
        logger.error(e);
        throw e;
      }
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
      const config: SnapshotStore = {
        bucket,
        path: prefix,
        provider: SnapshotProvider.S3Compatible,
        s3Compatible: {
          region,
          endpoint,
          accessKeyID,
          accessKeySecret,
        },
      };
      const client = new VeleroClient("velero"); // TODO velero namespace

      return client.saveSnapshotStore(config);
    },

    async snapshotProviderAzure(root: any, args: any, context: Context): Promise<void> {
      const { bucket, prefix, tenantID, resourceGroup,  storageAccount, subscriptionID, clientID, clientSecret, cloudName } = args;
      const config: SnapshotStore = {
        bucket,
        path: prefix,
        provider: SnapshotProvider.Azure,
        azure: {
          resourceGroup,
          storageAccount,
          subscriptionID,
          clientID,
          tenantID,
          clientSecret,
          cloudName,
        },
      };
      const client = new VeleroClient("velero"); // TODO velero namespace

      return client.saveSnapshotStore(config);
    },

    async snapshotProviderGoogle(root: any, args: any, context: Context): Promise<void> {
      const { bucket, prefix, serviceAccount } = args;
      const config: SnapshotStore = {
        bucket,
        path: prefix,
        provider: SnapshotProvider.Google,
        google: {
          serviceAccount
        },
      };
      const client = new VeleroClient("velero"); // TODO velero namespace

      return client.saveSnapshotStore(config);
    },

    async manualSnapshot(root: any, args: any, context: Context): Promise<void> {
      const scheduled = false;
      await backup(stores, args.appId, scheduled);
    },

    async restoreSnapshot(root: any, args: any, context: Context): Promise<RestoreDetail> {
      const restoreName = `${args.snapshotName}-${Date.now()}`;
      const velero = new VeleroClient("velero"); // TODO velero namespace

      // ensure the backup exists with required annotations
      const backup = await velero.readBackup(args.snapshotName);
      if (!backup.metadata.annotations) {
        throw new ReplicatedError(`Backup is missing appID, cluster ID and version annotations`);
      }
      const appId = backup.metadata.annotations[kotsAppIdKey];
      if (!appId) {
        throw new ReplicatedError(`Backup is missing app ID annotation`);
      }
      const clusterId = backup.metadata.annotations[kotsClusterIdKey];
      if (!clusterId) {
        throw new ReplicatedError(`Backup is missing cluster ID annotation`);
      }
      const sequenceString = backup.metadata.annotations[kotsAppSequenceKey];
      if (!sequenceString) {
        throw new ReplicatedError(`Backup is missing version annotation`);
      }
      const sequence = parseInt(sequenceString);
      if (_.isNaN(sequence)) {
        throw new ReplicatedError(`Failed to parse sequence from Backup: ${sequenceString}`);
      }
      logger.info(`Restore found Backup ${args.snapshotName} for app ${appId} sequence ${sequence} on cluster ${clusterId}`);
 
      // ensure the backup's kots app version exists in the db
      const currentVersion = await stores.kotsAppStore.getCurrentAppVersion(appId);
      if (!currentVersion || currentVersion.sequence !== sequence) {
        const pastVersions = await stores.kotsAppStore.listPastVersions(appId, clusterId);
        const version = _.find(pastVersions, (version) => {
          console.log(version);
          return version.sequence === sequence;
        });
        if (!version) {
          throw new ReplicatedError(`Cannot restore version ${sequence} since it has never been installed in this cluster`);
        }
      }
      logger.info(`Restore confirmed version ${sequence} was previously installed`);

      // set the restore in progress flag to prevent concurrent deploys
      // TODO most queries and mutations should be unavailable when this is set
      await stores.kotsAppStore.updateAppRestoreInProgressName(appId, restoreName);

      // undeploy the current kots app version
      logger.info(`Restore removing current app version.`);
      // TODO socket server stop deployment loop and do undeploy
      console.log("undeploy not implemented: manually delete with kubectl");
      // await stores.kotsAppStore.undeployVersion(appId, sequence, clusterId);
      await sleep(10); // TODO
      logger.info(`Restore successfully removed current app version.`);

      // create the Restore resource
      await velero.restore(args.snapshotName);
      logger.info(`Created Restore object ${restoreName}`);

      return { name: restoreName, phase: Phase.New, volumes: [], errors: [], warnings: [] };
    },

    async deleteSnapshot(root: any, args: any, context: Context): Promise<void> {
      const velero = new VeleroClient("velero"); // TODO namespace
      velero.deleteSnapshot(args.snapshotName);
    },
  };
}
