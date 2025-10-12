import { BeforeCallbackParams } from "~/types.ts";
import { cleanDir } from "../utils/utils.ts";
import { assertExists } from "../utils/assert.ts";

export async function cleanBeforeCompress({ target }: Partial<BeforeCallbackParams>) {
    assertExists(target)
    for (const t of target) {
        assertExists(t);
        await cleanDir([t], new Set(["target", "node_modules", ".astro", ".react-router"]));
    }
}
