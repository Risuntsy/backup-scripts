import { join } from "@std/path/join";

import { BackupModel } from "~/types.ts";
import { CURRENT_OS, HOME_DIR, XDG_CONFIG_DIR } from "../configs/configs.ts";
import { cleanBeforeCompress } from "./before.ts";
import { cleanDsStore } from "../macos/before.ts";
import { apps } from "./app.ts";
import { LINUX_SPECIFIC_DIR } from "../linux/backup.ts";
import { MACOS_SPECIFIC_DIR } from "../macos/backup.ts";
import { UNIX_SPECIFIC_DIR } from "../unix/backup.ts";
import { isCurrentOs } from "../os.ts";

let BACKUP_CONFIG: BackupModel[] = [
    { paths: [join(HOME_DIR, "App")], dest: "App.7z" },
    {
        paths: [join(HOME_DIR, "DEV")],
        dest: "DEV.7z",
        before: [cleanBeforeCompress],
    },
    {
        paths: [join(HOME_DIR, "Note")],
        dest: "Note.7z",
    },
    {
        paths: [join(HOME_DIR, "Course")],
        dest: "Course.7z",
        before: [cleanBeforeCompress],
    },
    { paths: [join(HOME_DIR, "Media")], dest: "Media" },
    {
        paths: [join(HOME_DIR, "Work")],
        dest: "Work.7z",
        before: [cleanBeforeCompress],
    },
    {
        paths: [join(XDG_CONFIG_DIR, ".gradle", "init.gradle")],
        dest: "gradle.7z",
    },
    ...apps,
    ...LINUX_SPECIFIC_DIR,
    ...MACOS_SPECIFIC_DIR,
    ...UNIX_SPECIFIC_DIR
];

// Filter based on OS with proper Linux distribution handling
BACKUP_CONFIG = BACKUP_CONFIG.filter(config => isCurrentOs(config.os));

if (CURRENT_OS === "darwin") {
    BACKUP_CONFIG.filter(m => m.type !== "task").forEach(m =>
        m.before ? m.before.push(cleanDsStore) : (m.before = [cleanDsStore])
    );
}

export { BACKUP_CONFIG };
