// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as https from "https";
import { pipeline } from "stream";
import { URL } from "url";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";

const MAX_REDIRECTS = 5;

export function downloadFile(
    url: string,
    targetFile: string,
    redirectsRemaining: number = MAX_REDIRECTS,
): Promise<void> {
    const logger = OutputChannelLogger.getMainChannel();
    let progress = 0;
    let downloadedLength = 0;

    return new Promise<void>((resolve, reject) => {
        const request = https
            .get(url, response => {
                const code = response.statusCode ?? 0;

                if (code >= 300 && code < 400 && response.headers.location) {
                    response.resume();
                    if (redirectsRemaining === 0) {
                        reject(new Error(`Too many redirects while downloading ${url}`));
                        return;
                    }

                    const redirectUrl = new URL(response.headers.location, url).toString();
                    downloadFile(redirectUrl, targetFile, redirectsRemaining - 1).then(
                        resolve,
                        reject,
                    );
                    return;
                }

                if (code < 200 || code >= 300) {
                    response.resume();
                    reject(
                        new Error(
                            `Download failed with HTTP status ${code}${
                                response.statusMessage ? ` ${response.statusMessage}` : ""
                            }`,
                        ),
                    );
                    return;
                }

                const file = fs.createWriteStream(targetFile);
                const totalLength = Number(response.headers["content-length"]);

                response.on("data", (chunk: Buffer) => {
                    downloadedLength += chunk.length;
                    const currentProgress = getDownloadProgress(downloadedLength, totalLength);
                    if (currentProgress !== undefined && currentProgress - progress >= 5) {
                        progress = currentProgress;
                        logger.logStream(
                            `Current progress: ${currentProgress}%, please wait... \n`,
                        );
                    }
                });

                pipeline(response, file, error => {
                    if (error) {
                        fs.unlink(targetFile, () => reject(error));
                        return;
                    }

                    logger.logStream(`Download Expo Go Completed: ${targetFile} \n`);
                    void vscode.window.showInformationMessage("Download Expo Go Completed.");
                    resolve();
                });
            })
            .on("error", error => {
                reject(error);
            });

        request.end();
    });
}

export async function downloadExpoGo(url: string, targetFile: string): Promise<void> {
    await downloadFile(url, targetFile);
}

function getDownloadProgress(currentLength: number, totalLength: number): number | undefined {
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
        return undefined;
    }

    return Math.floor((currentLength / totalLength) * 100);
}
