export interface CreateSnapshotInput {
  maxRetain: number;
  timeout: number;
  autoEnabled?: AutoSnapshotOptions;
  s3ConfigOptions: SnapshotS3Options;
}

export interface AutoSnapshotOptions {
  frequency: string;
}

export interface SnapshotS3Options {
  bucket: string;
  region: string;
  prefix: string;
  accessKeyId: string;
  accessKeySecret: string;
}
