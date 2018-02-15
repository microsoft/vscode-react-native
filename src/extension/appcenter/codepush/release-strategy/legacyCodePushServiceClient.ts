// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as request from "request";
import { DefaultApp } from "../../command/commandParams";
import * as fs from "fs";
import * as Q from "q";
import { models } from "../../api/index";

export interface PackageInfo {
    appVersion?: string;
    description?: string;
    isDisabled?: boolean;
    isMandatory?: boolean;
    label?: string;
    packageHash?: string;
    rollout?: number;
}

export interface Package extends PackageInfo {
    /*generated*/ blobUrl: string;
    /*generated*/ diffPackageMap?: PackageHashToBlobInfoMap;
    /*generated*/ originalLabel?: string;       // Set on "Promote" and "Rollback"
    /*generated*/ originalDeployment?: string;  // Set on "Promote"
    /*generated*/ releasedBy?: string;          // Set by commitPackage
    /*generated*/ releaseMethod?: string;       // "Upload", "Promote" or "Rollback". Unknown if unspecified
    /*generated*/ size: number;
    /*generated*/ uploadTime: number;
}

export interface PackageHashToBlobInfoMap {
    [packageHash: string]: BlobInfo;
}

export interface BlobInfo {
    size: number;
    url: string;
}

export type Headers = { [headerName: string]: string };

export default class LegacyCodePushServiceClient {
    private static API_VERSION: number = 2;

    constructor(private accessKey: string, private app: DefaultApp, private serverUrl?: string) {
        if (!accessKey) throw new Error("A token must be specified to execute server calls.");
        if (!serverUrl) throw new Error("A server url must be specified to execute server calls.");
    }

    public release(deploymentName: string, filePath: string, updateMetadata: PackageInfo): Q.Promise<models.CodePushRelease> {
        const appName = this.app.identifier;
        return Q.Promise<models.CodePushRelease>((resolve, reject) => {
            const options = {
                url: this.serverUrl + this.urlEncode(`/apps/${this.appNameParam(appName)}/deployments/${deploymentName}/release`),
                headers: {
                    "Accept": `application/vnd.code-push.v${LegacyCodePushServiceClient.API_VERSION}+json`,
                    "Authorization": `Bearer ${this.accessKey}`,
                },
                formData: {
                    "packageInfo": JSON.stringify(updateMetadata),
                    "package": fs.createReadStream(filePath),
                },
            };

            request.post(options, (err: any, httpResponse: any) => {
                if (err) {
                    reject(this.getErrorMessage(err, httpResponse));
                    return;
                }
                if (httpResponse.statusCode === 201) {
                    resolve(<models.CodePushRelease>JSON.parse(httpResponse.body).package);
                } else {
                    reject(this.getErrorMessage(null, httpResponse));
                    return;
                }
            });
        });
    }

    // A template string tag function that URL encodes the substituted values
    private urlEncode(strings: any, ...values: string[]): string {
        let result = "";
        for (let i = 0; i < strings.length; i++) {
            result += strings[i];
            if (i < values.length) {
                result += encodeURIComponent(values[i]);
            }
        }

        return result;
    }

    // IIS and Azure web apps have this annoying behavior where %2F (URL encoded slashes) in the URL are URL decoded
    // BEFORE the requests reach node. That essentially means there's no good way to encode a "/" in the app name--
    // URL encodeing will work when running locally but when running on Azure it gets decoded before express sees it,
    // so app names with slashes don't get routed properly. See https://github.com/tjanczuk/iisnode/issues/343 (or other sites
    // that complain about the same) for some more info. I explored some IIS config based workarounds, but the previous
    // link seems to say they won't work, so I eventually gave up on that.
    // Anyway, to workaround this issue, we now allow the client to encode / characters as ~~ (two tildes, URL encoded).
    // The CLI now converts / to ~~ if / appears in an app name, before passing that as part of the URL. This code below
    // does the encoding. It's hack, but seems like the least bad option here.
    // Eventually, this service will go away & we'll all be on Max's new service. That's hosted in docker, no more IIS,
    // so this issue should go away then.
    private appNameParam(appName: string) {
        return appName.replace("/", "~~");
    }

    private getErrorMessage(error: Error | null, response: request.RequestResponse): string {
        return response && response.body ? response.body : (error ? error.message : "");
    }
}
