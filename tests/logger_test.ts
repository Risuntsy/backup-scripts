import { assertEquals } from "@std/assert";
import { exists } from "@std/fs";
import { initLogger } from "../src/utils/logger.ts";

Deno.test("initLogger creates logs directory", async () => {
    const tempDir = await Deno.makeTempDir();
    await initLogger(tempDir);
    assertEquals(await exists(`${tempDir}/logs`), true);
});
