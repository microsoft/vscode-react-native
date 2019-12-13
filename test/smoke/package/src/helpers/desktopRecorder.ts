// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import * as kill from "tree-kill";
import * as path from "path";
import { artifactsPath } from "../main";

/**
 * Defines the needed `ffmpeg` launch args
 * @see https://trac.ffmpeg.org/wiki/Capture/Desktop
 * @param Format - approach for recording video. Depends on platform
 * @param Input - system device from which video stream will be captured e.g. `:0` for capturing id 0 device on macOS or Linux, `desktop` to capture on Windows
 * @param Framerate - positive integer which represents the framerate of target video file
 * @param VideoSize - string in format `Width`x`Height` which represents the resolution of target video file
 * @param Output - path to the result video file with extension e.g. `.mp4`, `.avi`, `.mkv` etc
 * @param PixelFormat - request the video device to use a specific pixel format
 */
export interface FFmpegOptions {
    Format?: string;
    Input: string;
    Framerate: number;
    VideoSize: string;
    Output: string;
    PixelFormat: string;
}

/**
 * Class for screen recording on macOS, Windows and Linux that uses `ffmpeg` for recording
 */
export class DesktopRecorder {
    private recorderProcess: cp.ChildProcess | null;
    private ffmpegExecutable = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    private ffmpegFormat = {
        "win32": "gdigrab",
        "linux": "x11grab",
        "darwin": "avfoundation",
    };
    private defaultOptions: FFmpegOptions = {
        Framerate: 30,
        VideoSize: "1920x1080",
        Output: path.join(artifactsPath, "testsRecord.avi"),
        Input: process.platform === "win32" ? "desktop" : process.platform === "darwin" ? "0:0" : ":10",
        PixelFormat: "yuv420p",
    };

    public startRecord(options?: FFmpegOptions) {
        const args = this.prepareOptions(options);
        this.recorderProcess = cp.spawn(this.ffmpegExecutable, args);
        this.recorderProcess.on("exit", () => {
            console.log("*** Video record finished, video saved as: %s", args[args.length - 1]);
        });
        this.recorderProcess.on("error", (error) => {
            console.error("Error occurred in ffmpeg process: ", error);
        });
    }

    public stopRecord() {
        if (this.recorderProcess) {
            kill(this.recorderProcess.pid, "SIGINT");
            this.recorderProcess = null;
        }
    }

    private prepareOptions(options?: FFmpegOptions): string[] {
        if (!options) {
            options = this.defaultOptions;
        }
        if (!options.Format) {
            options.Format = this.ffmpegFormat[process.platform];
        }
        let args: string[] = [];
        args.push("-video_size", "1920x1080");
        args.push("-f", options.Format || "");
        args.push("-i", options.Input);
        args.push("-framerate", options.Framerate.toString());
        args.push("-pix_fmt", options.PixelFormat);
        args.push(options.Output);
        return args;
    }
}

