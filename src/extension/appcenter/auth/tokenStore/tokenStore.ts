// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Observable } from "rx-lite";
import * as Q from "q";

export interface TokenStore {
    // List all entries in the store for our project
    list(): Observable<TokenEntry>;

    // Get a specific token
    get(key: TokenKeyType): Q.Promise<TokenEntry | null>;

    // Add or update a token
    set(key: TokenKeyType, token: TokenValueType): Q.Promise<void>;

    // Remove a token
    remove(key: TokenKeyType): Q.Promise<void> ;
  }

// Information stored about in each token
export interface TokenEntry {
    key: TokenKeyType;
    accessToken: TokenValueType;
}

export interface TokenValueType {
    token: string;
}

//
// Object used as token keys.
// Right now just a string, prepping for when we hook up to
// AAD and have to use ADAL tokens.
//
export type TokenKeyType = string;

