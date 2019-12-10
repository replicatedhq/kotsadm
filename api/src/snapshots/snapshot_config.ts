export interface SnapshotConfig {
  enabled: boolean;
  schedule: string;
  ttl: string;
  store: SnapshotStore;
}

export enum SnapshotProviders {
  S3AWS = "aws",
  S3Compatible = "s3compatible",
  Azure = "azure",
  Google = "google",
}

export interface SnapshotStoreS3AWS {
  region: string;
  accessKeyID: string;
  accessKeySecret: string;
}

export interface SnapshotStoreS3Compatible extends SnapshotStoreS3AWS {
  endpoint: string;
}

export interface SnapshotStoreAzure {
  resourceGroup: string;
  storageAccount: string;
  subscriptionID: string;
}

export interface SnapshotStore {
  provider: SnapshotProviders;
  bucket: String;
  prefix?: String;
  s3AWS?: SnapshotStoreS3AWS;
  s3Compatible?: SnapshotStoreS3Compatible;
  azure?: SnapshotStoreAzure;
}
