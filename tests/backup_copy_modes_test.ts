import { assertEquals } from "@std/assert";
import { exists } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { getLogger } from "../src/utils/logger.ts";

const repoRoot = new URL("../", import.meta.url);
const logger = getLogger();

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
    if (output.code !== 0) {
        const decoder = new TextDecoder();
        logger.error(decoder.decode(output.stderr));
    }
    assertEquals(output.code, 0);
}

async function runDirFromRoot(backupRoot: string): Promise<string> {
    const runs = await listDirectories(backupRoot);
    assertEquals(runs.length, 1);
    return join(backupRoot, runs[0]);
}

Deno.test("single file copies under destination folder", async () => {
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
            dest = "shell"
        `,
    );

    await runBackupWithConfig(configPath);
    const runDir = await runDirFromRoot(backupRoot);

    const targetPath = join(runDir, "shell", basename(sourceFile));
    assertEquals(await exists(targetPath), true);
    assertEquals(await Deno.readTextFile(targetPath), "single-file");
});

Deno.test("single folder copies under destination folder", async () => {
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
            dest = "configs"
        `,
    );

    await runBackupWithConfig(configPath);
    const runDir = await runDirFromRoot(backupRoot);

    // With Unified dest semantic, source-folder basename is preserved under configs/
    const copiedFile = join(runDir, "configs", basename(sourceDir), "nested", "inside.txt");
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

Deno.test("preserve-structure keeps relative paths", async () => {
    const tempDir = await Deno.makeTempDir();
    const backupRoot = `${tempDir}/backups`;
    
    // Create structure: tempDir/root/a/1.txt and tempDir/root/b/2.txt
    const file1 = join(tempDir, "root", "a", "1.txt");
    const file2 = join(tempDir, "root", "b", "2.txt");
    await Deno.mkdir(dirname(file1), { recursive: true });
    await Deno.mkdir(dirname(file2), { recursive: true });
    await Deno.writeTextFile(file1, "one");
    await Deno.writeTextFile(file2, "two");

    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            backup-dir = "${backupRoot}/run_\${os}_\${date}_\${count}"

            [[tasks]]
            src = ["${file1}", "${file2}"]
            dest = "out"
            preserve-structure = true
        `,
    );

    await runBackupWithConfig(configPath);
    const runDir = await runDirFromRoot(backupRoot);

    // commonParentDir of [file1, file2] is join(tempDir, "root")
    // relative paths are "a/1.txt" and "b/2.txt"
    const copied1 = join(runDir, "out", "a", "1.txt");
    const copied2 = join(runDir, "out", "b", "2.txt");
    
    assertEquals(await exists(copied1), true);
    assertEquals(await exists(copied2), true);
    assertEquals(await Deno.readTextFile(copied1), "one");
    assertEquals(await Deno.readTextFile(copied2), "two");
});
