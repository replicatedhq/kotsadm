const SnapshotConfig = `
  type SnapshotConfig {
    enabled: Boolean
    schedule: String
    ttl: String
    store: SnapshotStore
  }
`;

const SnapshotStore = `
  type SnapshotStore {
    provider: String
    bucket: String
    prefix: String
    s3AWS: SnapshotStoreS3AWS
    azure: SnapshotStoreAzure
    s3Compatible: SnapshotStoreS3Compatible
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
    tenantID: String
    resourceGroup: String
    storageAccount: String
    subscriptionID: String
    clientID: String
    clientSecret: String
    cloudName: String
  }
`;

const SnapshotStoreGoogle = `
  type SnapshotStoreGoogle {
    serviceAccount: String
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
    name: String
    namespaces: [String]
    hooks: [SnapshotHook]
    volumes: [SnapshotVolume]
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
    sizeBytes: Int
    doneBytes: Int
    started: String
    finished: String
  }
`;

const SnapshotHook = `
  type SnapshotHook {
    name: String
    phase: String
    command: String
    selector: String
    container: String
    execs: [SnapshotHookExec]
  }
`;

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
`;

const RestoreDetail = `
  type RestoreDetail {
    name: String
    phase: String
    volumes: [RestoreVolume]
    errors: [SnapshotError]
    warnings: [SnapshotError]
  }
`;

const RestoreVolume = `
  type RestoreVolume {
    name: String
    phase: String
    podName: String
    podNamespace: String
    podVolumeName: String
    sizeBytes: Int
    doneBytes: Int
    started: String
    finished: String
  }
`;

export default [
  SnapshotConfig,
  SnapshotStore,
  SnapshotStoreS3AWS,
  SnapshotStoreS3Compatible,
  SnapshotStoreAzure,
  SnapshotStoreGoogle,
  Snapshot,
  SnapshotDetail,
  SnapshotError,
  SnapshotVolume,
  SnapshotHook,
  SnapshotHookExec,
  RestoreDetail,
  RestoreVolume
]
