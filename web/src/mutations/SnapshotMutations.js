import gql from "graphql-tag";

export const manualSnapshotRaw = `
  mutation manualSnapshot($appId: String!) {
    manualSnapshot(appId: $appId)
  }
`;

export const manualSnapshot = gql(manualSnapshotRaw)