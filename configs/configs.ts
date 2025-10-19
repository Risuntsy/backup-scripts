import { dirname, join } from "@std/path";
import { dir } from "@cross/dir";

import { getBackupDir, getCurrentOs } from "../utils/utils.ts";
import Logger from "@deno-library/logger";

export const textDecoder = new TextDecoder();

export const CURRENT_DIR = Deno.cwd();
const [HOME_DIR, CONFIG_DIR, BACKUP_DIR, CURRENT_OS] = await Promise.all([
    dir("home"),
    dir("config"),
    getBackupDir(),
    getCurrentOs()
]);
export { HOME_DIR, CONFIG_DIR, BACKUP_DIR, CURRENT_OS };
export const LOG_DIR = join(dirname(CURRENT_DIR), "logs", `${new Date().toISOString().split("T")[0]}`);

export const COMMAND = {
    "7z": CURRENT_OS === "darwin" ? "7zz" : "7z",
};

export const XDG_CONFIG_DIR = join(HOME_DIR, ".config");

export const logger = new Logger();
logger.initFileLogger(LOG_DIR);
logger.enableFile();



