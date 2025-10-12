import { join } from "@std/path";
import { XDG_CONFIG_HOME } from "../configs/configs.ts";
import { BackupModel } from "../types.ts";

const APPS = ["fish", "zed"];

export const UNIX_SPECIFIC_DIR: BackupModel[] = [
    ...APPS.map(app => ({
        paths: [join(XDG_CONFIG_HOME, app)],
        dest: `${app}.7z`,
    })),
];