import { copy, ensureDir, exists } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { parse } from "@std/toml";
import type {
    BackupConfig,
    Manifest,
    ManifestTask,
    Os,
    ResolvedTask,
} from "./types.ts";
import { getCurrentOs, isRestoreCompatible } from "./utils/os.ts";
import { commonParentDir, expandPath } from "./utils/path.ts";
import { extract } from "./utils/compress.ts";
import { getLogger, initLogger } from "./utils/logger.ts";


const logger = getLogger();
const backupDir = Deno.args[0];
await restore(backupDir);

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

async function restoreCopy(
    backupSrc: string,
    originalSrc: string[],
): Promise<void> {
    if (!(await exists(backupSrc))) {
        logger.warn(`Source not found, skipping: ${backupSrc}`);
        return;
    }

    if (originalSrc.length === 1) {
        const restoreDest = originalSrc[0];
        const destDir = dirname(restoreDest);
        await ensureDir(destDir);

        if (await exists(restoreDest)) {
            throw new Error(`Destination already exists: ${restoreDest}`);
        }

        await copy(backupSrc, restoreDest, { overwrite: false });
        logger.info(`Restored ${backupSrc} -> ${restoreDest}`);
    } else {
        for (const originalPath of originalSrc) {
            const srcName = basename(originalPath);
            const backupPath = join(backupSrc, srcName);

            if (!(await exists(backupPath))) {
                logger.warn(`Source not found, skipping: ${backupPath}`);
                continue;
            }

            const destDir = dirname(originalPath);
            await ensureDir(destDir);

            if (await exists(originalPath)) {
                throw new Error(`Destination already exists: ${originalPath}`);
            }

            await copy(backupPath, originalPath, { overwrite: false });
            logger.info(`Restored ${backupPath} -> ${originalPath}`);
        }
    }
}

async function restoreExtract(
    archivePath: string,
    originalSrc: string[],
): Promise<void> {

    if (!(await exists(archivePath))) {
        logger.warn(`Archive not found, skipping: ${archivePath}`);
        return;
    }

    const restoreDest = commonParentDir(originalSrc);
    await ensureDir(restoreDest);

    await extract(archivePath, restoreDest);
    logger.info(`Extracted ${archivePath} -> ${restoreDest}`);
}

async function processRestoreTask(
    task: ResolvedTask,
    backupDir: string,
): Promise<void> {
    if (task.type !== "backup") {
        return;
    }
    try {
        const backupPath = join(backupDir, task.dest);

        if (task.isCompress) {
            await restoreExtract(backupPath, task.src);
        } else {
            // NOTE: In old logic, backupPath is the directory containing the sources.
            // This is actually quite brittle without manifest.
            await restoreCopy(backupPath, task.src);
        }
    } catch (error) {
        throw new Error(`Task failed [dest: ${task.dest}]: ${error}`);
    }
}

async function processManifestTask(
    task: ManifestTask,
    backupDir: string,
): Promise<void> {
    try {
        if (task.compressed) {
            const archivePath = join(backupDir, task.dest);
            const restoreDest = task.compressCwd;
            if (!restoreDest) {
                throw new Error(
                    `Missing compressCwd in manifest for task: ${task.dest}`,
                );
            }
            await ensureDir(restoreDest);
            await extract(archivePath, restoreDest);
            logger.info(`Extracted ${archivePath} -> ${restoreDest}`);
        } else {
            for (const source of task.sources) {
                const backupPath = join(backupDir, source.stored);
                const restoreDest = source.original;

                if (!(await exists(backupPath))) {
                    logger.warn(`Source not found, skipping: ${backupPath}`);
                    continue;
                }

                const destDir = dirname(restoreDest);
                await ensureDir(destDir);

                if (await exists(restoreDest)) {
                    // TODO: maybe add --overwrite flag
                    logger.warn(`Destination already exists, skipping: ${restoreDest}`);
                    continue;
                }

                await copy(backupPath, restoreDest, { overwrite: false });
                logger.info(`Restored ${backupPath} -> ${restoreDest}`);
            }
        }
    } catch (error) {
        throw new Error(`Manifest task failed [dest: ${task.dest}]: ${error}`);
    }
}

function resolveRestoreTasks(
    config: BackupConfig,
    backupOs: Os,
    currentOs: Os,
): ResolvedTask[] {
    const resolved: ResolvedTask[] = [];

    for (const task of config.tasks) {
        if ((task.type ?? "backup") === "command") {
            continue;
        }
        if (task.restore === false) {
            logger.info(`Skipping non-restorable task: ${task.dest}`);
            continue;
        }

        const taskOs = task.os || [];

        if (taskOs.length > 0 && !taskOs.includes(backupOs)) {
            continue;
        }

        if (!isRestoreCompatible(backupOs, currentOs)) {
            logger.warn(
                `Skipping incompatible task: backup OS=${backupOs}, current OS=${currentOs}, dest=${task.dest}`,
            );
            continue;
        }

        const originalDest = task.dest ?? "";
        if (!originalDest) {
            logger.warn("Skipping task with empty destination");
            continue;
        }

        const expandedSources = (task.src ?? []).map(expandPath);

        resolved.push({
            type: "backup",
            src: expandedSources,
            // Keep backup destination path relative to backup directory.
            // Expanding it here breaks restore source path resolution.
            dest: originalDest,
            beforeCommands: [],
            os: taskOs,
            isCompress: originalDest.endsWith(".7z"),
            restore: !!task.restore,
            preserveStructure: task["preserve-structure"] === true,
        });
    }

    return resolved;
}

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

    throw new Error(
        `Cannot detect backup OS from directory name: ${backupDirName}`,
    );
}

async function restore(backupDir: string) {
    try {
        const resolvedBackupDir = expandPath(backupDir);

        if (!(await exists(resolvedBackupDir))) {
            throw new Error(`Backup directory not found: ${resolvedBackupDir}`);
        }

        await initLogger(resolvedBackupDir);

        logger.info(`Starting restore from: ${resolvedBackupDir}`);

        const manifestPath = join(resolvedBackupDir, "manifest.json");
        if (await exists(manifestPath)) {
            logger.info("Found manifest.json, using it for deterministic restore");
            const manifestContent = await Deno.readTextFile(manifestPath);
            const manifest = JSON.parse(manifestContent) as Manifest;

            const results = await Promise.allSettled(
                manifest.tasks.map((task) =>
                    processManifestTask(task, resolvedBackupDir)
                ),
            );

            const failures = results.filter((r) => r.status === "rejected");
            const successes = results.filter((r) => r.status === "fulfilled");

            if (failures.length > 0) {
                logger.error(`Failed ${failures.length}/${manifest.tasks.length} tasks`);
                for (const failure of failures) {
                    if (failure.status === "rejected") {
                        logger.error(`  ${failure.reason}`);
                    }
                }
                Deno.exit(1);
            }

            logger.info(`Restore completed: ${successes.length} tasks`);
            return;
        }

        logger.warn(
            "manifest.json not found, falling back to legacy restore (may be unreliable)",
        );

        const config = await loadBackupConfig(resolvedBackupDir);
        const backupDirName = basename(resolvedBackupDir);
        const backupOs = detectBackupOs(backupDirName);
        const currentOs = await getCurrentOs();

        logger.info(`OS: ${backupOs} -> ${currentOs}`);

        const tasks = resolveRestoreTasks(config, backupOs, currentOs);
        logger.info(`Tasks: ${tasks.length} for restore`);

        if (tasks.length === 0) {
            logger.warn("No tasks to execute");
            return;
        }

        const results = await Promise.allSettled(
            tasks.map((task) => processRestoreTask(task, resolvedBackupDir)),
        );

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
        logger.error(`Restore failed: ${error}`);
        Deno.exit(1);
    }
}

if (Deno.args.length === 0) {
    logger.error("Usage: deno task restore <backup-directory>");
    Deno.exit(1);
}
