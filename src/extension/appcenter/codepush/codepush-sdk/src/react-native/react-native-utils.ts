// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import * as xml2js from "xml2js";
import * as mkdirp from "mkdirp";
const plist = require("plist");
const g2js = require("gradle-to-js/lib/parser");
const properties = require("properties");
const childProcess = require("child_process");
import { isValidVersion } from "../utils/validation-utils";
import * as fileUtils from "../utils/file-utils";

export let spawn = childProcess.spawn;

export interface VersionSearchParams {
  os: string; // ios or android
  plistFile: string;
  plistFilePrefix: string;
  gradleFile: string;
}

export async function getAndroidAppVersion(projectRoot?: string, gradleFile?: string): Promise<string> {
  projectRoot = projectRoot || process.cwd();

  console.log(chalk.cyan(`Detecting "Android" app version:\n`));

  let buildGradlePath: string = path.join(projectRoot, "android", "app");
  if (gradleFile) {
    buildGradlePath = gradleFile;
  }
  if (fs.lstatSync(buildGradlePath).isDirectory()) {
    buildGradlePath = path.join(buildGradlePath, "build.gradle");
  }

  if (fileUtils.fileDoesNotExistOrIsDirectory(buildGradlePath)) {
    throw new Error(`Unable to find gradle file "${buildGradlePath}".`);
  }

  return g2js.parseFile(buildGradlePath)
    .catch(() => {
      throw new Error(`Unable to parse the "${buildGradlePath}" file. Please ensure it is a well-formed Gradle file.`);
    })
    .then((buildGradle: any) => {
      let versionName: string | null = null;

      // First "if" statement was implemented as workaround for case
      // when "build.gradle" file contains several "android" nodes.
      // In this case "buildGradle.android" prop represents array instead of object
      // due to parsing issue in "g2js.parseFile" method.
      if (buildGradle.android instanceof Array) {
        for (let i = 0; i < buildGradle.android.length; i++) {
          const gradlePart = buildGradle.android[i];
          if (gradlePart.defaultConfig && gradlePart.defaultConfig.versionName) {
            versionName = gradlePart.defaultConfig.versionName;
            break;
          }
        }
      } else if (buildGradle.android && buildGradle.android.defaultConfig && buildGradle.android.defaultConfig.versionName) {
        versionName = buildGradle.android.defaultConfig.versionName;
      } else {
        throw new Error(`The "${buildGradlePath}" file doesn"t specify a value for the "android.defaultConfig.versionName" property.`);
      }

      if (typeof versionName !== "string") {
        throw new Error(`The "android.defaultConfig.versionName" property value in "${buildGradlePath}" is not a valid string. If this is expected, consider using the --target-binary-version option to specify the value manually.`);
      }

      let appVersion: string = versionName.replace(/"/g, "").trim();

      if (isValidVersion(appVersion)) {
        // The versionName property is a valid semver string,
        // so we can safely use that and move on.
        console.log(`Using the target binary version value "${appVersion}" from "${buildGradlePath}".\n`);
        return appVersion;
      }

      // The version property isn"t a valid semver string
      // so we assume it is a reference to a property variable.
      const propertyName = appVersion.replace("project.", "");
      const propertiesFileName = "gradle.properties";
      const knownLocations = [
        path.join(projectRoot || "", "android", "app", propertiesFileName),
        path.join(projectRoot || "", "android", propertiesFileName),
      ];

      // Search for gradle properties across all `gradle.properties` files
      let propertiesFile: string | null = null;
      for (let i = 0; i < knownLocations.length; i++) {
        propertiesFile = knownLocations[i];
        if (fileUtils.fileExists(propertiesFile)) {
          const propertiesContent: string = fs.readFileSync(propertiesFile).toString();
          try {
            const parsedProperties: any = properties.parse(propertiesContent);
            appVersion = parsedProperties[propertyName];
            if (appVersion) {
              break;
            }
          } catch (e) {
            throw new Error(`Unable to parse "${propertiesFile}". Please ensure it is a well-formed properties file.`);
          }
        }
      }

      if (!appVersion) {
        throw new Error(`No property named "${propertyName}" exists in the "${propertiesFile}" file.`);
      }

      if (!isValidVersion(appVersion)) {
        throw new Error(`The "${propertyName}" property in the "${propertiesFile}" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1).`);
      }

      console.log(`Using the target binary version value "${appVersion}" from the "${propertyName}" key in the "${propertiesFile}" file.\n`);
      return appVersion.toString();
    });
}

export async function getiOSAppVersion(projectRoot?: string, plistFilePrefix?: string, plistFile?: string): Promise<string> {
  projectRoot = projectRoot || process.cwd();
  const projectPackageJson: any = require(path.join(projectRoot, "package.json"));
  const projectName: string = projectPackageJson.name;

  console.log(chalk.cyan(`Detecting "iOS" app version:\n`));

  let resolvedPlistFile: string | undefined = plistFile;
  if (resolvedPlistFile) {
    // If a plist file path is explicitly provided, then we don"t
    // need to attempt to "resolve" it within the well-known locations.
    if (!fileUtils.fileExists(resolvedPlistFile)) {
      throw new Error(`The specified plist file doesn"t exist. Please check that the provided path is correct.`);
    }
  } else {
    // Allow the plist prefix to be specified with or without a trailing
    // separator character, but prescribe the use of a hyphen when omitted,
    // since this is the most commonly used convetion for plist files.
    if (plistFilePrefix && /.+[^-.]$/.test(plistFilePrefix)) {
      plistFilePrefix += "-";
    }

    const iOSDirectory: string = "ios";
    const plistFileName = `${plistFilePrefix || ""}Info.plist`;

    const knownLocations = [
      path.join(projectRoot, iOSDirectory, projectName, plistFileName),
      path.join(projectRoot, iOSDirectory, plistFileName),
    ];

    resolvedPlistFile = (<any>knownLocations).find(fileUtils.fileExists);

    if (!resolvedPlistFile) {
      throw new Error(`Unable to find either of the following plist files in order to infer your app"s binary version: "${knownLocations.join("\", \"")}". If your plist has a different name, or is located in a different directory, consider using either the "--plist-file" or "--plist-file-prefix" parameters to help inform the CLI how to find it.`);
    }
  }

  const plistContents = fs.readFileSync(resolvedPlistFile).toString();

  let parsedPlist: any;
  try {
    parsedPlist = plist.parse(plistContents);
  } catch (e) {
    throw new Error(`Unable to parse "${resolvedPlistFile}". Please ensure it is a well-formed plist file.`);
  }

  if (parsedPlist && parsedPlist.CFBundleShortVersionString) {
    if (isValidVersion(parsedPlist.CFBundleShortVersionString)) {
      console.log(`Using the target binary version value "${parsedPlist.CFBundleShortVersionString}" from "${resolvedPlistFile}".\n`);
      return Promise.resolve(parsedPlist.CFBundleShortVersionString);
    } else {
      throw new Error(`The "CFBundleShortVersionString" key in the "${resolvedPlistFile}" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1).`);
    }
  } else {
    throw new Error(`The "CFBundleShortVersionString" key doesn"t exist within the "${resolvedPlistFile}" file.`);
  }
}

export async function getWindowsAppVersion(projectRoot?: string): Promise<string> {
  projectRoot = projectRoot || process.cwd();
  const projectPackageJson: any = require(path.join(projectRoot, "package.json"));
  const projectName: string = projectPackageJson.name;

  console.log(chalk.cyan(`Detecting "Windows" app version:\n`));

  const appxManifestFileName: string = "Package.appxmanifest";
  let appxManifestContainingFolder: string;
  let appxManifestContents: string;
  try {
    appxManifestContainingFolder = path.join(projectRoot, "windows", projectName);
    appxManifestContents = fs.readFileSync(path.join(appxManifestContainingFolder, appxManifestFileName)).toString();
  } catch (err) {
    throw new Error(`Unable to find or read "${appxManifestFileName}" in the "${path.join("windows", projectName)}" folder.`);
  }
  return new Promise<string>((resolve, reject) => {
    xml2js.parseString(appxManifestContents, (err: Error, parsedAppxManifest: any) => {
      if (err) {
        reject(new Error(`Unable to parse the "${path.join(appxManifestContainingFolder, appxManifestFileName)}" file, it could be malformed.`));
        return;
      }
      try {
        const appVersion: string = parsedAppxManifest.Package.Identity[0]["$"].Version.match(/^\d+\.\d+\.\d+/)[0];
        console.log(`Using the target binary version value "${appVersion}" from the "Identity" key in the "${appxManifestFileName}" file.\n`);
        return resolve(appVersion);
      } catch (e) {
        reject(new Error(`Unable to parse the package version from the "${path.join(appxManifestContainingFolder, appxManifestFileName)}" file.`));
        return;
      }
    });
  });
}

export function runReactNativeBundleCommand(projectRootPath: string, bundleName: string, development: boolean | undefined, entryFile: string, outputFolder: string, platform: string, sourcemapOutput: string | undefined): Promise<void> {
  const reactNativeBundleArgs: string[] = [];
  const envNodeArgs: string | undefined  = process.env.CODE_PUSH_NODE_ARGS;

  if (typeof envNodeArgs !== "undefined") {
    Array.prototype.push.apply(reactNativeBundleArgs, envNodeArgs.trim().split(/\s+/));
  }

  Array.prototype.push.apply(reactNativeBundleArgs, [
    path.join(projectRootPath, "node_modules", "react-native", "local-cli", "cli.js"), "bundle",
    "--assets-dest", outputFolder,
    "--bundle-output", path.join(outputFolder, bundleName),
    "--dev", development,
    "--entry-file", entryFile,
    "--platform", platform,
  ]);

  if (sourcemapOutput) {
    reactNativeBundleArgs.push("--sourcemap-output", sourcemapOutput);
  }

  console.log(chalk.cyan(`Running "react-native bundle" command:\n`));
  const reactNativeBundleProcess = spawn("node", reactNativeBundleArgs);
  console.log(`node ${reactNativeBundleArgs.join(" ")}`);

  return new Promise<void>((resolve, reject) => {
    reactNativeBundleProcess.stdout.on("data", (data: Buffer) => {
      console.log(data.toString().trim());
    });

    reactNativeBundleProcess.stderr.on("data", (data: Buffer) => {
      console.error(data.toString().trim());
    });

    reactNativeBundleProcess.on("close", (exitCode: number) => {
      if (exitCode) {
        reject(new Error(`"react-native bundle" command exited with code ${exitCode}.`));
      }

      resolve(void 0);
    });
  });
}

export function isValidOS(os: string): boolean {
  switch (os.toLowerCase()) {
    case "android":
    case "ios":
    case "windows":
      return true;
    default:
      return false;
  }
}

export function isValidPlatform(platform: string): boolean {
  return platform.toLowerCase() === "react-native";
}

export function isReactNativeProject(): boolean {
  try {
    const projectPackageJson: any = require(path.join(process.cwd(), "package.json"));
    const projectName: string = projectPackageJson.name;
    if (!projectName) {
      throw new Error(`The "package.json" file in the CWD does not have the "name" field set.`);
    }

    return projectPackageJson.dependencies["react-native"] || (projectPackageJson.devDependencies && projectPackageJson.devDependencies["react-native"]);
  } catch (error) {
    throw new Error(`Unable to find or read "package.json" in the CWD. The "release-react" command must be executed in a React Native project folder.`);
  }
}

export function getDefaultBundleName(os: string): string {
  if (!isValidOS(os)) {
    throw new Error(`Platform must be either "ios" or "android".`);
  }

  return os === "ios"
    ? "main.jsbundle"
    : `index.${os}.bundle`;
}

export function getDefautEntryFilePath(os: string, projectDir?: string): string {
  if (!isValidOS(os)) {
    throw new Error(`Platform must be either "ios" or "android".`);
  }

  if (!projectDir) {
    projectDir = process.cwd();
  }

  let entryFilePath: string = path.join(projectDir, "index.${os}.js");
  if (fileUtils.fileDoesNotExistOrIsDirectory(entryFilePath)) {
    entryFilePath = path.join(projectDir, "index.js");
  }

  if (fileUtils.fileDoesNotExistOrIsDirectory(entryFilePath)) {
    throw new Error(`Entry file "index.${os}.js" or "index.js" does not exist.`);
  }

  return entryFilePath;
}

export class BundleConfig {
  public os: string;
  public projectRootPath: string;
  public outputDir?: string;
  public entryFilePath?: string;
  public bundleName?: string;
  public development?: boolean;
  public sourcemapOutput?: string;
}

export async function makeUpdateContents(bundleConfig: BundleConfig): Promise<string> {
  if (!isValidOS(bundleConfig.os)) {
    throw new Error(`Platform must be either "ios" or "android".`);
  }

  if (!bundleConfig.projectRootPath) {
    bundleConfig.projectRootPath = process.cwd();
  }

  let updateContentsPath: string;
  updateContentsPath = bundleConfig.outputDir || await fileUtils.mkTempDir("code-push");

  // we have to add "CodePush" root folder to make update contents file structure
  // to be compatible with React Native client SDK
  updateContentsPath = path.join(updateContentsPath, "CodePush");
  mkdirp.sync(updateContentsPath);

  if (!bundleConfig.bundleName) {
    bundleConfig.bundleName = getDefaultBundleName(bundleConfig.os);
  }

  if (!bundleConfig.entryFilePath) {
    bundleConfig.entryFilePath = getDefautEntryFilePath(bundleConfig.os, bundleConfig.projectRootPath);
  }

  if (bundleConfig.outputDir) {
    bundleConfig.sourcemapOutput = path.join(updateContentsPath, bundleConfig.bundleName + ".map");
  }

  fileUtils.createEmptyTmpReleaseFolder(updateContentsPath);
  fileUtils.removeReactTmpDir();
  await runReactNativeBundleCommand(bundleConfig.projectRootPath, bundleConfig.bundleName, bundleConfig.development, bundleConfig.entryFilePath, updateContentsPath, bundleConfig.os, bundleConfig.sourcemapOutput);

  return updateContentsPath;
}
