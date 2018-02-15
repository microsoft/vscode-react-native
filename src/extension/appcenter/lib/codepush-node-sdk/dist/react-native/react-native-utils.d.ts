export declare var spawn: any;
export interface VersionSearchParams {
    os: string;
    plistFile: string;
    plistFilePrefix: string;
    gradleFile: string;
}
export declare function getAndroidAppVersion(projectRoot?: string, gradleFile?: string): Promise<string>;
export declare function getiOSAppVersion(projectRoot?: string, plistFilePrefix?: string, plistFile?: string): Promise<string>;
export declare function getWindowsAppVersion(projectRoot?: string): Promise<string>;
export declare function runReactNativeBundleCommand(projectRootPath: string, bundleName: string, development: boolean, entryFile: string, outputFolder: string, platform: string, sourcemapOutput: string): Promise<void>;
export declare function isValidOS(os: string): boolean;
export declare function isValidPlatform(platform: string): boolean;
export declare function isReactNativeProject(): boolean;
export declare function getDefaultBundleName(os: string): string;
export declare function getDefautEntryFilePath(os: string, projectDir?: string): string;
export declare class BundleConfig {
    os: string;
    projectRootPath: string;
    outputDir?: string;
    entryFilePath?: string;
    bundleName?: string;
    development?: boolean;
    sourcemapOutput?: string;
}
export declare function makeUpdateContents(bundleConfig: BundleConfig): Promise<string>;
