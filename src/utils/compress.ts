import { getCurrentOs } from "./os.ts";
import { textDecoder } from "./constants.ts";

let sevenZipCommand: string | null = null;

/**
 * Get the 7zip command for the current OS
 */
export async function get7zipCommand(): Promise<string> {
    if (sevenZipCommand) {
        return sevenZipCommand;
    }

    const os = await getCurrentOs();
    sevenZipCommand = os === "darwin" ? "7zz" : "7z";
    return sevenZipCommand;
}

/**
 * Set custom 7zip command (for configuration override)
 */
export function set7zipCommand(command: string) {
    sevenZipCommand = command;
}

/**
 * Compress files/folders to a 7z archive
 * Ignores warnings from 7z but throws on actual errors
 */
export async function compress(sources: string[], dest: string): Promise<void> {
    const cmd = await get7zipCommand();

    const command = new Deno.Command(cmd, {
        args: ["a", dest, ...sources],
        stdout: "piped",
        stderr: "piped",
    });

    const { code, stderr } = await command.output();

    // 7z exit codes:
    // 0 = success
    // 1 = warning (non-critical, e.g., file in use)
    // 2+ = error
    if (code >= 2) {
        throw new Error(`7z compression failed: ${textDecoder.decode(stderr)}`);
    }
    // Exit code 1 (warnings) are ignored
}

/**
 * Extract a 7z archive to a destination folder
 * Ignores warnings from 7z but throws on actual errors
 */
export async function extract(src: string, dest: string): Promise<void> {
    const cmd = await get7zipCommand();

    const command = new Deno.Command(cmd, {
        args: ["x", src, `-o${dest}`, "-y"],
        stdout: "piped",
        stderr: "piped",
    });

    const { code, stderr } = await command.output();

    // 7z exit codes: 0 = success, 1 = warning, 2+ = error
    if (code >= 2) {
        throw new Error(`7z extraction failed: ${textDecoder.decode(stderr)}`);
    }
    // Exit code 1 (warnings) are ignored
}
