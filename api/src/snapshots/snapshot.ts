import { Phase } from "./velero";

export const snapshotTriggerKey = "kots.io/snapshot-trigger";
export const kotsAppSlugKey = "kots.io/app-slug";
export const kotsAppSequenceKey = "kots.io/app-sequence";
export const snapshotVolumeCountKey = "kots.io/snapshot-volume-count";
export const snapshotVolumeSuccessCountKey = "kots.io/snapshot-volume-success-count";
export const snapshotVolumeBytesKey = "kots.io/snapshot-volume-bytes";

export enum SnapshotTrigger {
  Manual = "manual",
  Schedule = "schedule",
  PreUpgrade = "pre_upgrade",
}

export interface Snapshot {
  name: string;
  status: Phase;
  trigger: SnapshotTrigger|undefined;
  appSlug: string|undefined;
  appVersion: string|undefined;
  started: string;
  finished: string;
  expires: string;
  volumeCount: number;
  volumeSuccessCount: number;
  volumeBytes: number;
}

export interface SnapshotDetail {
  name: string;
  namespaces: Array<string>;
  hooks: Array<SnapshotHook>;
  volumes: Array<SnapshotVolume>;
  errors: Array<SnapshotError>;
  warnings: Array<SnapshotError>;
}

export interface SnapshotError {
  title: string;
  message: string;
  namespace?: string;
}

export interface SnapshotVolume {
  name: string;
  sizeBytes: number;
  doneBytes: number;
  started: string;
  finished: string;
}

export enum SnapshotHookPhase {
  Pre = "pre",
  Post = "post",
}

export interface SnapshotHook {
  namespace: string;
  phase: SnapshotHookPhase,
  podName: string;
  containerName: string;
  command: string;
  hookName: string;
  stdout: string;
  stderr: string;
  started: string;
  finished: string;
  status: "Completed"|"InProgress"|"Failed",
  errors: Array<SnapshotError>,
  warnings: Array<SnapshotError>,
}

export interface RestoreDetail {
  name: string;
  phase: Phase,
  volumes: Array<RestoreVolume>;
  errors: Array<SnapshotError>;
  warnings: Array<SnapshotError>;
}

export interface RestoreVolume {
  name: string;
  phase: Phase,
  podName: string;
  podNamespace: string;
  podVolumeName: string;
  sizeBytes: number;
  doneBytes: number;
  started: string;
  finished?: string;
}
