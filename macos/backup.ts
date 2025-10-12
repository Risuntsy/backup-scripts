
import { BackupModel } from "~/types.ts";
import { backupHomebrew } from "./before.ts";
import { join } from "@std/path";
import { HOME_DIR } from "../configs/configs.ts";


const launchAgents = [
    "icu.risun.arknights.dailymaax5m2.plist"
]

const MACOS_SPECIFIC_DIR: BackupModel[] = [
    {
        // Homebrew 备份
        type: "task",
        backup: backupHomebrew,
    },
    {
        paths :[],
        dest:"fish.7z"
    },
    {
        paths: launchAgents.map(agentFileName => join(HOME_DIR, "Library", "LaunchAgents", agentFileName)),
        dest: "launchAgents.7z",
    }
];

MACOS_SPECIFIC_DIR.forEach(model => (model.os = "darwin"));

export { MACOS_SPECIFIC_DIR };
