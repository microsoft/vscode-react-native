// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as fs from "fs";
import * as https from "https";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";

export async function downloadFile(url: any, targetFile: any) {
    const logger = OutputChannelLogger.getMainChannel();
    let progress = 0;
    let newProgress = 0;
    return await new Promise((resolve, reject) => {
        const request = https
            .get(url, response => {
                const code = response.statusCode ?? 0;

                if (code >= 400) {
                    return reject(new Error(response.statusMessage));
                }

                const file = fs.createWriteStream(targetFile);
                const totalLength = parseInt(response.headers["content-length"] as string, 10);

                response.pipe(file);
                response.on("data", async function (chunk) {
                    newProgress += chunk.length;
                    const currentProgress =
                        parseFloat(getDownloadProgress(newProgress, totalLength)) * 100;
                    if (currentProgress - progress >= 5) {
                        progress = currentProgress;
                        logger.logStream(`${currentProgress}%...`);
                    }
                });

                file.on("finish", () => {
                    file.close();
                    logger.info("Download ExpoGo Completed.");
                });

                response.on("end", function () {
                    console.log("Progress end.");
                });
            })
            .on("error", error => {
                reject(error);
            });

        request.end();
    });
}

export async function downloadExpoGo(url: string, targetFile: string) {
    await downloadFile(url, targetFile);
}

function getDownloadProgress(currentLength: number, totalLength: number): string {
    console.log(currentLength / totalLength);
    return (currentLength / totalLength).toFixed(2);
}
