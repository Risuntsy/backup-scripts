import { dirname, join } from "@std/path";
import { dir } from "@cross/dir";

import { getCurrentOs } from "../utils/utils.ts";
import Logger from "@deno-library/logger";

export const textDecoder = new TextDecoder();

export const CURRENT_DIR = Deno.cwd();
export const HOME_DIR = await dir("home");
export const CONFIG_DIR = await dir("config");
export const BACKUP_DIR = join(dirname(CURRENT_DIR), `${new Date().toISOString().split("T")[0]}`); // YYYY-MM-DD (ISO 8601 date format)
export const LOG_DIR = join(dirname(CURRENT_DIR), "logs", `${new Date().toISOString().split("T")[0]}`);
export const CURRENT_OS = await getCurrentOs();

export const COMMAND = {
    "7z": CURRENT_OS === "darwin" ? "7zz" : "7z",
};

export const XDG_CONFIG_HOME = join(HOME_DIR, ".config");

export const logger = new Logger();
logger.initFileLogger(LOG_DIR);
logger.enableFile();



