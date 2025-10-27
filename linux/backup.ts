import { join } from "@std/path/join";

import { BackupModel } from "../types.ts";
import { CURRENT_OS, XDG_CONFIG_DIR } from "../configs/configs.ts";
import { ARCHLINUX_TASKS } from "./archlinux.ts";

const LINUX_SPECIFIC_DIR: BackupModel[] = [
    { paths: [join("/etc/sysctl.d/99-sysctl.conf")], dest: "sysctl.7z" },
    { paths: [join(XDG_CONFIG_DIR, "chrome-flags.conf")], dest: "chrome-flags.7z" },
    ...(CURRENT_OS === "archlinux" ? ARCHLINUX_TASKS : []),
];

LINUX_SPECIFIC_DIR.forEach(model => {
    model.os = "linux";
});

export { LINUX_SPECIFIC_DIR };
