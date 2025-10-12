import { join } from "@std/path/join";

import { CONFIG_DIR, CURRENT_OS, HOME_DIR } from "../configs/configs.ts";
import { BackupModel } from "~/types.ts";

const maa: BackupModel = {
    paths: [
        CURRENT_OS === "windows"
            ? join(CONFIG_DIR, "loong", "maa", "config")
            : CURRENT_OS === "darwin"
            ? join(HOME_DIR, "Library", "Application Support", "com.loong.maa", "config")
            : join(CONFIG_DIR, "maa"),
    ],
    dest: "maa_cli.7z",
};

const openvpnConnect: BackupModel = {
    // Not implemented for windows and linux
    paths: [
        CURRENT_OS === "darwin"
            ? join(HOME_DIR, "Library", "Application Support", "OpenVPN Connect", "profiles")
            : "",
    ].filter(Boolean),
    dest: "openvpnConnect.7z",
};

const ssh: BackupModel = { paths: [join(HOME_DIR, ".ssh")], dest: "ssh.7z" };

const apps: BackupModel[] = [maa, openvpnConnect, ssh];

export { apps };
