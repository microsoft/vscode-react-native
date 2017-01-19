// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import http = require("http");
import * as url from "url";
import Q = require("q");

export class Request {
    public request(requestUrl: string, expectStatusOK = false, headers?: any): Q.Promise<any> {
        let deferred = Q.defer<string>();

        let requestOptions = { headers };
        requestOptions = Object.assign(requestOptions, url.parse(requestUrl));

        let req = http.get(requestOptions, function(res) {
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
