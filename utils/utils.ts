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

        if (osRelease.includes("NAME=\"Arch Linux\"")) {
        return "archlinux";
    }

    return "linux";


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

export function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'string') {
        return value.trim().length === 0;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length === 0 || value.every(item => isEmpty(item));
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value);
        return entries.length === 0 || entries.every(([_, val]) => isEmpty(val));
    }

    return false;
}

export function isNotEmpty(value: unknown): boolean {
    return !isEmpty(value);
}

export async function getBackupDir(): Promise<string> {
    const CURRENT_DIR = Deno.cwd();
    const baseBackupDir = path.join(path.dirname(CURRENT_DIR), new Date().toISOString().split("T")[0]);

    let counter = 1;
    let backupDir = baseBackupDir;

    while (await exists(backupDir)) {
        backupDir = `${baseBackupDir}_${counter}`;
        counter++;
    }

    return backupDir;
}

export async function command(...commands: string[]): Promise<string> {
    const {stdout, stderr, success, code: _code} = await (new Deno.Command(commands[0], {
        args: commands.slice(1),
        stdout: "piped",
        stderr: "piped",
    }).output());

    if(!success) {
        return Promise.reject(new Error(`Command failed: ${textDecoder.decode(stderr)}`));
    }

    return textDecoder.decode(stdout);
}