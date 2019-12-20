import gql from "graphql-tag";

export const listSnapshotsRaw = `
  query listSnapshots($slug: String!) {
    listSnapshots(slug: $slug) {
      name
      status
      trigger
      appVersion
      started
      finished
      expires
      volumeCount
      volumeSuccessCount
      volumeBytes
    }
  }
`;

export const listSnapshots = gql(listSnapshotsRaw);
