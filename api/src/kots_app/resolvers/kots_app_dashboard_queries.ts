import { Stores } from "../../schema/stores";
import { Context } from "../../context";
import { ReplicatedError } from "../../server/errors";
import { State, KotsAppStatusSchema } from "../kots_app_status";
import { MetricChart } from "../../monitoring";
import { logger } from "../../server/logger";

interface AppStatusFunction {
  (): Promise<KotsAppStatusSchema>;
}

interface AppMetricsFunction {
  (): Promise<MetricChart[]>;
}

interface KotsAppDashboard {
  appStatus: AppStatusFunction;
  metrics: AppMetricsFunction;
}

export function KotsDashboardQueries(stores: Stores) {
  return {
    async getKotsAppDashboard(root: any, args: any, context: Context): Promise<KotsAppDashboard> {
      return {
        appStatus: async (): Promise<KotsAppStatusSchema> => {
          return await getKotsAppStatus(stores, root, args, context);
        },
        metrics: async (): Promise<MetricChart[]> => {
          try {
            return await getKotsAppMetricCharts(stores, root, args, context);
          } catch(err) {
            logger.error("[getKotsAppDashboard] - Unable to retrieve metrics charts", err);
            return [];
          }
        },
      }
    },
  };
}

async function getKotsAppStatus(stores: Stores, root: any, args: any, context: Context): Promise<KotsAppStatusSchema> {
  const { slug } = args;
  const appId = await stores.kotsAppStore.getIdFromSlug(slug)
  const app = await context.getApp(appId);
  try {
    const appStatus = await stores.kotsAppStatusStore.getKotsAppStatus(app.id);
    return appStatus.toSchema();
  } catch (err) {
    if (ReplicatedError.isNotFound(err)) {
      return {
        appId,
        updatedAt: new Date(),
        resourceStates: [],
        state: State.Missing,
      };
    }
    throw err;
  }
}

async function getKotsAppMetricCharts(stores: Stores, root: any, args: any, context: Context): Promise<MetricChart[]> {
  const { slug } = args;
  const appId = await stores.kotsAppStore.getIdFromSlug(slug)
  const app = await context.getApp(appId);
  return await stores.metricStore.getKotsAppMetricCharts(app.id);
}
