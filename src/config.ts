import { parse } from "@std/toml";
import { exists } from "@std/fs";
import { resolve } from "@std/path";
import type { BackupConfig, BackupTask, Os, ResolvedTask } from "./types.ts";
import { expandPath, filterValidSources } from "./utils/path.ts";
import { getCurrentOs, isOsCompatible } from "./utils/os.ts";

/**
 * Load and parse the backup configuration file
 */
export async function loadConfig(configPath: string): Promise<BackupConfig> {
    const resolvedPath = resolve(configPath);

    if (!(await exists(resolvedPath))) {
        throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    const content = await Deno.readTextFile(resolvedPath);
    const config = parse(content) as unknown as BackupConfig;

    // Validate configuration
    if (!config["backup-dir"]) {
        throw new Error("Configuration missing required field: backup-dir");
    }

    if (!config.tasks || !Array.isArray(config.tasks)) {
        throw new Error(
            "Configuration missing required field: tasks (must be an array)",
        );
    }

    // Validate each task
    for (let i = 0; i < config.tasks.length; i++) {
        const task = config.tasks[i];
        if (!task.src || !Array.isArray(task.src) || task.src.length === 0) {
            throw new Error(
                `Task ${i + 1}: src is required and must be a non-empty array`,
            );
        }
        if (!task.dest) {
            throw new Error(`Task ${i + 1}: dest is required`);
        }
    }

    return config;
}

/**
 * Resolve a task - expand paths, filter by OS, validate sources
 */
export async function resolveTask(
    task: BackupTask,
    currentOs: Os,
): Promise<ResolvedTask | null> {
    // Check OS compatibility
    const taskOs = task.os || [];
    if (!isOsCompatible(currentOs, taskOs)) {
        return null;
    }

    // Expand and filter source paths
    const expandedSources = task.src.map(expandPath);
    const validSources = await filterValidSources(expandedSources);

    // Skip task if no valid sources
    if (validSources.length === 0) {
        return null;
    }

    // Expand destination path
    const expandedDest = expandPath(task.dest);

    return {
        src: validSources,
        dest: expandedDest,
        beforeCommand: task["before-command"] || [],
        os: taskOs,
        isCompress: expandedDest.endsWith(".7z"),
    };
}

/**
 * Resolve all tasks in the configuration
 */
export async function resolveTasks(
    config: BackupConfig,
): Promise<ResolvedTask[]> {
    const currentOs = await getCurrentOs();
    const resolved: ResolvedTask[] = [];

    for (const task of config.tasks) {
        const resolvedTask = await resolveTask(task, currentOs);
        if (resolvedTask) {
            resolved.push(resolvedTask);
        }
    }

    return resolved;
}
