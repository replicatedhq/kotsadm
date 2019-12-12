export enum SnapshotStatus {
  New = "New",
  FailedValidation = "FailedValidation",
  InProgress = "InProgress",
  Completed = "Completed",
  PartiallyFailed = "PartiallyFailed",
  Failed = "Failed",
}

export enum SnapshotTrigger {
  Manual = "manual",
  Schedule = "schedule",
  PreUpgrade = "pre_upgrade",
}

export interface Snapshot {
  name: string;
  status: SnapshotStatus;
  trigger: SnapshotTrigger;
  appVersion: string;
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
  name: string;
  phase: SnapshotHookPhase;
  command: string;
  selector: string;
  container: string;
  execs: Array<SnapshotHookExec>;
}

export interface SnapshotHookExec {
  name: string;
  started: string;
  finished: string;
  stdout: string;
  stderr: string;
  warning: SnapshotError;
  error: SnapshotError;
}

export interface RestoreDetail {
  name: string;
  phase: SnapshotStatus,
  volumes: Array<RestoreVolume>;
  errors: Array<SnapshotError>;
  warnings: Array<SnapshotError>;
}

export interface RestoreVolume {
  name: string;
  phase: SnapshotStatus,
  podName: string;
  podNamespace: string;
  podVolumeName: string;
  sizeBytes: number;
  doneBytes: number;
  started: string;
  finished?: string;
}
