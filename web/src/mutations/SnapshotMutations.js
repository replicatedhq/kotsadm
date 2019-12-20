import gql from "graphql-tag";

export const createSnapshotRaw = `
  mutation createSnapshot($appId: String!, $payload: SnapshotInput) {
    createSnapshot(appId: $appId, payload: $payload) {
      id
    }
  }
`;

export const createSnapshot = gql(createSnapshotRaw)