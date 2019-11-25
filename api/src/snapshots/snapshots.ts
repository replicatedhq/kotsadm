export interface CreateSnapshotInput {
  maxRetain: number;
  timeout: number;
  autoEnabled?: {
    frequency: string;
  }
  s3ConfigOptions?: {
    bucket: string;
    region: string;
    prefix: string;
    accessKeyId: string;
    accessKeySecret: string;
  }
}