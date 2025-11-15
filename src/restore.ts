import { copy, ensureDir, exists } from "@std/fs";
import { dirname, join } from "@std/path";
import { parse } from "@std/toml";
import type { BackupConfig, Os, ResolvedTask } from "./types.ts";
import { getCurrentOs, isRestoreCompatible } from "./utils/os.ts";
import { expandPath } from "./utils/path.ts";
import { extract } from "./utils/compress.ts";
import { getLogger, initLogger } from "./utils/logger.ts";

/**
 * Load config from backup directory
 */
async function loadBackupConfig(backupDir: string): Promise<BackupConfig> {
    const configPath = join(backupDir, "backup.toml");

    if (!(await exists(configPath))) {
        throw new Error(
            `Config file not found in backup directory: ${configPath}`,
        );
    }

    const content = await Deno.readTextFile(configPath);
    return parse(content) as unknown as BackupConfig;
}

/**
 * Restore by copying from backup to original location
 */
async function restoreCopy(src: string, dest: string): Promise<void> {
    const logger = getLogger();

    if (!(await exists(src))) {
        logger.warn(`Source not found, skipping: ${src}`);
        return;
    }

    const destDir = dirname(dest);
    await ensureDir(destDir);

    if (await exists(dest)) {
        throw new Error(`Destination already exists: ${dest}`);
    }

    await copy(src, dest, { overwrite: false });
    logger.info(`Restored ${src} -> ${dest}`);
}

/**
 * Restore by extracting 7z archive
 */
async function restoreExtract(src: string, dest: string): Promise<void> {
    const logger = getLogger();

    if (!(await exists(src))) {
        logger.warn(`Archive not found, skipping: ${src}`);
        return;
    }

    const destDir = dirname(dest);
    await ensureDir(destDir);

    await extract(src, destDir);
    logger.info(`Extracted ${src} -> ${destDir}`);
}

/**
 * Process a single restore task
 */
async function processRestoreTask(
    task: ResolvedTask,
    backupDir: string,
): Promise<void> {
    try {
        // Source is in backup directory
        const srcPath = join(backupDir, task.dest);

        // Destination is the first item in task.src (original location)
        const destPath = task.src[0];

        // Execute restore
        if (task.isCompress) {
            await restoreExtract(srcPath, destPath);
        } else {
            await restoreCopy(srcPath, destPath);
        }
    } catch (error) {
        throw new Error(`Task failed [src: ${task.dest}]: ${error}`);
    }
}

/**
 * Resolve tasks for restore (similar to backup but checks compatibility)
 */
function resolveRestoreTasks(
    config: BackupConfig,
    backupOs: Os,
    currentOs: Os,
): ResolvedTask[] {
    const logger = getLogger();
    const resolved: ResolvedTask[] = [];

    for (const task of config.tasks) {
        // Check if task is compatible with both backup OS and current OS
        const taskOs = task.os || [];

        // Skip if task doesn't match backup OS (shouldn't happen, but safety check)
        if (taskOs.length > 0 && !taskOs.includes(backupOs)) {
            continue;
        }

        // Check restore compatibility
        if (!isRestoreCompatible(backupOs, currentOs)) {
            logger.warn(
                `Skipping incompatible task: backup OS=${backupOs}, current OS=${currentOs}, dest=${task.dest}`,
            );
            continue;
        }

        // Expand paths
        const expandedSources = task.src.map(expandPath);
        const expandedDest = expandPath(task.dest);

        resolved.push({
            src: expandedSources,
            dest: expandedDest,
            beforeCommand: [],
            os: taskOs,
            isCompress: expandedDest.endsWith(".7z"),
        });
    }

    return resolved;
}

/**
 * Detect backup OS from backup directory name or config
 */
function detectBackupOs(backupDirName: string): Os {
    const lowerName = backupDirName.toLowerCase();

    if (lowerName.includes("darwin") || lowerName.includes("macos")) {
        return "darwin";
    }
    if (lowerName.includes("windows") || lowerName.includes("win")) {
        return "windows";
    }
    if (lowerName.includes("nixos")) {
        return "nixos";
    }
    if (lowerName.includes("archlinux") || lowerName.includes("arch")) {
        return "archlinux";
    }
    if (lowerName.includes("linux")) {
        return "linux";
    }

    // Default to current OS if cannot detect
    throw new Error(
        `Cannot detect backup OS from directory name: ${backupDirName}`,
    );
}

/**
 * Main restore function
 */
async function restore(backupDir: string) {
    try {
        // Resolve backup directory path
        const resolvedBackupDir = expandPath(backupDir);

        if (!(await exists(resolvedBackupDir))) {
            throw new Error(`Backup directory not found: ${resolvedBackupDir}`);
        }

        // Initialize logger in backup directory
        await initLogger(resolvedBackupDir);
        const logger = getLogger();

        logger.info(`Starting restore from: ${resolvedBackupDir}`);

        // Load config from backup
        const config = await loadBackupConfig(resolvedBackupDir);

        // Detect backup OS and get current OS
        const backupDirName = dirname(resolvedBackupDir);
        const backupOs = detectBackupOs(backupDirName);
        const currentOs = await getCurrentOs();

        logger.info(`OS: ${backupOs} -> ${currentOs}`);

        // Resolve tasks
        const tasks = await resolveRestoreTasks(config, backupOs, currentOs);
        logger.info(`Tasks: ${tasks.length} for restore`);

        if (tasks.length === 0) {
            logger.warn("No tasks to execute");
            return;
        }

        // Execute tasks in parallel
        const results = await Promise.allSettled(
            tasks.map((task) =>
                processRestoreTask(task, resolvedBackupDir)
            ),
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

        logger.info(`Restore completed: ${successes.length} tasks`);
    } catch (error) {
        const logger = getLogger();
        logger.error(`Restore failed: ${error}`);
        Deno.exit(1);
    }
}

// Entry point
if (Deno.args.length === 0) {
    console.error("Usage: deno task restore <backup-directory>");
    Deno.exit(1);
}

const backupDir = Deno.args[0];
await restore(backupDir);
