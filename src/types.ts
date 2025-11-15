export type Os = "linux" | "nixos" | "archlinux" | "darwin" | "windows";

export interface BackupTask {
    src: string[];
    dest: string;
    "before-command"?: string[];
    os?: Os[];
    restore?: boolean;
}

export interface BackupConfig {
    "backup-dir": string;
    tasks: BackupTask[];
}

export interface ResolvedTask {
    src: string[];
    dest: string;
    beforeCommand: string[];
    os: Os[];
    isCompress: boolean;
    restore: boolean;
}
