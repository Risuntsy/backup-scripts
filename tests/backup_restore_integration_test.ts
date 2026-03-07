import {
    assertEquals,
    assertExists,
} from "@std/assert";
import { exists } from "@std/fs";
import { join } from "@std/path";

const repoRoot = new URL("../", import.meta.url);

async function listDirectories(path: string): Promise<string[]> {
    const dirs: string[] = [];
    for await (const entry of Deno.readDir(path)) {
        if (entry.isDirectory) {
            dirs.push(entry.name);
        }
    }
    return dirs;
}

Deno.test("backup then restore workflow works end-to-end", async () => {
    const tempDir = await Deno.makeTempDir();
    const sourceDir = `${tempDir}/sources`;
    const backupRoot = `${tempDir}/linux-backups`;
    await Deno.mkdir(sourceDir, { recursive: true });
    await Deno.mkdir(backupRoot, { recursive: true });

    const sourceFile = `${sourceDir}/notes.txt`;
    const sourceContent = "important backup content";
    await Deno.writeTextFile(sourceFile, sourceContent);

    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            backup-dir = "${backupRoot}/run_\${os}_\${date}_\${count}"

            [[tasks]]
            src = ["${sourceFile}"]
            dest = "notes.txt"
            restore = true
        `,
    );

    const backupCommand = new Deno.Command("deno", {
        args: [
            "run",
            "--allow-read",
            "--allow-write",
            "--allow-run",
            "--allow-env",
            "src/backup.ts",
            configPath,
        ],
        cwd: repoRoot.pathname,
        stdout: "piped",
        stderr: "piped",
    });
    const backupOutput = await backupCommand.output();
    assertEquals(backupOutput.code, 0);

    const backupRuns = await listDirectories(backupRoot);
    assertEquals(backupRuns.length, 1);
    const backupDir = `${backupRoot}/${backupRuns[0]}`;
    assertEquals(await exists(join(backupDir, "notes.txt")), true);
    assertEquals(await exists(`${backupDir}/backup.toml`), true);

    await Deno.remove(sourceFile);
    assertEquals(await exists(sourceFile), false);

    const restoreCommand = new Deno.Command("deno", {
        args: [
            "run",
            "--allow-read",
            "--allow-write",
            "--allow-run",
            "--allow-env",
            "src/restore.ts",
            backupDir,
        ],
        cwd: repoRoot.pathname,
        stdout: "piped",
        stderr: "piped",
    });
    const restoreOutput = await restoreCommand.output();
    assertEquals(restoreOutput.code, 0);

    assertEquals(await exists(sourceFile), true);
    const restoredContent = await Deno.readTextFile(sourceFile);
    assertExists(restoredContent);
    assertEquals(restoredContent, sourceContent);
});
