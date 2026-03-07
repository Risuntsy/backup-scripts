import { assertEquals, assertExists } from "@std/assert";
import {
    getCurrentOs,
    isOsCompatible,
    isRestoreCompatible,
} from "../src/utils/os.ts";

Deno.test("getCurrentOs returns a supported OS", async () => {
    const os = await getCurrentOs();
    assertExists(os);
    assertEquals(
        ["linux", "nixos", "archlinux", "darwin", "windows"].includes(os),
        true,
    );
});

Deno.test("isOsCompatible supports empty task OS list", () => {
    assertEquals(isOsCompatible("linux", []), true);
});

Deno.test("isOsCompatible supports direct and linux compatibility rules", () => {
    assertEquals(isOsCompatible("nixos", ["nixos"]), true);
    assertEquals(isOsCompatible("nixos", ["linux"]), true);
    assertEquals(isOsCompatible("archlinux", ["linux"]), true);
    assertEquals(isOsCompatible("linux", ["nixos"]), false);
});

Deno.test("isRestoreCompatible is stricter than backup compatibility", () => {
    assertEquals(isRestoreCompatible("nixos", "linux"), true);
    assertEquals(isRestoreCompatible("archlinux", "linux"), true);
    assertEquals(isRestoreCompatible("linux", "nixos"), false);
    assertEquals(isRestoreCompatible("linux", "archlinux"), false);
    assertEquals(isRestoreCompatible("darwin", "darwin"), true);
});
