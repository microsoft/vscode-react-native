// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as os from "os";

export const profileDirName = ".vscode";
export const tokenDirName = ".vscode-react-native";
export const profileFile = "codepush.json";

export function getProfileDir(projectRootPath: string): string {
  const profileDir = path.join(projectRootPath, profileDirName);
  return profileDir;
}

export function getTokenDir(): string {
  const tokenDir = path.join(getTokenDirParent(), tokenDirName);
  return tokenDir;
}

export function getTokenDirParent(): string {
  if (os.platform() === "win32") {
    return process.env.AppData;
  } else {
    return os.homedir();
  }
}