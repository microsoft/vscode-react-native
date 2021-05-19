// Type definitions for nyc v15.1.0
// Project: https://github.com/istanbuljs/nyc

declare module "nyc" {
    export default class NYC {
        constructor(config: Record<string, any>);
        public async reset(): Promise<void>;
        public wrap(): NYC;
        public writeCoverageFile(): void;
        public async report(): Promise<void>;
    }
}
