// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import * as net from "net";
import * as Q from "q";

import {Node} from "../../common/node/node";
import {PlistBuddy} from "../../common/ios/plistBuddy";

export class DeviceRunner {
    private projectRoot: string;
    private nativeDebuggerProxyInstance: ChildProcess;
    private childProcess = new Node.ChildProcess();

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        process.on("exit", () => this.cleanup());
    }

    public run(): Q.Promise<void> {
        const proxyPort = 9999;
        const appLaunchStepTimeout = 5000;
        return new PlistBuddy().getBundleId(this.projectRoot, /*simulator=*/false)
            .then((bundleId: string) => this.getPathOnDevice(bundleId))
            .then((path: string) =>
                this.startNativeDebugProxy(proxyPort).then(() =>
                    this.startAppViaDebugger(proxyPort, path, appLaunchStepTimeout)
                )
            )
            .then(() => { });
    }

    // Attempt to start the app on the device, using the debug server proxy on a given port.
    // Returns a socket speaking remote gdb protocol with the debug server proxy.
    public startAppViaDebugger(portNumber: number, packagePath: string, appLaunchStepTimeout: number): Q.Promise<string> {
        const encodedPath: string = this.encodePath(packagePath);

        // We need to send 3 messages to the proxy, waiting for responses between each message:
        // A(length of encoded path),0,(encoded path)
        // Hc0
        // c
        // We expect a '+' for each message sent, followed by a $OK#9a to indicate that everything has worked.
        // For more info, see http://www.opensource.apple.com/source/lldb/lldb-167.2/docs/lldb-gdb-remote.txt
        const socket: net.Socket = new net.Socket();
        let initState: number = 0;
        let endStatus: number = null;
        let endSignal: number = null;

        const deferred1: Q.Deferred<net.Socket> = Q.defer<net.Socket>();
        const deferred2: Q.Deferred<net.Socket> = Q.defer<net.Socket>();
        const deferred3: Q.Deferred<net.Socket> = Q.defer<net.Socket>();

        socket.on("data", (data: any): void => {
            data = data.toString();
            while (data[0] === "+") { data = data.substring(1); }
            // Acknowledge any packets sent our way
            if (data[0] === "$") {
                socket.write("+");
                if (data[1] === "W") {
                    // The app process has exited, with hex status given by data[2-3]
                    let status: number = parseInt(data.substring(2, 4), 16);
                    endStatus = status;
                    socket.end();
                } else if (data[1] === "X") {
                    // The app rocess exited because of signal given by data[2-3]
                    let signal: number = parseInt(data.substring(2, 4), 16);
                    endSignal = signal;
                    socket.end();
                } else if (data.substring(1, 3) === "OK") {
                    // last command was received OK;
                    if (initState === 1) {
                        deferred1.resolve(socket);
                    } else if (initState === 2) {
                        deferred2.resolve(socket);
                    }
                } else if (data[1] === "O") {
                    // STDOUT was written to, and the rest of the input until reaching a "#" is a hex-encoded string of that output
                    if (initState === 3) {
                        deferred3.resolve(socket);
                        initState++;
                    }
                } else if (data[1] === "E") {
                    // An error has occurred, with error code given by data[2-3]: parseInt(data.substring(2, 4), 16)
                    const error = new Error("Unable to launch application.");
                    deferred1.reject(error);
                    deferred2.reject(error);
                    deferred3.reject(error);
                }
            }
        });

        socket.on("end", function(): void {
            const error = new Error("Unable to launch application.");
            deferred1.reject(error);
            deferred2.reject(error);
            deferred3.reject(error);
        });

        socket.on("error", function(err: Error): void {
            deferred1.reject(err);
            deferred2.reject(err);
            deferred3.reject(err);
        });

        socket.connect(portNumber, "localhost", () => {
            // set argument 0 to the (encoded) path of the app
            const cmd: string = this.makeGdbCommand("A" + encodedPath.length + ",0," + encodedPath);
            initState++;
            socket.write(cmd);
            setTimeout(function(): void {
                deferred1.reject(new Error("Timeout launching application. Is the device locked?"));
            }, appLaunchStepTimeout);
        });

        return deferred1.promise.then((sock: net.Socket): Q.Promise<net.Socket> => {
            // Set the step and continue thread to any thread
            const cmd: string = this.makeGdbCommand("Hc0");
            initState++;
            sock.write(cmd);
            setTimeout(function(): void {
                deferred2.reject(new Error("Timeout launching application. Is the device locked?"));
            }, appLaunchStepTimeout);
            return deferred2.promise;
        }).then((sock: net.Socket): Q.Promise<net.Socket> => {
            // Continue execution; actually start the app running.
            const cmd: string = this.makeGdbCommand("c");
            initState++;
            sock.write(cmd);
            setTimeout(function(): void {
                deferred3.reject(new Error("Timeout launching application. Is the device locked?"));
            }, appLaunchStepTimeout);
            return deferred3.promise;
        }).then(() => packagePath);
    }

    public encodePath(packagePath: string): string {
        // Encode the path by converting each character value to hex
        return packagePath.split("").map((c: string) => c.charCodeAt(0).toString(16)).join("").toUpperCase();
    }

    private cleanup(): void {
        if (this.nativeDebuggerProxyInstance) {
            this.nativeDebuggerProxyInstance.kill("SIGHUP");
            this.nativeDebuggerProxyInstance = null;
        }
    }

    private startNativeDebugProxy(proxyPort: number): Q.Promise<void> {
        this.cleanup();

        return this.mountDeveloperImage().then((): Q.Promise<any> => {
            let result = this.childProcess.spawn("idevicedebugserverproxy",  [proxyPort.toString()]);
            result.outcome.done(() => {}, () => {}); // Q prints a warning if we don't call .done(). We ignore all outcome errors
            return result.startup.then(() => this.nativeDebuggerProxyInstance = result.spawnedProcess);
        });
    }

    private mountDeveloperImage(): Q.Promise<void> {
        return this.getDiskImage().then((path: string): Q.Promise<void> => {
            const imagemounter = this.childProcess.spawn("ideviceimagemounter", [path]).spawnedProcess;
            const deferred = Q.defer<void>();
            let stdout: string = "";
            imagemounter.stdout.on("data", function(data: any): void {
                stdout += data.toString();
            });
            imagemounter.on("exit", function(code: number): void {
                if (code !== 0) {
                    if (stdout.indexOf("Error:") !== -1) {
                        deferred.resolve(void 0); // Technically failed, but likely caused by the image already being mounted.
                    } else if (stdout.indexOf("No device found, is it plugged in?") !== -1) {
                        deferred.reject(new Error("Unable to find device. Is the device plugged in?"));
                    }

                    deferred.reject(new Error("Unable to mount developer disk image."));
                } else {
                    deferred.resolve(void 0);
                }
            });
            imagemounter.on("error", function(err: any): void {
                deferred.reject(err);
            });
            return deferred.promise;
        });
    }

    private getDiskImage(): Q.Promise<string> {
        const nodeChildProcess = this.childProcess;
        // Attempt to find the OS version of the iDevice, e.g. 7.1
        const versionInfo = nodeChildProcess.exec("ideviceinfo -s -k ProductVersion").outcome.then((stdout: Buffer) => {
            return stdout.toString().trim().substring(0, 3); // Versions for DeveloperDiskImage seem to be X.Y, while some device versions are X.Y.Z
            // NOTE: This will almost certainly be wrong in the next few years, once we hit version 10.0
        }, function(): string {
            throw new Error("Unable to get device OS version");
        });

        // Attempt to find the path where developer resources exist.
        const pathInfo = nodeChildProcess.exec("xcrun -sdk iphoneos --show-sdk-platform-path").outcome.then((stdout: Buffer) => {
            return stdout.toString().trim();
        });

        // Attempt to find the developer disk image for the appropriate
        return Q.all([versionInfo, pathInfo]).spread<string>(function(version: string, sdkpath: string): Q.Promise<string> {
            const find = nodeChildProcess.spawn("find", [sdkpath, "-path", "*" + version + "*", "-name", "DeveloperDiskImage.dmg"]).spawnedProcess;
            const deferred = Q.defer<string>();

            find.stdout.on("data", function(data: any): void {
                const dataStr: string = data.toString();
                const path: string = dataStr.split("\n")[0].trim();
                if (!path) {
                    deferred.reject(new Error("Unable to find developer disk image"));
                } else {
                    deferred.resolve(path);
                }
            });
            find.on("exit", function(code: number): void {
                deferred.reject(new Error("Unable to find developer disk image"));
            });

            return deferred.promise;
        });
    }

    private getPathOnDevice(packageId: string): Q.Promise<string> {
        const nodeChildProcess = this.childProcess;
        const nodeFileSystem = new Node.FileSystem();
        return nodeChildProcess.execToString("ideviceinstaller -l -o xml > /tmp/$$.ideviceinstaller && echo /tmp/$$.ideviceinstaller")
            .catch(function(err: any): any {
                if (err.code === "ENOENT") {
                    throw new Error("Unable to find ideviceinstaller.");
                }
                throw err;
            }).then((stdout: string): Q.Promise<string> => {
                // First find the path of the app on the device
                let filename: string = stdout.trim();
                if (!/^\/tmp\/[0-9]+\.ideviceinstaller$/.test(filename)) {
                    throw new Error("Unable to list installed applications on device");
                }

                const plistBuddy = new PlistBuddy();
                // Search thrown the unknown-length array until we find the package
                const findPackageEntry = (index: number): Q.Promise<string> => {
                    return plistBuddy.readPlistProperty(filename, `:${index}:CFBundleIdentifier`)
                        .then((bundleId: string) => {
                            if (bundleId === packageId) {
                                return plistBuddy.readPlistProperty(filename, `:${index}:Path`);
                            }
                            return findPackageEntry(index + 1);
                        });
                };

                return findPackageEntry(0)
                    .finally(() => {
                        nodeFileSystem.unlink(filename);
                    }).catch((): string => {
                        throw new Error("Application not installed on the device");
                    });
            });
    }

    private makeGdbCommand(command: string): string {
        let commandString: string = `$${command}#`;
        let stringSum: number = 0;
        for (let i: number = 0; i < command.length; i++) {
            stringSum += command.charCodeAt(i);
        }

        /* tslint:disable:no-bitwise */
        // We need some bitwise operations to calculate the checksum
        stringSum = stringSum & 0xFF;
        /* tslint:enable:no-bitwise */
        let checksum: string = stringSum.toString(16).toUpperCase();
        if (checksum.length < 2) {
            checksum = "0" + checksum;
        }

        commandString += checksum;
        return commandString;
    }
}