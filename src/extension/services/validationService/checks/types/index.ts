// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export enum ValidationCategoryE {
    Common = "Common",
    Android = "Android",
    iOS = "iOS",
    Expo = "Expo",
    Windows = "Windows",
}

export type ValidationResultT = {
    status: "failure" | "success" | "partial-success";
    comment?: string;
};

export interface IValidation {
    label: string;
    description: string;
    platform?: typeof process.platform[];
    category: ValidationCategoryE;
    exec: () => Promise<ValidationResultT>;
}
