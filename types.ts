export type BeforeCallbackParams = {
    target: string[];
    os: Os;
};
export type Optional<T = void> = T | null;
export type Runnable<T = void> = () => T | Promise<T>;

export type Callback = (params: Partial<BeforeCallbackParams>) => void | Promise<void>;

export type Os = typeof Deno.build.os | "any" | "nixos" | "archlinux";
export type Linux = Extract<Os, "nixos" | "archlinux">;

export const LINUX_OS: Set<Os> = new Set(["nixos", "archlinux"]);

export type BackupModel =
    | {
          type?: "7z" | "dir";
          paths: string[];
          dest: string;
          os?: Optional<Os>;
          before?: Optional<Callback>[];
      }
    | {
          type: "task";
          backup: Runnable;
          restore?: Runnable;
          os?: Optional<Os>;
      };
