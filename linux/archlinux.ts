import { join } from "@std/path";
import { BACKUP_DIR } from "../configs/configs.ts";
import { command } from "../utils/utils.ts";
import { BackupModel } from "../types.ts";

const ARCHLINUX_TASKS: BackupModel[] = [
    {
        type: "task",
        backup: async () => {
            const archlinuxPackages = (
                await Promise.all([command("pacman", "-Qenq"), command("pacman", "-Qemq")])
            ).join("\n");
            await Deno.writeTextFile(join(BACKUP_DIR, "archlinux_packages.txt"), archlinuxPackages);
        },
    },
];

export { ARCHLINUX_TASKS };
