import { join } from "@std/path/join";

import { HOME_DIR } from "../configs/configs.ts";
import { BackupModel } from "../types.ts";

const CONFIG_DIR = join(HOME_DIR, ".config");

const APPS = ["zed", "fontconfig", "rustdesk"];

const LINUX_SPECIFIC_DIR: BackupModel[] = [
    { paths: [join("/etc/sysctl.d/99-sysctl.conf")], dest: "sysctl.7z" },
    ...APPS.map(app => ({
        paths: [join(CONFIG_DIR, app)],
        dest: `${app}.7z`,
    })),
];

LINUX_SPECIFIC_DIR.forEach(model => {
    model.os = "linux";
});

export { LINUX_SPECIFIC_DIR };
