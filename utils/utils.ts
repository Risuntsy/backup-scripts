import { exists } from "@std/fs";
import * as path from "@std/path";

import { logger, textDecoder } from "../configs/configs.ts";
import { Optional, Os, Runnable } from "../types.ts";
import { isNullOrUndefined } from "./assert.ts";

export async function ensureDirExists(path: string | URL) {
    try {
        await Deno.mkdir(path, { recursive: true });
    } catch (err) {
        if (!(err instanceof Deno.errors.AlreadyExists)) {
            throw err;
        }
    }
}

export async function ensureDirNotExists(path: string | URL) {
    try {
        const _fileInfo = await Deno.stat(path);
        throw new Error("Directory exists");
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return;
        }
        throw err;
    }
}

export async function cleanDir(target: string[], trashes: Set<string>) {
    for (const t of target) {
        if (!(await exists(t))) {
            logger.warn(`the directory to be cleaned does not exist, skipping: ${t}`);
            continue;
        }
    }

    const tasks: Promise<void>[] = [];

    const dirs = [...target];

    const removedTrashes: string[] = [];

    while (dirs.length) {
        const dir = dirs.shift()!;

        for await (const entry of Deno.readDir(dir)) {
            const absolutePath = path.join(dir, entry.name);
            // logger.info(`Checking ${absolutePath}`);
            if (trashes.has(entry.name)) {
                tasks.push(Deno.remove(absolutePath, { recursive: true }));
                removedTrashes.push(absolutePath);
                continue;
            }

            if (entry.isDirectory) {
                dirs.push(absolutePath);
            }
        }
    }

    await Promise.all(tasks);
    if (removedTrashes.length) {
        logger.info(`Removed trashes:\n${removedTrashes.join("\n")}`);
    }
}

export function execRunnable<T>(runnable?: Optional<Runnable<T>>): Promise<T | void> {
    if (isNullOrUndefined(runnable)) return Promise.resolve();

    let result = runnable!();
    if (!(result instanceof Promise)) {
        result = Promise.resolve(result);
    }

    return result;
}

export async function getCurrentOs() {
    if (Deno.build.os === "windows" || Deno.build.os === "darwin") {
        return Deno.build.os;
    }

    if (Deno.build.os === "linux") {
        return await getLinuxDistribution();
    }

    throw new Error("Unsupported OS");
}

async function getLinuxDistribution(): Promise<Os> {
    const osRelease = textDecoder.decode(
        (
            await new Deno.Command("cat", {
                args: ["/etc/os-release"],
            }).output()
        ).stdout,
    );

    if (osRelease.includes("NAME=NixOS")) {
        return "nixos";
    }

    return "linux";
    // if (osRelease.includes("NAME=\"Arch Linux\"")) {
    //     return "archlinux";
    // }

    // throw new Error("unknown distribution");
}


export async function isDirectory(path: string | URL): Promise<boolean> {
    try {
        const stat = await Deno.stat(path);
        return stat.isDirectory;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}