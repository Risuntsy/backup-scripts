import { dir } from "@cross/dir";
import { join, resolve } from "@std/path";
import { exists } from "@std/fs";

const HOME_DIR = await dir("home");
const CONFIG_DIR = await dir("config");

/**
 * Expand variables in path strings
 * Supports: ${HOME}, ${XDG_CONFIG_HOME}, ${CONFIG_HOME}
 */
export function expandPath(path: string): string {
    let expanded = path;

    // Replace ~ with HOME at the start
    if (expanded.startsWith("~/")) {
        expanded = join(HOME_DIR, expanded.slice(2));
    }

    // Replace variables
    expanded = expanded.replace(/\$\{HOME\}/g, HOME_DIR);
    expanded = expanded.replace(
        /\$\{XDG_CONFIG_HOME\}/g,
        join(HOME_DIR, ".config"),
    );
    expanded = expanded.replace(/\$\{CONFIG_HOME\}/g, CONFIG_DIR);

    return resolve(expanded);
}

/**
 * Check if path exists and get its size
 * Returns 0 if file doesn't exist or is empty
 */
export async function getFileSize(path: string): Promise<number> {
    try {
        const stat = await Deno.stat(path);
        if (stat.isDirectory) {
            return 1; // Directories are considered non-empty
        }
        return stat.size;
    } catch {
        return 0;
    }
}

/**
 * Filter and validate source paths
 * - Skips non-existent paths
 * - Skips empty files (0 bytes)
 */
export async function filterValidSources(sources: string[]): Promise<string[]> {
    const validSources: string[] = [];

    for (const src of sources) {
        const expanded = expandPath(src);

        if (!(await exists(expanded))) {
            continue; // Skip non-existent files silently
        }

        const size = await getFileSize(expanded);
        if (size === 0) {
            continue; // Skip empty files
        }

        validSources.push(expanded);
    }

    return validSources;
}

/**
 * Expand backup directory path with variables
 * Supports: ${os}, ${date}, ${count}
 */
export async function expandBackupDir(
    pattern: string,
    os: string,
    date: string,
): Promise<string> {
    let expanded = pattern.replace(/\$\{os\}/g, os).replace(
        /\$\{date\}/g,
        date,
    );

    // Handle count - find the next available number
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
