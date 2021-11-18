// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export enum CategoryE {
    Common = "Common",
    Android = "Android",
    iOS = "iOS",
}

export type ValidationResultT = Promise<{
    status: "failure" | "success" | "partial-success";
    comment?: string;
}>;

export interface ValidationI {
    label: string;
    description: string;
    platform?: string; // todo: add possible platforms e.g win
    category: CategoryE;
    exec: () => ValidationResultT;
}
