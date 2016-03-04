// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import http = require("http");
import Q = require("q");

export class Request {
    public request(url: string, expectStatusOK = false): Q.Promise<any> {
        let deferred = Q.defer<string>();
        let req = http.get(url, function(res) {
            let responseString = "";
            res.on("data", (data: Buffer) => {
                responseString += data.toString();
            });
            res.on("end", () => {
                if (expectStatusOK && res.statusCode !== 200) {
                    deferred.reject(new Error(responseString));
                } else {
                    deferred.resolve(responseString);
                }
            });
        });
        req.on("error", (err: Error) => {
            deferred.reject(err);
        });
        return deferred.promise;
    }
}
