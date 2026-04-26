import { parse } from "@std/toml";
import { exists } from "@std/fs";
import { resolve } from "@std/path";
import { z } from "zod";
import type { BackupConfig, BackupTask, Os, ResolvedTask } from "./types.ts";
import { expandPath, filterValidSources } from "./utils/path.ts";
import { getCurrentOs, isOsCompatible } from "./utils/os.ts";
import { getLogger } from "./utils/logger.ts";

const logger = getLogger();

const OsSchema = z.enum([
    "linux",
    "nixos",
    "archlinux",
    "darwin",
    "windows",
]);

const BackupTaskSchemaObject = z.object({
    type: z.enum(["backup", "command"]).optional(),
    src: z.array(z.string()).optional(),
    dest: z.string().optional(),
    "before-command": z.array(z.string()).optional(),
    os: z.array(OsSchema).optional(),
    restore: z.boolean().optional(),
    "filter-source": z.boolean().optional(),
    "preserve-structure": z.boolean().optional(),
    commands: z.array(z.string()).optional(),
});

type BackupTaskSchemaType = z.infer<typeof BackupTaskSchemaObject>;

const BackupTaskSchema = BackupTaskSchemaObject.refine(
    (data: BackupTaskSchemaType) => {
        const type = data.type ?? "backup";
        if (type === "command") {
            return !!data.commands && data.commands.length > 0;
        } else {
            return !!data.src && data.src.length > 0 && !!data.dest;
        }
    },
    {
        message:
            'Task of type "command" requires "commands", while "backup" requires "src" and "dest"',
    },
);

const BackupConfigSchema = z.object({
    "backup-dir": z.string(),
    tasks: z.array(BackupTaskSchema),
});

export async function loadConfig(configPath: string): Promise<BackupConfig> {
    const resolvedPath = resolve(configPath);

    if (!(await exists(resolvedPath))) {
        throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    const content = await Deno.readTextFile(resolvedPath);
    const parsed = parse(content);

    const result = BackupConfigSchema.safeParse(parsed);
    if (!result.success) {
        const errorMessages = result.error.errors.map((err: z.ZodIssue) =>
            `${err.path.join(".")}: ${err.message}`
        ).join("\n");
        throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }

    return result.data as unknown as BackupConfig;
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
        preserveStructure: task["preserve-structure"] === true,
    };
}

export async function resolveTasks(
    config: BackupConfig,
): Promise<ResolvedTask[]> {
    const currentOs = await getCurrentOs();
    return (await Promise.all(
        config.tasks.map((task) => resolveTask(task, currentOs)),
    )).filter((task) => task !== null) as ResolvedTask[];
}
