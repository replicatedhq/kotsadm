const SnapshotConfig = `
  type SnapshotConfig {
    enabled: Boolean
    schedule: String
    ttl: String
    store: Store
  }
`;

const SnapshotStore = `
  type SnapshotStore {
    provider: String
    bucket: String
    prefix: String
    s3AWS: s3AWS
    azure: Azure
    s3Compatible: S3Compatible
  }
`;

const SnapshotStoreS3AWS = `
  type SnapshotStoreS3AWS {
    region: String
    accessKeyID: String
    accessKeySecret: String
  }
`;


const SnapshotStoreS3Compatible = `
  type SnapshotStoreS3Compatible {
    endpoint: String
    region: String
    accessKeyID: String
    accessKeySecret: String
  }
`;

const SnapshotStoreAzure = `
  type SnapshotStoreAzure {
    resourceGroup: String
    storageAccount: String
    subscriptionID: String
  }
`;

const Snapshot = `
  type Snapshot {
    name: String
    status: String
    trigger: String
    appVersion: String
    started: String
    finished: String
    expires: String
    volumeCount: Int
    volumeSuccessCount: Int
    volumeBytes: Int
  }
`

const SnapshotDetail = `
  type SnapshotDetail {
    namespaces: [String]
    hooks: [Hook]
    volumes: [Volume]
    errors: [SnapshotError]
    warnings: [SnapshotError]
  }
`

const SnapshotError = `
  type SnapshotError {
    title: String
    message: String
  }
`;

const SnapshotVolume = `
  type SnapshotVolume {
    name: String
    sizeBytes: Number
    doneBytes: Number
    started: String
    finished: String
  }
`

const SnapshotHook = `
  type SnapshotHook {
    name: String
    phase: String
    command: String
    container: String
    execs: [SnapshotHookExec]
  }
`

const SnapshotHookExec = `
  type SnapshotHookExec {
    name: String
    started: String
    finished: String
    stdout: String
    stderr: String
    warning: SnapshotError
    error: SnapshotError
  }
`
