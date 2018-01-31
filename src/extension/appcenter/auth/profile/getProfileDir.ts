// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as os from "os";
import * as path from "path";

export const profileDirName = ".vscode-react-native";
export const profileFile = "VSCodeAppCenterProfile.json";

export function getProfileDir(): string {
  const profileDir = path.join(getProfileDirParent(), profileDirName);
  return profileDir;
}

export function getProfileDirParent(): string {
  if (os.platform() === "win32") {
    return process.env.AppData;
  } else {
    return os.homedir();
  }
}
