export interface SnapshotConfig {
  enabled: boolean;
  schedule: string;
  ttl: string;
  store: SnapshotStore;
}

export enum SnapshotProvider {
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

export enum AzureCloudName {
  Public = "AzurePublicCloud",
  USGovernment = "AzureUSGovernmentCloud",
  China = "AzureChinaCloud",
  German = "AzureGermanCloud",
}

export interface SnapshotStoreAzure {
  resourceGroup: string;
  storageAccount: string;
  subscriptionID: string;
  tenantID: string;
  clientID: string;
  clientSecret: string;
  cloudName: AzureCloudName;
}

export interface SnapshotStoreGoogle {
  serviceAccount: string;
}

export interface SnapshotStore {
  provider: SnapshotProvider;
  bucket: String;
  prefix?: String;
  s3AWS?: SnapshotStoreS3AWS;
  s3Compatible?: SnapshotStoreS3Compatible;
  azure?: SnapshotStoreAzure;
  google?: SnapshotStoreGoogle;
}
