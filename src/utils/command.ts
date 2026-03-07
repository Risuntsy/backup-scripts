import { getTextDecoder } from "./constants.ts";

export async function runCommand(command: string, cwd?: string): Promise<void> {
    const needsShell = command.includes("|") ||
        command.includes(">") ||
        command.includes("<") ||
        command.includes("&&") ||
        command.includes("||") ||
        command.includes("'") ||
        command.includes('"');

    let cmd;
    if (needsShell) {
        const platform = Deno.build.os;
        const shell = platform === "windows" ? "cmd" : "sh";
        const shellArg = platform === "windows" ? "/c" : "-c";

        cmd = new Deno.Command(shell, {
            args: [shellArg, command],
            stdout: "piped",
            stderr: "piped",
            cwd,
        });
    } else {
        const parts = command.split(/\s+/);
        cmd = new Deno.Command(parts[0], {
            args: parts.slice(1),
            stdout: "piped",
            stderr: "piped",
            cwd,
        });
    }

    const { code, stderr } = await cmd.output();

    if (code !== 0) {
        throw new Error(
            `Command exited with code ${code}: ${getTextDecoder().decode(stderr)}`,
        );
    }
}
