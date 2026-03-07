import { copy, ensureDir } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { loadConfig, resolveTasks } from "./config.ts";
import { expandBackupDir } from "./utils/path.ts";
import { getCurrentOs } from "./utils/os.ts";
import { compress } from "./utils/compress.ts";
import { runCommand } from "./utils/command.ts";
import { getLogger, initLogger } from "./utils/logger.ts";

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

async function backupCopy(sources: string[], dest: string): Promise<void> {
    const destIsFile = dest.includes(".") && !dest.endsWith("/") &&
        sources.length === 1;

    if (destIsFile) {
        const srcStat = await Deno.stat(sources[0]);
        if (!srcStat.isFile) {
            throw new Error(
                `Cannot copy directory to file destination: ${sources[0]} -> ${dest}`,
            );
        }
        const destDir = dirname(dest);
        await ensureDir(destDir);
        await copy(sources[0], dest, { overwrite: false });
        logger.info(`Copied ${sources[0]} -> ${dest}`);
    } else if (sources.length === 1) {
        const srcStat = await Deno.stat(sources[0]);
        if (srcStat.isFile) {
            await ensureDir(dest);
            const targetPath = join(dest, basename(sources[0]));
            await copy(sources[0], targetPath, { overwrite: false });
            logger.info(`Copied ${sources[0]} -> ${targetPath}`);
        } else {
            await ensureDir(dirname(dest));
            await copy(sources[0], dest, { overwrite: false });
            logger.info(`Copied ${sources[0]} -> ${dest}`);
        }
    } else {
        await ensureDir(dest);
        for (const src of sources) {
            const srcName = basename(src);
            const targetPath = join(dest, srcName);
            await copy(src, targetPath, { overwrite: false });
            logger.info(`Copied ${src} -> ${targetPath}`);
        }
    }
}

async function backupCompress(sources: string[], dest: string): Promise<void> {
    const destDir = dirname(dest);
    await ensureDir(destDir);

    await compress(sources, dest);
    logger.info(`Compressed ${sources.length} item(s) -> ${dest}`);
}

async function processBackupTask(
    task: Awaited<ReturnType<typeof resolveTasks>>[number],
    backupDir: string,
): Promise<void> {
    try {
        if (task.type === "command") {
            await runCommands(task.commands);
            return;
        }

        if (task.beforeCommands) {
            await runBeforeCommands(task.beforeCommands, task.src);
        }

        const destPath = join(backupDir, task.dest);

        if (task.isCompress) {
            await backupCompress(task.src, destPath);
        } else {
            await backupCopy(task.src, destPath);
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
        logger.error(`Backup failed: ${error}`);
        Deno.exit(1);
    }
}
