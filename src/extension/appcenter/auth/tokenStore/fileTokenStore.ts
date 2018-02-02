// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

//
// file-token-store - implementation of token store that stores the data in
// a JSON encoded file on dist.
//
// This doesn't secure the data in any way, relies on the directory having
// proper security settings.
//

import * as fs from "fs";
import * as rx from "rx-lite";
import { toPairs } from "lodash";
import * as Q from "q";
import { TokenEntry, TokenStore, TokenKeyType, TokenValueType } from "../tokenStore/tokenStore";

export class FileTokenStore implements TokenStore {
    private filePath: string;
    private tokenStoreCache: { [key: string]: TokenValueType } | undefined;

    constructor(filePath: string) {
      this.filePath = filePath;
      this.tokenStoreCache = undefined;
    }

    public getStoreFilePath(): string {
      return this.filePath;
    }

    public list(): rx.Observable<TokenEntry> {
      this.loadTokenStoreCache();
      return rx.Observable.from(toPairs(this.tokenStoreCache)).map(pair => ({ key: pair[0], accessToken: pair[1]}));
    }

    public get(key: TokenKeyType): Q.Promise<TokenEntry | null> {
      this.loadTokenStoreCache();
      let token;
      if (this.tokenStoreCache) {
         token = this.tokenStoreCache[key];
      }
      if (!token) {
        return Q.resolve(null);
      }
      return Q<TokenEntry>({key: key, accessToken: token});
    }

    public set(key: TokenKeyType, value: TokenValueType): Q.Promise<void> {
      this.loadTokenStoreCache();
      if (this.tokenStoreCache) {
        this.tokenStoreCache[key] = value;
      }
      this.writeTokenStoreCache();
      return Q.resolve(void 0);
    }

    public remove(key: TokenKeyType): Q.Promise<void> {
      this.loadTokenStoreCache();
      if (this.tokenStoreCache) {
        delete this.tokenStoreCache[key];
      }
      this.writeTokenStoreCache();
      return Q.resolve(void 0);
    }

    private loadTokenStoreCache(): void {
      if (!this.tokenStoreCache) {
        try {
          this.tokenStoreCache = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
        } catch (err) {
          // No token cache file, creating new empty cache
          this.tokenStoreCache = {};
        }
      }
    }

    private writeTokenStoreCache(): void {
      fs.writeFileSync(this.filePath, JSON.stringify(this.tokenStoreCache));
    }
  }

export function createFileTokenStore(pathName: string): TokenStore {
    return new FileTokenStore(pathName);
}