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

export const snapshotConfigRaw = `
  query snapshotConfig($slug: String!) {
    snapshotConfig(slug: $slug) {
      autoEnabled
      autoSchedule {
        userSelected
        schedule
      }
      ttl {
        inputValue
        inputTimeUnit
        converted
      }
    }
  }
`;

export const snapshotConfig = gql(snapshotConfigRaw);

export const snapshotSettingsRaw = `
  query snapshotConfig($slug: String!) {
    snapshotConfig(slug: $slug) {
      store {
        provider
        bucket
        path
        s3AWS {
          region
          accessKeyID
          accessKeySecret
        }
        azure {
          tenantID
          resourceGroup
          storageAccount
          subscriptionID
          clientID
          clientSecret
          cloudName
        }
        s3Compatible {
          endpoint
          region
          accessKeyID
          accessKeySecret
        }
        google {
          serviceAccount
        }
      }
    }
  }
`;

export const snapshotSettings = gql(snapshotSettingsRaw);

export const snapshotDetailRaw = `
  query snapshotDetail($slug: String!, $id: String!) {
    snapshotDetail(slug: $slug, id: $id) {
      name
      namespaces
      hooks {
        hookName
        phase
        command
        containerName
        podName
        namespace
        stdout
        stderr
        started
        finished
        warnings {
          title
          message
        }
        errors {
          title
          message
        }
      }
      volumes {
        name
        sizeBytes
        doneBytes
        started
        finished
      }
      errors {
        title
        message
      }
      warnings{
        title
        message
      }
    }
  }
`;

export const snapshotDetail = gql(snapshotDetailRaw);
