import Logger from "@deno-library/logger";
import { join } from "@std/path";

const logger = new Logger();

/**
 * Initialize file logger in backup directory
 */
export async function initLogger(backupDir: string) {
    const logDir = join(backupDir, "logs");

    await Deno.mkdir(logDir, { recursive: true });

    logger.initFileLogger(logDir);
    logger.enableFile();
}

export function getLogger() {
    return logger;
}
