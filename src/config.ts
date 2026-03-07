import { parse } from "@std/toml";
import { exists } from "@std/fs";
import { resolve } from "@std/path";
import type { BackupConfig, BackupTask, Os, ResolvedTask } from "./types.ts";
import { expandPath, filterValidSources } from "./utils/path.ts";
import { getCurrentOs, isOsCompatible } from "./utils/os.ts";
import { getLogger } from "./utils/logger.ts";

const logger = getLogger();

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
        const taskType = task.type ?? "backup";
        if (taskType === "command") {
            if (
                !task.commands || !Array.isArray(task.commands) ||
                task.commands.length === 0
            ) {
                throw new Error(
                    `Task ${
                        i + 1
                    }: type = "command" requires commands (non-empty array)`,
                );
            }
        } else {
            if (
                !task.src || !Array.isArray(task.src) || task.src.length === 0
            ) {
                throw new Error(
                    `Task ${
                        i + 1
                    }: src is required and must be a non-empty array`,
                );
            }
            if (!task.dest) {
                throw new Error(`Task ${i + 1}: dest is required`);
            }
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

    const taskType = task.type ?? "backup";
    if (taskType === "command") {
        return {
            type: "command",
            os: taskOs,
            commands: task.commands!,
        };
    }

    const src = task.src;
    const dest = task.dest;
    if (!src || src.length === 0 || !dest) {
        throw new Error(
            `Task: '${JSON.stringify(task)}' src and dest are required`,
        );
    }
    const expandedSources = src.map(expandPath);
    const validSources = task["filter-source"] === false
        ? expandedSources
        : await filterValidSources(expandedSources);

    if (validSources.length === 0) {
        logger.warn(`Task: '${JSON.stringify(task)}' has no valid sources`);
        return null;
    }

    return {
        type: "backup",
        src: validSources,
        dest,
        beforeCommands: task["before-command"],
        os: taskOs,
        isCompress: dest.endsWith(".7z"),
        restore: task.restore !== false,
    };
}

export async function resolveTasks(
    config: BackupConfig,
): Promise<ResolvedTask[]> {
    const currentOs = await getCurrentOs();
    return (await Promise.all(
        config.tasks.map((task) => resolveTask(task, currentOs)),
    )).filter((task) => task !== null);
}
