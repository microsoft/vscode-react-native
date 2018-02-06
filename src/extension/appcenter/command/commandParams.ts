// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CurrentAppDeployment } from "../appCenterConstants";

export interface IDefaultCommandParams {
    app: DefaultApp;
}

export interface DefaultApp {
    ownerName: string;
    appName: string;
    identifier: string;
    os: string;
    currentAppDeployment: CurrentAppDeployment;
}

export interface ICodePushReleaseParams extends IDefaultCommandParams {
  deploymentName: string;
  updatedContentZipPath: string;
  appVersion?: string;
  description?: string;
  isDisabled?: boolean;
  isMandatory?: boolean;
  label?: string;
  packageHash?: string;
  rollout?: number;
}