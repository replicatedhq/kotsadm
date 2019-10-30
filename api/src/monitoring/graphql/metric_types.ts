const MetricChart = `
  type MetricChart {
    title: String!
    tickFormat: String
    tickTemplate: String
    series: [Series]!
  }
`;

const Metric = `
  type Metric {
    Name: String!
    Value: String!
  }
`;

const Series = `
  type Series {
    legendFormat: String
    metric: [Metric]!
    data: [ValuePair]!
  }
`;

const ValuePair = `
  type ValuePair {
    timestamp: Float!
    value: Float!
  }
`;

export default [
  MetricChart,
  Series,
  Metric,
  ValuePair,
];
