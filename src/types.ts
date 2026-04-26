export type Os = "linux" | "nixos" | "archlinux" | "darwin" | "windows";

export type TaskType = "backup" | "command";

export interface BackupTask {
    type?: TaskType;
    src?: string[];
    dest?: string;
    "before-command"?: string[];
    os?: Os[];
    restore?: boolean;
    "filter-source"?: boolean;
    "preserve-structure"?: boolean;
    commands?: string[];
}

export interface BackupConfig {
    "backup-dir": string;
    tasks: BackupTask[];
}

interface ResolvedTaskBase {
    os: Os[];
}

export interface ResolvedBackupTask extends ResolvedTaskBase {
    type: "backup";
    src: string[];
    dest: string;
    isCompress: boolean;
    restore: boolean;
    preserveStructure: boolean;
    beforeCommands?: string[];
}

export interface ResolvedCommandTask extends ResolvedTaskBase {
    type: "command";
    commands: string[];
}

export type ResolvedTask = ResolvedBackupTask | ResolvedCommandTask;

export interface ManifestSource {
    original: string;
    stored: string;
}

export interface ManifestTask {
    dest: string;
    compressed: boolean;
    compressCwd?: string;
    sources: ManifestSource[];
}

export interface Manifest {
    version: number;
    os: Os;
    date: string;
    backupDir: string;
    tasks: ManifestTask[];
}
