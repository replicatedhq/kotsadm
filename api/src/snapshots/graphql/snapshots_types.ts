const CreateSnapshotInput = `
  input CreateSnapshotInput {
    maxRetain: Int!
    timeout: Int!
    autoEnabled: AutoSnapshotOptions
    s3ConfigOptions: SnapshotS3Options
  }
`;

const AutoSnapshotOptions = `
  type AutoSnapshotOptions {
    frequency: String!
  }
`;

const SnapshotS3Options = `
  type SnapshotS3Options {
    bucket: String!
    region: String!
    prefix: String
    accessKeyId: String
    accessKeySecret: String  
  }
`;

export default [
  CreateSnapshotInput,
  AutoSnapshotOptions,
  SnapshotS3Options
]
