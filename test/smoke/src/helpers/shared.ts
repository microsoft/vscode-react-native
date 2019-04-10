// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as request from "request";
import * as URL from "url-parse";

export function getContents(url, token, headers, callback) {
    request.get(toRequestOptions(url, token, headers), function (error, response, body) {
        if (!error && response && response.statusCode >= 400) {
            error = new Error("Request returned status code: " + response.statusCode + "\nDetails: " + response.body);
        }

        callback(error, body);
    });
}

export function toRequestOptions(url, token?, headers?) {
    headers = headers || {
        "user-agent": "nodejs",
    };

    if (token) {
        headers["Authorization"] = "token " + token;
    }

    let parsedUrl = new URL(url);

    let options: any = {
        url: url,
        headers: headers,
    };

    // We need to test the absence of true here because there is an npm bug that will not set boolean
    // env variables if they are set to false.
    if (process.env.npm_config_strict_ssl !== "true") {
        options.strictSSL = false;
    }

    if (process.env.npm_config_proxy && parsedUrl.protocol === "http:") {
        options.proxy = process.env.npm_config_proxy;
    } else if (process.env.npm_config_https_proxy && parsedUrl.protocol === "https:") {
        options.proxy = process.env.npm_config_https_proxy;
    }

    return options;
}
