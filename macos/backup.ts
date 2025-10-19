import { BackupModel } from "~/types.ts";
import { backupHomebrew } from "./before.ts";
import { CURRENT_OS } from "../configs/configs.ts";

const MACOS_SPECIFIC_DIR: BackupModel[] = CURRENT_OS === "darwin"
  ? [
    {
      // Homebrew 备份
      type: "task",
      backup: backupHomebrew,
    },
  ]
  : [];

MACOS_SPECIFIC_DIR.forEach((model) => {
  model.os = "darwin";
});

export { MACOS_SPECIFIC_DIR };
