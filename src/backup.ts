import { copy, ensureDir } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { loadConfig, resolveTasks } from "./config.ts";
import { expandBackupDir } from "./utils/path.ts";
import { getCurrentOs } from "./utils/os.ts";
import { compress } from "./utils/compress.ts";
import { getLogger, initLogger } from "./utils/logger.ts";
import { textDecoder } from "./utils/constants.ts";

async function runBeforeCommands(commands: string[]): Promise<void> {
    const logger = getLogger();

    logger.debug(`Running before-commands: ${commands}`);

    for (const command of commands) {
        try {
            logger.info(`Executing before-command: ${command}`);

            const needsShell = command.includes("|") || 
                               command.includes(">") || 
                               command.includes("<") ||
                               command.includes("&&") ||
                               command.includes("||") ||
                               command.includes("'") ||
                               command.includes('"');

            let cmd;
            if (needsShell) {
                const currentOs = await getCurrentOs();
                const shell = currentOs === "windows" ? "cmd" : "sh";
                const shellArg = currentOs === "windows" ? "/c" : "-c";
                
                cmd = new Deno.Command(shell, {
                    args: [shellArg, command],
                    stdout: "piped",
                    stderr: "piped",
                });
            } else {
                const parts = command.split(/\s+/);
                cmd = new Deno.Command(parts[0], {
                    args: parts.slice(1),
                    stdout: "piped",
                    stderr: "piped",
                });
            }

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

async function backupCopy(sources: string[], dest: string): Promise<void> {
    const logger = getLogger();
    
    const destIsFile = dest.includes(".") && !dest.endsWith("/") && sources.length === 1;
    
    if (destIsFile) {
        const destDir = dirname(dest);
        await ensureDir(destDir);
        await copy(sources[0], dest, { overwrite: false });
        logger.info(`Copied ${sources[0]} -> ${dest}`);
    } else if (sources.length === 1) {
        await ensureDir(dest);
        const srcStat = await Deno.stat(sources[0]);
        if (srcStat.isFile) {
            const targetPath = join(dest, basename(sources[0]));
            await copy(sources[0], targetPath, { overwrite: false });
            logger.info(`Copied ${sources[0]} -> ${targetPath}`);
        } else {
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
    const logger = getLogger();
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
        if (task.beforeCommand.length > 0) {
            await runBeforeCommands(task.beforeCommand);
        }

        const destPath = join(backupDir, task.dest);

        if (task.isCompress) {
            await backupCompress(task.src, destPath);
        } else {
            await backupCopy(task.src, destPath);
        }
    } catch (error) {
        throw new Error(`Task failed [dest: ${task.dest}]: ${error}`);
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
        const logger = getLogger();

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
        const logger = getLogger();
        logger.error(`Backup failed: ${error}`);
        Deno.exit(1);
    }
}

const configPath = Deno.args[0] || "backup.toml";
await backup(configPath);
