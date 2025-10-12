import { join } from "@std/path/join";

import { BeforeCallbackParams } from "~/types.ts";
import { cleanDir, isDirectory } from "../utils/utils.ts";
import { assertExists } from "../utils/assert.ts";
import { BACKUP_DIR } from "~/configs/configs.ts";
import { textDecoder } from "~/configs/configs.ts";
import { withLogging } from "~/configs/log.ts";
import { AsyncChain } from "../utils/async_utils.ts";


export async function cleanDsStore({ target }: Partial<BeforeCallbackParams>) {
    assertExists(target);
    target = await AsyncChain.from(target).filter(isDirectory).toArray();
    await cleanDir(target, new Set([".DS_Store"]));
}

export async function backupHomebrew() {
    const brewfileTask = async () => {
        const homebrewDir = join(BACKUP_DIR, "homebrew");
        await Deno.mkdir(homebrewDir, { recursive: true });

        const brewfile = join(homebrewDir, "Brewfile");
        const brewBundleResult = await new Deno.Command("brew", {
            args: ["bundle", "dump", "--force", "--file=" + brewfile],
        }).output();

        if (!brewBundleResult.success) {
            throw new Error("Failed to dump Brewfile");
        }

        // remove vscode extension from Brewfile
        await Deno.writeTextFile(
            brewfile,
            (
                await Deno.readTextFile(brewfile)
            )
                .split("\n")
                .filter(line => !line.startsWith("vscode"))
                .join("\n")
        );

        return textDecoder.decode(brewBundleResult.stdout);
    };

    await withLogging(brewfileTask, "backup Homebrew");
}
