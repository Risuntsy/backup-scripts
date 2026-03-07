import type { Os } from "../types.ts";
import { getTextDecoder } from "./constants.ts";

const textDecoder = getTextDecoder();

let cachedOs: Os | null = null;

/**
 * Get the current operating system
 */
export async function getCurrentOs(): Promise<Os> {
    if (cachedOs) {
        return cachedOs;
    }

    const platform = Deno.build.os;

    if (platform === "windows" || platform === "darwin") {
        cachedOs = platform;
        return cachedOs;
    }

    if (platform === "linux") {
        cachedOs = await getLinuxDistribution();
        return cachedOs;
    }

    throw new Error(`Unsupported OS: ${platform}`);
}

/**
 * Detect Linux distribution
 */
async function getLinuxDistribution(): Promise<Os> {
    try {
        const command = new Deno.Command("cat", {
            args: ["/etc/os-release"],
            stdout: "piped",
            stderr: "piped",
        });
        const { stdout } = await command.output();
        const osRelease = textDecoder.decode(stdout);

        if (
            osRelease.includes("NAME=NixOS") ||
            osRelease.includes('NAME="NixOS"')
        ) {
            return "nixos";
        }

        if (osRelease.includes('NAME="Arch Linux"')) {
            return "archlinux";
        }

        return "linux";
    } catch {
        return "linux";
    }
}

/**
 * Check if the current OS is compatible with the task OS list
 */
export function isOsCompatible(currentOs: Os, taskOs: Os[]): boolean {
    if (taskOs.length === 0) {
        return true;
    }

    // Direct match
    if (taskOs.includes(currentOs)) {
        return true;
    }

    // nixos is compatible with linux
    if (currentOs === "nixos" && taskOs.includes("linux")) {
        return true;
    }

    // archlinux is compatible with linux
    if (currentOs === "archlinux" && taskOs.includes("linux")) {
        return true;
    }

    return false;
}

/**
 * Check if restore is compatible (stricter than backup)
 * For restore: linux config only works on linux, not on nixos/archlinux
 */
export function isRestoreCompatible(backupOs: Os, currentOs: Os): boolean {
    // Exact match always works
    if (backupOs === currentOs) {
        return true;
    }

    // nixos backup can restore on linux
    if (backupOs === "nixos" && currentOs === "linux") {
        return true;
    }

    // archlinux backup can restore on linux
    if (backupOs === "archlinux" && currentOs === "linux") {
        return true;
    }

    // But linux backup cannot restore on nixos/archlinux (inverse not allowed)
    return false;
}
