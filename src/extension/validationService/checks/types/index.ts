// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export enum CategoryE {
    Common = "Common",
    Android = "Android",
    iOS = "iOS",
    Expo = "Expo",
}

export type ValidationResultT = {
    status: "failure" | "success" | "partial-success";
    comment?: string;
};

export interface ValidationI {
    label: string;
    description: string;
    platform?: typeof process.platform[];
    category: CategoryE;
    exec: () => Promise<ValidationResultT>;
}
