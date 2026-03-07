import {
    assertRejects,
} from "@std/assert";
import {
    compress,
    extract,
    set7zipCommand,
} from "../src/utils/compress.ts";

async function createMock7z(
    tempDir: string,
    mode: "ok" | "warn" | "fail",
): Promise<string> {
    const scriptPath = `${tempDir}/mock7z-${mode}.sh`;
    const script = `#!/usr/bin/env bash
set -euo pipefail
cmd="$1"
if [ "${mode}" = "fail" ]; then
  printf "mock failure" 1>&2
  exit 2
fi
if [ "${mode}" = "warn" ]; then
  printf "mock warning" 1>&2
  exit 1
fi
if [ "$cmd" = "a" ]; then
  dest="$2"
  mkdir -p "$(dirname "$dest")"
  printf "archive" > "$dest"
  exit 0
fi
if [ "$cmd" = "x" ]; then
  out_arg="$3"
  out_dir="\${out_arg#-o}"
  mkdir -p "$out_dir"
  printf "content" > "$out_dir/extracted.txt"
  exit 0
fi
exit 0
`;
    await Deno.writeTextFile(scriptPath, script);
    await Deno.chmod(scriptPath, 0o755);
    return scriptPath;
}

Deno.test("compress and extract succeed with zero exit code", async () => {
    const tempDir = await Deno.makeTempDir();
    const mock7z = await createMock7z(tempDir, "ok");
    set7zipCommand(mock7z);

    const sourceFile = `${tempDir}/source.txt`;
    await Deno.writeTextFile(sourceFile, "hello");
    const archivePath = `${tempDir}/archive.7z`;
    const extractDir = `${tempDir}/extract`;

    await compress([sourceFile], archivePath);
    await extract(archivePath, extractDir);
});

Deno.test("compress does not throw for warning exit code 1", async () => {
    const tempDir = await Deno.makeTempDir();
    const mock7z = await createMock7z(tempDir, "warn");
    set7zipCommand(mock7z);

    await compress([`${tempDir}/missing.txt`], `${tempDir}/archive.7z`);
});

Deno.test("extract throws for failure exit code >= 2", async () => {
    const tempDir = await Deno.makeTempDir();
    const mock7z = await createMock7z(tempDir, "fail");
    set7zipCommand(mock7z);

    await assertRejects(
        async () => await extract(`${tempDir}/archive.7z`, `${tempDir}/out`),
        Error,
        "7z extraction failed",
    );
});
