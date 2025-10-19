import { BeforeCallbackParams } from "~/types.ts";
import { cleanDir, isEmpty } from "../utils/utils.ts";
import { exists } from "@std/fs/exists";

export async function cleanBeforeCompress({ target }: Partial<BeforeCallbackParams>) {
    if (isEmpty(target)) {
        return;
    }

    for (const t of target!) {
        if (!await exists(t)) {
            console.warn(`the directory to be cleaned does not exist, skipping: ${t}`);
            continue;
        }
        await cleanDir([t], new Set(["target", "node_modules", ".astro", ".react-router"]));
    }
}
