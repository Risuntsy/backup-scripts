import {
    assertEquals,
    assertRejects,
} from "@std/assert";
import { loadConfig, resolveTask, resolveTasks } from "../src/config.ts";
import type { BackupConfig } from "../src/types.ts";

Deno.test("loadConfig throws when file does not exist", async () => {
    const missingPath = "/tmp/definitely-missing-backup-config.toml";
    await assertRejects(
        async () => await loadConfig(missingPath),
        Error,
        "Configuration file not found",
    );
});

Deno.test("loadConfig validates required fields", async () => {
    const tempDir = await Deno.makeTempDir();
    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            [[tasks]]
            src = ["/tmp/a"]
            dest = "a.7z"
        `,
    );

    await assertRejects(
        async () => await loadConfig(configPath),
        Error,
        "backup-dir",
    );
});

Deno.test("loadConfig validates command tasks", async () => {
    const tempDir = await Deno.makeTempDir();
    const configPath = `${tempDir}/backup.toml`;
    await Deno.writeTextFile(
        configPath,
        `
            backup-dir = "/tmp/out"

            [[tasks]]
            type = "command"
        `,
    );

    await assertRejects(
        async () => await loadConfig(configPath),
        Error,
        'Task of type "command" requires "commands"',
    );
});

Deno.test("resolveTask returns null for incompatible OS", async () => {
    const resolved = await resolveTask(
        {
            src: ["/tmp/a"],
            dest: "a",
            os: ["darwin"],
        },
        "linux",
    );
    assertEquals(resolved, null);
});

Deno.test("resolveTask filters invalid sources by default", async () => {
    const tempDir = await Deno.makeTempDir();
    const validFile = `${tempDir}/valid.txt`;
    await Deno.writeTextFile(validFile, "content");

    const resolved = await resolveTask(
        {
            src: [validFile, `${tempDir}/missing.txt`],
            dest: "archive.7z",
        },
        "linux",
    );

    assertEquals(resolved?.type, "backup");
    if (resolved?.type === "backup") {
        assertEquals(resolved.src, [validFile]);
        assertEquals(resolved.isCompress, true);
        assertEquals(resolved.restore, true);
    }
});

Deno.test("resolveTask keeps all sources when filter-source is false", async () => {
    const tempDir = await Deno.makeTempDir();
    const missingFile = `${tempDir}/missing.txt`;
    const resolved = await resolveTask(
        {
            src: [missingFile],
            dest: "plain-copy",
            "filter-source": false,
        },
        "linux",
    );

    assertEquals(resolved?.type, "backup");
    if (resolved?.type === "backup") {
        assertEquals(resolved.src, [missingFile]);
        assertEquals(resolved.isCompress, false);
    }
});

Deno.test("resolveTasks resolves backup and command tasks", async () => {
    const tempDir = await Deno.makeTempDir();
    const validFile = `${tempDir}/data.txt`;
    await Deno.writeTextFile(validFile, "abc");

    const config: BackupConfig = {
        "backup-dir": `${tempDir}/backup_\${os}`,
        tasks: [
            {
                src: [validFile],
                dest: "data-copy",
            },
            {
                type: "command",
                commands: ["ls"],
            },
        ],
    };

    const resolved = await resolveTasks(config);
    assertEquals(resolved.length, 2);
    assertEquals(resolved[0].type, "backup");
    assertEquals(resolved[1].type, "command");
});
