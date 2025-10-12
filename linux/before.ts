import { join } from "@std/path/join";
import { copy } from "@std/fs/copy";

import { BeforeCallbackParams } from "~/types.ts";
import { assertExists } from "../utils/assert.ts";

export async function backupNixosConfig({ os, target }: Partial<BeforeCallbackParams>) {
    assertExists(os);
    assertExists(target);
    if (os !== "nixos") return;

    const nixConfigDir = join(target[0], "os", "linux", "distro", "nix", "nix_config");

    await Deno.remove(nixConfigDir, { recursive: true });

    await Promise.all(
        ["/etc/nixos"].map(dir => copy(dir, join(nixConfigDir), { overwrite: true })),
    );
}
