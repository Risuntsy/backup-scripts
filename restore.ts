// import { copy, exists } from "@std/fs";
// import { dirname, join } from "@std/path";

// import { logger, textDecoder } from "./configs/objects.ts";
// import { COMMAND, CURRENT_DIR } from "./configs/configs.ts";
// import { BACKUP_CONFIG } from "./common/backup.ts";
// import { withLogging } from "./configs/log.ts";
// import { isCurrentOs } from "./os.ts";

// const backupDir = join(dirname(CURRENT_DIR), Deno.args[0]);

// await doRestore();

// async function doRestore() {
//     const tasks: Promise<void>[] = [];

//     const fileConfigs = BACKUP_CONFIG.filter(config => isCurrentOs(config.os));

//     for (const config of fileConfigs) {
//         if (config.type === "task") continue;

//         const { path, dest } = config;
//         if (dest.includes(".7z")) {
//             tasks.push(extract7z(join(backupDir, dest), dirname(path)));
//         } else {
//             tasks.push(restoreCopy(join(backupDir, dest), path));
//         }
//     }

//     await Promise.all(tasks);
//     logger.info("All done!");
// }

// async function extract7z(src: string, dest: string) {
//     if (!(await exists(src))) {
//         logger.warn(`File does not exist, skipping: ${src}`);
//         return;
//     }

//     const extractTask = async () => {
//         const output = await new Deno.Command(COMMAND["7z"], {
//             args: ["x", src, `-o${dest}`],
//         }).output();
    
//         if (!output.success) {
//             logger.warn(textDecoder.decode(output.stderr));
//         }
//     };

//     await withLogging(extractTask, `extract ${src} to ${dest}`);
// }

// async function restoreCopy(src: string, dest: string) {
//     if (!(await exists(src))) {
//         logger.warn(`Folder does not exist, skipping: ${src}`);
//         return;
//     }

//     const copyTask = async () => {
//         if (await exists(dest)) {
//             throw new Error(`Destination already exists: ${dest}`);
//         }
//         await copy(src, dest);
//     };

//     await withLogging(copyTask, `copy ${src} to ${dest}`);
// }
