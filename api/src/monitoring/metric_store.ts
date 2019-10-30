import pg from "pg";
import { MetricChart, Series, Metric, ValuePair } from "./";
import { Params } from "../server/params";
import rp from "request-promise";
import { StatusCodeError } from "request-promise/errors";
import { logger } from "../server/logger";
import { getPostgresPool } from "../util/persistence/db";

const DefaultQueryDurationSeconds: number = 15 * 60; // 15 minutes
const DefaultGraphStepPoints: number = 80;

export interface MetricGraph {
  Title: string;
  Targets: MetricTarget[];
  DurationSeconds?: number;
  YAxisFormat?: AxisFormat;
  YAxisTemplate?: string;
}

export interface MetricTarget {
  PrometheusQuery: string;
  LegendTemplate?: string;
}

// this lib is dope
// https://github.com/grafana/grafana/blob/009d58c4a228b89046fdae02aa82cf5ff05e5e69/packages/grafana-ui/src/utils/valueFormats/categories.ts
export enum AxisFormat {
  Bytes = "bytes",
  Short = "short",
}

const DefaultMetricGraphs: MetricGraph[] = [
  {
    Title: "Disk Usage",
    Targets: [{
      PrometheusQuery: `sum((node_filesystem_size_bytes{job="node-exporter",fstype!="",instance!=""} - node_filesystem_avail_bytes{job="node-exporter", fstype!=""})) by (instance)`,
      LegendTemplate: "Used: {{ instance }}",
    },
    {
      PrometheusQuery: `sum((node_filesystem_avail_bytes{job="node-exporter",fstype!="",instance!=""})) by (instance)`,
      LegendTemplate: "Available: {{ instance }}",
    }],
    YAxisFormat: AxisFormat.Bytes,
    YAxisTemplate: "{{ value }} bytes",
  },
  {
    Title: "CPU Usage",
    Targets: [{
      PrometheusQuery: `sum(rate(container_cpu_usage_seconds_total{namespace="default",container_name!="POD",pod_name!=""}[5m])) by (pod_name)`,
      LegendTemplate: "{{ pod_name }}"
    }],
    YAxisFormat: AxisFormat.Short,
  },
];

export class MetricStore {
  constructor(private readonly pool: pg.Pool, private readonly params: Params) {}

  async getKotsAppMetricCharts(appId: string): Promise<MetricChart[]> {
    if (!this.params.prometheusAddress) {
      return [];
    }

    // TODO: app metrics

    const endTime = new Date().getTime() / 1000;
    const charts = await Promise.all(DefaultMetricGraphs.map(async (graph: MetricGraph): Promise<MetricChart | void> => {
      try {
        const series = await Promise.all(graph.Targets.map(async (target: MetricTarget): Promise<Series[]> => {
          const duration = graph.DurationSeconds || DefaultQueryDurationSeconds;
          const matrix = await prometheusQueryRange(
            this.params.prometheusAddress,
            target.PrometheusQuery,
            (endTime - duration),
            endTime, duration / DefaultGraphStepPoints,
          );
          return matrix.map((sampleStream: SampleStream): Series => {
            const data = sampleStream.values.map((value): ValuePair => {
              return {
                timestamp: value[0],
                value: value[1],
              };
            })
            // convert this cause graphql...
            const metric = Object.entries(sampleStream.metric).map(([key, value]): Metric => {
              return {
                name: key,
                value: value,
              };
            });
            return {
              legendTemplate: target.LegendTemplate || "",
              metric: metric,
              data: data,
            };
          })
        }));
        return {
          title: graph.Title,
          tickFormat: graph.YAxisFormat || "",
          tickTemplate: graph.YAxisTemplate || "",
          series: ([]).concat.apply([], series),
        };
      } catch(err) {
        // render all graphs that we can, catch errors and return void
        logger.error(`Failed to render graph "${graph.Title}": ${err}`);
        return;
      }
    }));
    // filter void entries
    return charts.filter((value) => !!value) as MetricChart[];
  }
}
interface SampleStream {
  metric: { [ key: string]: string };
	values: [number, number][];
}

async function prometheusQueryRange(address: string, query: string, start: number, end: number, step: number): Promise<SampleStream[]> {
  try {
    const response = await rp({
      method: "GET",
      uri: `${address}/api/v1/query_range`,
      qs: {
        query: query,
        start: start,
        end: end,
        step: step,
      },
      json: true,
    });
    if (response.data.resultType != "matrix") {
      throw new Error(`unexpected response retsult type ${response.data.resultType}`);
    }
    return response.data.result as SampleStream[];
  } catch(err) {
    if (!(err instanceof StatusCodeError)) {
      throw err;
    }
    throw new Error(err.error);
  }
}

// TODO: take this out when Ethan is done deving
// (async () => {
//   const pool = await getPostgresPool();
//   const store = new MetricStore(pool, await Params.getParams());
//   setInterval(async () => {
//     try {
//       const charts = await store.getKotsAppMetricCharts("");
//       console.log(JSON.stringify(charts));
//     } catch (err) {
//       console.log("CATCH", err);
//     }
//   }, 15000);
// })();
