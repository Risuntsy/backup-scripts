import { getCurrentOs } from "./os.ts";
import { textDecoder } from "./constants.ts";
import { getLogger } from "./logger.ts";

let sevenZipCommand: string | null = null;

export async function get7zipCommand(): Promise<string> {
    if (sevenZipCommand) {
        return sevenZipCommand;
    }

    const os = await getCurrentOs();
    sevenZipCommand = os === "darwin" ? "7zz" : "7z";
    return sevenZipCommand;
}


export function set7zipCommand(command: string) {
    sevenZipCommand = command;
}


export async function compress(sources: string[], dest: string): Promise<void> {
    const cmd = await get7zipCommand();

    const command = new Deno.Command(cmd, {
        args: ["a", dest, ...sources],
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
