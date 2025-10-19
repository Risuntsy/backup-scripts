import { copy, exists } from "@std/fs";
import { join, basename } from "@std/path";

import { BACKUP_DIR, COMMAND, CURRENT_OS, logger, textDecoder } from "./configs/configs.ts";
import { BACKUP_CONFIG } from "./common/backup.ts";
import { Callback, Optional } from "./types.ts";
import { withLogging } from "./configs/log.ts";
import { execRunnable, isEmpty } from "./utils/utils.ts";
import { AsyncChain } from "./utils/async_utils.ts";

async function backupCompressFolder(src: string[], dest: string, throwError: boolean = false) {
    // Check if all source paths exist
    const existingPaths: string[] = await AsyncChain.from(src)
        .filter(async path => await exists(path))
        .toArray();

    if (isEmpty(existingPaths)) {
        logger.warn(`no valid directories found to compress for ${src.join(", ")}`);
        return;
    }

    const compressTask = async () => {
        const result = await new Deno.Command(COMMAND["7z"], {
            args: ["a", dest, ...existingPaths],
        }).output();

        if (!result.success) {
            if (throwError) {
                throw new Error(
                    `Failed to compress ${existingPaths.join(", ")}, error: ${textDecoder.decode(result.stderr)}`.trim()
                );
            } else {
                logger.warn(
                    `Failed to compress ${existingPaths.join(", ")}, error: ${textDecoder.decode(result.stderr)}`.trim()
                );
            }
        }
    };

    await withLogging(compressTask, `compress ${existingPaths.join(", ")} to ${dest}`);
}

async function backupCopy(src: string[], dest: string) {
    const existingPaths: string[] = await AsyncChain.from(src)
        .filter(async path => await exists(path))
        .toArray();

    if (isEmpty(existingPaths)) {
        logger.warn(`no valid directories found to copy for ${src.join(", ")}`);
        return;
    }

    const copyTask = async () => {
        if (existingPaths.length === 1 && src.length === 1) {
            await copy(existingPaths[0], dest);
            return;
        }

        const tasks = existingPaths.map(async path => {
            const srcName = basename(path);
            const targetPath = join(dest, srcName);

            if (await exists(targetPath)) {
                throw new Error(`Destination subdirectory already exists: ${targetPath}`);
            }

            await copy(path, targetPath);
        });

        await Promise.allSettled(tasks);
    };

    await withLogging(copyTask, `copy ${existingPaths.join(", ")} to ${dest}`);
}

async function doBackup() {
    const backupRunnable = async () => {
        const tasks: Promise<void>[] = [];

        const runBefore = async (before: Optional<Callback>[] | undefined, paths: string[]) => {
            if (!before || before.length === 0 || !paths || paths.length === 0) {
                return;
            }

            for (const callback of before) {
                await callback?.({
                    target: paths,
                    os: CURRENT_OS,
                });
            }
        };

        const runCompress = async (paths: string[], dest: string, before: Optional<Callback>[] | undefined) => {
            await runBefore(before, paths);
            await backupCompressFolder(paths, join(BACKUP_DIR, dest));
        };

        const runCopy = async (paths: string[], dest: string, before: Optional<Callback>[] | undefined) => {
            await runBefore(before, paths);
            await backupCopy(paths, join(BACKUP_DIR, dest));
        };

        for (const config of BACKUP_CONFIG) {
            if (config.type === "task") {
                tasks.push(execRunnable(config.backup));
            } else {
                tasks.push(
                    config.dest.includes(".7z")
                        ? runCompress(config.paths, config.dest, config.before)
                        : runCopy(config.paths, config.dest, config.before)
                );
            }
        }

        await Promise.all(tasks);
    };

    await withLogging(backupRunnable, "backup");
}

await doBackup();
