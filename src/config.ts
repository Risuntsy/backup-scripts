import { parse } from "@std/toml";
import { exists } from "@std/fs";
import { resolve } from "@std/path";
import type { BackupConfig, BackupTask, Os, ResolvedTask } from "./types.ts";
import { expandPath, filterValidSources } from "./utils/path.ts";
import { getCurrentOs, isOsCompatible } from "./utils/os.ts";

export async function loadConfig(configPath: string): Promise<BackupConfig> {
    const resolvedPath = resolve(configPath);

    if (!(await exists(resolvedPath))) {
        throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    const content = await Deno.readTextFile(resolvedPath);
    const config = parse(content) as unknown as BackupConfig;

    if (!config["backup-dir"]) {
        throw new Error("Configuration missing required field: backup-dir");
    }

    if (!config.tasks || !Array.isArray(config.tasks)) {
        throw new Error(
            "Configuration missing required field: tasks (must be an array)",
        );
    }

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

export async function resolveTask(
    task: BackupTask,
    currentOs: Os,
): Promise<ResolvedTask | null> {
    const taskOs = task.os || [];
    if (!isOsCompatible(currentOs, taskOs)) {
        return null;
    }

    const expandedSources = task.src.map(expandPath);
    const validSources = task["filter-source"] === false
        ? await filterValidSources(expandedSources)
        : expandedSources;

    if (validSources.length === 0) {
        return null;
    }

    return {
        src: validSources,
        dest: task.dest,
        beforeCommand: task["before-command"] || [],
        os: taskOs,
        isCompress: task.dest.endsWith(".7z"),
        restore: task.restore !== false,
    };
}

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
