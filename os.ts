import { Optional, Os, LINUX_OS } from "./types.ts";
import { CURRENT_OS } from "./configs/configs.ts";

function isCurrentOs(os?: Optional<Os>) {
    if (!os || os === "any") return true;
    if (os === CURRENT_OS) return true;
    if (os === "linux" && LINUX_OS.has(CURRENT_OS)  ) return true;
    return false;

}

export { isCurrentOs };