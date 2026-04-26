import { getCurrentOs } from "./os.ts";
import { getLogger } from "./logger.ts";
import { getTextDecoder } from "./constants.ts";
import { relative } from "@std/path";

const textDecoder = getTextDecoder();

let sevenZipCommand: string | null = null;

export async function get7zipCommand(): Promise<string> {
    if (sevenZipCommand) {
        return sevenZipCommand;
    }

    const os = await getCurrentOs();
    const command = os === "darwin" ? "7zz" : "7z";

    // Check if the command exists
    const checkCommand = new Deno.Command(command, {
        args: ["--help"],
        stdout: "null",
        stderr: "null",
    });

    try {
        await checkCommand.output();
        sevenZipCommand = command;
        return sevenZipCommand;
    } catch {
        throw new Error(
            `7-Zip command '${command}' not found. Please install it (e.g., 'brew install sevenzip' on macOS or 'sudo apt install p7zip-full' on Linux).`,
        );
    }
}

export function set7zipCommand(command: string) {
    sevenZipCommand = command;
}

export async function compress(
    sources: string[],
    dest: string,
    cwd?: string,
): Promise<void> {
    const cmd = await get7zipCommand();

    const finalSources = cwd
        ? sources.map((src) => relative(cwd, src))
        : sources;

    const command = new Deno.Command(cmd, {
        args: ["a", dest, ...finalSources],
        cwd,
        stdout: "piped",
        stderr: "piped",
    });

    const { code, stderr } = await command.output();

    if (code === 1) {
        const logger = getLogger();
        logger.warn(`7z compression warning: ${textDecoder.decode(stderr)}`);
    } else if (code >= 2) {
        throw new Error(`7z compression failed: ${textDecoder.decode(stderr)}`);
    }
}

export async function extract(src: string, dest: string): Promise<void> {
    const cmd = await get7zipCommand();

    const command = new Deno.Command(cmd, {
        args: ["x", src, `-o${dest}`, "-y"],
        stdout: "piped",
        stderr: "piped",
    });

    const { code, stderr } = await command.output();

    if (code === 1) {
        const logger = getLogger();
        logger.warn(`7z extraction warning: ${textDecoder.decode(stderr)}`);
    } else if (code >= 2) {
        throw new Error(`7z extraction failed: ${textDecoder.decode(stderr)}`);
    }
}
