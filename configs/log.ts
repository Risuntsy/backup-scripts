import { logger } from "./configs.ts";
import { Runnable } from "../types.ts";
import { execRunnable } from "../utils/utils.ts";

// 简单的日志记录函数
export async function withLogging<T>(runnable: Runnable<T>, operation: string): Promise<T | void> {
    try {
        logger.info(`start to execute: ${operation}`);
        const result = await execRunnable<T>(runnable);
        logger.info(`execute success: ${operation}${result ? `, result: ${result}` : ""}`);
        return result;
    } catch (error) {
        logger.error(`execute failed: ${operation}`, error);
        throw error;
    }
}
