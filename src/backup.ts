import { copy, ensureDir } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { loadConfig, resolveTasks } from "./config.ts";
import { expandBackupDir } from "./utils/path.ts";
import { getCurrentOs } from "./utils/os.ts";
import { compress } from "./utils/compress.ts";
import { getLogger, initLogger } from "./utils/logger.ts";
import { textDecoder } from "./utils/constants.ts";

/**
 * Execute before-commands for a task
 */
async function runBeforeCommands(commands: string[]): Promise<void> {
    const logger = getLogger();

    for (const command of commands) {
        try {
            logger.info(`Executing before-command: ${command}`);

            const parts = command.split(/\s+/);
            const cmd = new Deno.Command(parts[0], {
                args: parts.slice(1),
                stdout: "piped",
                stderr: "piped",
            });

            const { code, stderr } = await cmd.output();

            if (code !== 0) {
                throw new Error(
                    `Command exited with code ${code}: ${
                        textDecoder.decode(stderr)
                    }`,
                );
            }
        } catch (error) {
            throw new Error(`Before-command failed: ${command}\n${error}`);
        }
    }
}

/**
 * Backup files by copying to destination
 */
async function backupCopy(sources: string[], dest: string): Promise<void> {
    const logger = getLogger();
    await ensureDir(dest);

    if (sources.length === 1) {
        // Single source - copy directly to dest
        const srcName = basename(sources[0]);
        const targetPath = join(dest, srcName);
        await copy(sources[0], targetPath, { overwrite: false });
        logger.info(`Copied ${sources[0]} -> ${targetPath}`);
    } else {
        // Multiple sources - copy each to dest
        for (const src of sources) {
            const srcName = basename(src);
            const targetPath = join(dest, srcName);
            await copy(src, targetPath, { overwrite: false });
            logger.info(`Copied ${src} -> ${targetPath}`);
        }
    }
}

/**
 * Backup files by compressing to 7z archive
 */
async function backupCompress(sources: string[], dest: string): Promise<void> {
    const logger = getLogger();
    const destDir = dirname(dest);
    await ensureDir(destDir);

    await compress(sources, dest);
    logger.info(`Compressed ${sources.length} item(s) -> ${dest}`);
}

/**
 * Process a single backup task
 */
async function processBackupTask(
    task: Awaited<ReturnType<typeof resolveTasks>>[number],
    backupDir: string,
): Promise<void> {
    try {
        // Run before commands
        if (task.beforeCommand.length > 0) {
            await runBeforeCommands(task.beforeCommand);
        }

        // Calculate destination path
        const destPath = join(backupDir, task.dest);

        // Execute backup
        if (task.isCompress) {
            await backupCompress(task.src, destPath);
        } else {
            await backupCopy(task.src, destPath);
        }
    } catch (error) {
        throw new Error(`Task failed [dest: ${task.dest}]: ${error}`);
    }
}

/**
 * Main backup function
 */
async function backup(configPath: string) {
    try {
        // Load configuration
        const config = await loadConfig(configPath);

        // Get current OS and date
        const currentOs = await getCurrentOs();
        const date = new Date().toISOString().split("T")[0];

        // Resolve backup directory
        const backupDir = await expandBackupDir(
            config["backup-dir"],
            currentOs,
            date,
        );

        // Create backup directory
        await ensureDir(backupDir);

        // Initialize logger in backup directory
        await initLogger(backupDir);
        const logger = getLogger();

        logger.info(`Starting backup: ${backupDir}`);

        // Copy config file to backup directory
        const configDestPath = join(backupDir, basename(configPath));
        await copy(configPath, configDestPath);

        // Resolve tasks
        const tasks = await resolveTasks(config);
        logger.info(`Tasks: ${tasks.length} for OS: ${currentOs}`);

        if (tasks.length === 0) {
            logger.warn("No tasks to execute");
            return;
        }

        // Execute tasks in parallel
        const results = await Promise.allSettled(
            tasks.map((task) => processBackupTask(task, backupDir)),
        );

        // Check results
        const failures = results.filter((r) => r.status === "rejected");
        const successes = results.filter((r) => r.status === "fulfilled");

        if (failures.length > 0) {
            logger.error(`Failed ${failures.length}/${tasks.length} tasks`);
            for (const failure of failures) {
                if (failure.status === "rejected") {
                    logger.error(`  ${failure.reason}`);
                }
            }
            Deno.exit(1);
        }

        logger.info(`Backup completed: ${successes.length} tasks`);
    } catch (error) {
        const logger = getLogger();
        logger.error(`Backup failed: ${error}`);
        Deno.exit(1);
    }
}

// Entry point
const configPath = Deno.args[0] || "backup.toml";
await backup(configPath);
