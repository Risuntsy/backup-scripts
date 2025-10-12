import { BACKUP_DIR, LOG_DIR } from "./configs/configs.ts";

const dirs = [BACKUP_DIR, LOG_DIR];
const tasks = dirs.map(async dir => {
    try {
        return await Deno.remove(dir, { recursive: true });
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            // ignore
            return;
        }
        throw err;
    }
});
await Promise.all(tasks);

console.log(`Cleaned: ${dirs.join(", ")}`);