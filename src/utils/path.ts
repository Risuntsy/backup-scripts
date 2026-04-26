import { dir } from "@cross/dir";
import { dirname, join, resolve } from "@std/path";
import { exists } from "@std/fs";
import { getLogger } from "./logger.ts";

const HOME_DIR = await dir("home");
const CONFIG_DIR = await dir("config");

const logger = getLogger();

export function expandPath(path: string): string {
    let expanded = path;

    if (expanded.startsWith("~/")) {
        expanded = join(HOME_DIR, expanded.slice(2));
    }

    expanded = expanded.replace(/\$\{HOME\}/g, HOME_DIR);
    const xdgConfigHome = Deno.env.get("XDG_CONFIG_HOME");
    expanded = expanded.replace(
        /\$\{XDG_CONFIG_HOME\}/g,
        xdgConfigHome || join(HOME_DIR, ".config"),
    );
    expanded = expanded.replace(/\$\{CONFIG_HOME\}/g, CONFIG_DIR);

    return resolve(expanded);
}


export async function getFileSize(path: string): Promise<number> {
    try {
        const stat = await Deno.stat(path);
        if (stat.isDirectory) {
            let count = 0;
            for await (const _ of Deno.readDir(path)) {
                count++;
            }
            return count;
        }
        return stat.size;
    } catch {
        return 0;
    }
}


export async function filterValidSources(sources: string[]): Promise<string[]> {
    const validSources: string[] = [];

    for (const src of sources) {
        const expanded = expandPath(src);

        if (!(await exists(expanded))) {
            logger.warn(`Source not found, skipping: ${expanded}`);
            continue;
        }

        const size = await getFileSize(expanded);
        if (size === 0) {
            logger.warn(`Source is empty, skipping: ${expanded}`);
            continue;
        }

        validSources.push(expanded);
    }

    return validSources;
}


export async function expandBackupDir(
    pattern: string,
    os: string,
    date: string,
): Promise<string> {
    let expanded = pattern.replace(/\$\{os\}/g, os).replace(
        /\$\{date\}/g,
        date,
    );

    if (expanded.includes("${count}")) {
        const baseExpanded = expandPath(expanded);
        let count = 1;
        let testPath = baseExpanded.replace(/\$\{count\}/g, String(count));

        while (await exists(testPath)) {
            count++;
            testPath = baseExpanded.replace(/\$\{count\}/g, String(count));
        }

        expanded = expanded.replace(/\$\{count\}/g, String(count));
    }

    return expandPath(expanded);
}

export function commonParentDir(paths: string[]): string {
    if (paths.length === 0) return "/";
    if (paths.length === 1) return dirname(paths[0]);

    const parts = paths[0].split(/[/\\]/);
    let commonParts = parts.slice(0, -1);

    for (let i = 1; i < paths.length; i++) {
        const currentParts = paths[i].split(/[/\\]/);
        let j = 0;
        while (
            j < commonParts.length && j < currentParts.length &&
            commonParts[j] === currentParts[j]
        ) {
            j++;
        }
        commonParts = commonParts.slice(0, j);
        if (commonParts.length === 0) break;
    }

    return commonParts.join("/") || "/";
}
