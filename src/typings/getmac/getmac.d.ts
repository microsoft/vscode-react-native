/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

// Barebones typing for getmac, added as-needed

declare module "getmac" {
    export function getMac(callback: (err: Error, result: string) => void): void;
}