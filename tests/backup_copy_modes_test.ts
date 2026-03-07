import { assertEquals } from "@std/assert";
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

async function runBackupWithConfig(configPath: string): Promise<void> {
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
    const output = await backupCommand.output();
    assertEquals(output.code, 0);
}

async function runDirFromRoot(backupRoot: string): Promise<string> {
    const runs = await listDirectories(backupRoot);
    assertEquals(runs.length, 1);
    return join(backupRoot, runs[0]);
}

Deno.test("single file copies directly to destination file", async () => {
    const tempDir = await Deno.makeTempDir();
    const backupRoot = `${tempDir}/backups`;
    const sourceFile = `${tempDir}/source.txt`;
    await Deno.mkdir(backupRoot, { recursive: true });
    await Deno.writeTextFile(sourceFile, "single-file");

    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            backup-dir = "${backupRoot}/run_\${os}_\${date}_\${count}"

            [[tasks]]
            src = ["${sourceFile}"]
            dest = "direct.txt"
        `,
    );

    await runBackupWithConfig(configPath);
    const runDir = await runDirFromRoot(backupRoot);

    const targetPath = join(runDir, "direct.txt");
    assertEquals(await exists(targetPath), true);
    assertEquals(await Deno.readTextFile(targetPath), "single-file");
});

Deno.test("single folder copies as destination folder", async () => {
    const tempDir = await Deno.makeTempDir();
    const backupRoot = `${tempDir}/backups`;
    const sourceDir = `${tempDir}/source-folder`;
    const nestedDir = `${sourceDir}/nested`;
    const nestedFile = `${nestedDir}/inside.txt`;
    await Deno.mkdir(backupRoot, { recursive: true });
    await Deno.mkdir(nestedDir, { recursive: true });
    await Deno.writeTextFile(nestedFile, "folder-data");

    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            backup-dir = "${backupRoot}/run_\${os}_\${date}_\${count}"

            [[tasks]]
            src = ["${sourceDir}"]
            dest = "copied-folder"
        `,
    );

    await runBackupWithConfig(configPath);
    const runDir = await runDirFromRoot(backupRoot);

    const copiedFile = join(runDir, "copied-folder", "nested", "inside.txt");
    assertEquals(await exists(copiedFile), true);
    assertEquals(await Deno.readTextFile(copiedFile), "folder-data");
});

Deno.test("multiple mixed sources copy under destination folder", async () => {
    const tempDir = await Deno.makeTempDir();
    const backupRoot = `${tempDir}/backups`;
    const sourceFile = `${tempDir}/one.txt`;
    const sourceDir = `${tempDir}/folder-two`;
    const sourceDirFile = `${sourceDir}/two.txt`;
    await Deno.mkdir(backupRoot, { recursive: true });
    await Deno.mkdir(sourceDir, { recursive: true });
    await Deno.writeTextFile(sourceFile, "one");
    await Deno.writeTextFile(sourceDirFile, "two");

    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            backup-dir = "${backupRoot}/run_\${os}_\${date}_\${count}"

            [[tasks]]
            src = ["${sourceFile}", "${sourceDir}"]
            dest = "bundle"
        `,
    );

    await runBackupWithConfig(configPath);
    const runDir = await runDirFromRoot(backupRoot);

    const copiedFile = join(runDir, "bundle", "one.txt");
    const copiedDirFile = join(runDir, "bundle", "folder-two", "two.txt");
    assertEquals(await exists(copiedFile), true);
    assertEquals(await exists(copiedDirFile), true);
    assertEquals(await Deno.readTextFile(copiedFile), "one");
    assertEquals(await Deno.readTextFile(copiedDirFile), "two");
});
