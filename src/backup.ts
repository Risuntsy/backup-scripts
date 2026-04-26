import { copy, ensureDir } from "@std/fs";
import { basename, dirname, join, relative } from "@std/path";
import { loadConfig, resolveTasks } from "./config.ts";
import { commonParentDir, expandBackupDir } from "./utils/path.ts";
import { getCurrentOs } from "./utils/os.ts";
import { compress } from "./utils/compress.ts";
import { runCommand } from "./utils/command.ts";
import { getLogger, initLogger } from "./utils/logger.ts";
import type { Manifest, ManifestTask } from "./types.ts";


const configPath = Deno.args[0] || "backup.toml";
const logger = getLogger();

await backup(configPath);

async function runBeforeCommands(
    commands: string[],
    sources: string[],
): Promise<void> {
    const firstSrc = sources[0] ?? "";
    const firstSrcIsDir = firstSrc && sources.length === 1 &&
        (await Deno.stat(firstSrc).catch(() => ({
            isDirectory: false,
        }))).isDirectory;
    const cwd = firstSrcIsDir ? firstSrc : undefined;

    logger.debug(`Running before-commands: ${commands}`);

    await runCommands(commands, cwd);
}

async function runCommands(commands: string[], cwd?: string): Promise<void> {
    for (const command of commands) {
        logger.debug(`Executing command: ${command}${cwd ? ` in ${cwd}` : ""}`);
        await runCommand(command, cwd);
    }
}

async function backupCopy(
    sources: string[],
    destPath: string,
    relativeDest: string,
    preserveStructure: boolean,
): Promise<ManifestTask> {
    await ensureDir(destPath);
    const task: ManifestTask = {
        dest: relativeDest,
        compressed: false,
        sources: [],
    };

    const cwd = preserveStructure ? commonParentDir(sources) : undefined;

    for (const src of sources) {
        const srcName = cwd ? relative(cwd, src) : basename(src);
        const targetPath = join(destPath, srcName);
        const storedRelative = join(relativeDest, srcName);

        await ensureDir(dirname(targetPath));
        await copy(src, targetPath, { overwrite: true });
        logger.info(`Copied ${src} -> ${targetPath}`);

        task.sources.push({
            original: src,
            stored: storedRelative,
        });
    }
    return task;
}

async function backupCompress(
    sources: string[],
    destPath: string,
    relativeDest: string,
): Promise<ManifestTask> {
    const destDir = dirname(destPath);
    await ensureDir(destDir);

    const cwd = commonParentDir(sources);
    await compress(sources, destPath, cwd);
    logger.info(`Compressed ${sources.length} item(s) -> ${destPath}`);

    return {
        dest: relativeDest,
        compressed: true,
        compressCwd: cwd,
        sources: sources.map((src) => ({
            original: src,
            stored: relativeDest,
        })),
    };
}

async function processBackupTask(
    task: Awaited<ReturnType<typeof resolveTasks>>[number],
    backupDir: string,
): Promise<ManifestTask | null> {
    try {
        if (task.type === "command") {
            await runCommands(task.commands);
            return null;
        }

        if (task.beforeCommands) {
            await runBeforeCommands(task.beforeCommands, task.src);
        }

        const destPath = join(backupDir, task.dest);

        if (task.isCompress) {
            return await backupCompress(task.src, destPath, task.dest);
        } else {
            return await backupCopy(
                task.src,
                destPath,
                task.dest,
                task.preserveStructure,
            );
        }
    } catch (error) {
        const label = task.type === "command"
            ? "command"
            : `dest: ${task.dest}`;
        throw new Error(`Task failed [${label}]: ${error}`);
    }
}

async function backup(configPath: string) {
    try {
        const config = await loadConfig(configPath);
        const currentOs = await getCurrentOs();
        const date = new Date().toISOString().split("T")[0];
        const backupDir = await expandBackupDir(
            config["backup-dir"],
            currentOs,
            date,
        );

        await ensureDir(backupDir);
        await initLogger(backupDir);

        logger.info(`Starting backup: ${backupDir}`);

        const configDestPath = join(backupDir, basename(configPath));
        await copy(configPath, configDestPath);

        const tasks = await resolveTasks(config);
        logger.info(`Tasks: ${tasks.length} for OS: ${currentOs}`);

        if (tasks.length === 0) {
            logger.warn("No tasks to execute");
            return;
        }

        const results = await Promise.allSettled(
            tasks.map((task) => processBackupTask(task, backupDir)),
        );

        const failures = results.filter((r) => r.status === "rejected");
        const successes = results.filter((r) =>
            r.status === "fulfilled"
        ) as PromiseFulfilledResult<ManifestTask | null>[];

        if (failures.length > 0) {
            logger.error(`Failed ${failures.length}/${tasks.length} tasks`);
            for (const failure of failures) {
                if (failure.status === "rejected") {
                    logger.error(`  ${failure.reason}`);
                }
            }
            Deno.exit(1);
        }

        const manifest: Manifest = {
            version: 1,
            os: currentOs,
            date: date,
            backupDir: backupDir,
            tasks: successes.map((s) => s.value).filter((t): t is ManifestTask =>
                t !== null
            ),
        };

        const manifestPath = join(backupDir, "manifest.json");
        await Deno.writeTextFile(
            manifestPath,
            JSON.stringify(manifest, null, 2),
        );
        logger.info(`Manifest written to: ${manifestPath}`);

        logger.info(`Backup completed: ${successes.length} tasks`);
    } catch (error) {
        logger.error(`Backup failed: ${error}`);
        Deno.exit(1);
    }
}
