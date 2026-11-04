import "fs";

declare module "fs" {
    namespace promises {
        function rm(
            path: PathLike,
            options?: { recursive?: boolean; force?: boolean },
        ): Promise<void>;
    }
}
