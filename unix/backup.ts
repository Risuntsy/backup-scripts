import { join } from "@std/path";
import { CURRENT_OS, XDG_CONFIG_DIR} from "../configs/configs.ts";
import { BackupModel } from "../types.ts";

const APPS = ["fish", "zed", "mpv", "rustdesk", "fontconfig"];

export const UNIX_SPECIFIC_DIR: BackupModel[] = CURRENT_OS === "windows" ? [] : [
    ...APPS.map(app => ({
        paths: [join(XDG_CONFIG_DIR, app)],
        dest: `${app}.7z`,
    })),
];