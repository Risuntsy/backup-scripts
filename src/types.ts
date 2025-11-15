/**
 * Operating system types supported by the backup tool
 */
export type Os = "linux" | "nixos" | "archlinux" | "darwin" | "windows";

/**
 * Single backup task configuration
 */
export interface BackupTask {
    /** Source files/folders to backup (supports variables like ${HOME}, ${XDG_CONFIG_HOME}, ${CONFIG_HOME}) */
    src: string[];
    /** Destination path (directory or .7z file) */
    dest: string;
    /** Commands to run before backup */
    "before-command"?: string[];
    /** Operating systems this task applies to */
    os?: Os[];
}

/**
 * Main configuration structure
 */
export interface BackupConfig {
    /** Backup directory path (supports ${os}, ${date}, ${count} variables) */
    "backup-dir": string;
    /** List of backup tasks */
    tasks: BackupTask[];
}

/**
 * Internal task with resolved paths
 */
export interface ResolvedTask {
    src: string[];
    dest: string;
    beforeCommand: string[];
    os: Os[];
    isCompress: boolean;
}
