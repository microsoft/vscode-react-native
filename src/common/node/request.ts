// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import http = require("http");
import https = require("https");

export class Request {
    public static request(url: string, expectStatusOK = false, isHttps = false): Promise<string> {
        return new Promise((resolve, reject) => {
            let req = (isHttps ? https : http).get(url, function (res) {
                let responseString = "";
                res.on("data", (data: Buffer) => {
                    responseString += data.toString();
                });
                res.on("end", () => {
                    if (expectStatusOK && res.statusCode !== 200) {
                        reject(new Error(responseString));
                    } else {
                        resolve(responseString);
                    }
                });
            });
            req.on("error", (err: Error) => {
                reject(err);
            });
        });
    }
}
