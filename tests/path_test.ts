import {
    assert,
    assertEquals,
} from "@std/assert";
import { exists } from "@std/fs";
import {
    expandBackupDir,
    expandPath,
    filterValidSources,
    getFileSize,
} from "../src/utils/path.ts";

Deno.test("expandPath expands home and env-like placeholders", () => {
    const fromTilde = expandPath("~/example-file");
    const fromHomeVar = expandPath("${HOME}/example-file");
    const fromXdg = expandPath("${XDG_CONFIG_HOME}/example-dir");
    const fromConfig = expandPath("${CONFIG_HOME}/example-dir");

    assertEquals(fromTilde, fromHomeVar);
    assert(fromXdg.includes(".config"));
    assert(fromConfig.length > 0);
});

Deno.test("getFileSize returns file size, directory marker, and missing fallback", async () => {
    const tempDir = await Deno.makeTempDir();
    const tempFile = `${tempDir}/file.txt`;
    const missingFile = `${tempDir}/missing.txt`;
    await Deno.writeTextFile(tempFile, "12345");

    assertEquals(await getFileSize(tempFile), 5);
    assertEquals(await getFileSize(tempDir), 1);
    assertEquals(await getFileSize(missingFile), 0);
});

Deno.test("filterValidSources keeps only existing and non-empty sources", async () => {
    const tempDir = await Deno.makeTempDir();
    const validFile = `${tempDir}/valid.txt`;
    const emptyFile = `${tempDir}/empty.txt`;
    const missingFile = `${tempDir}/missing.txt`;
    await Deno.writeTextFile(validFile, "valid");
    await Deno.writeTextFile(emptyFile, "");

    const result = await filterValidSources([validFile, emptyFile, missingFile]);
    assertEquals(result, [validFile]);
});

Deno.test("expandBackupDir resolves count placeholder to next available value", async () => {
    const tempDir = await Deno.makeTempDir();
    const pattern = `${tempDir}/backup_\${os}_\${date}_\${count}`;
    const os = "linux";
    const date = "2026-03-07";

    const first = await expandBackupDir(pattern, os, date);
    await Deno.mkdir(first, { recursive: true });

    const second = await expandBackupDir(pattern, os, date);
    assert(first !== second);
    assertEquals(await exists(second), false);
});
