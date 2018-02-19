// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";

export const profileDirName = ".vscode";
export const profileFile = "codepush.json";

export function getProfileDir(projectRootPath: string): string {
  const profileDir = path.join(projectRootPath, profileDirName);
  return profileDir;
}