/// <reference path="../typings/vscode-react-native/vscode-react-native" />

import * as Q from "q";
import {DebuggerWorker} from "./debuggerWorker";
import {Package} from "../utils/node/package";
import {Packager} from "./packager";
import {Log} from "../utils/commands/log";

export class Launcher {
    private debugStrategy: IDebugStrategy;
    private projectRootPath: string;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
    }

    private appPlatform(): string {
        let launchArguments = process.argv.slice(2);
        return launchArguments[0].toLowerCase();
    }

    private reactNativeProject(): Package {
        return new Package(this.projectRootPath);
    }

    private createDebugStrategy(): IDebugStrategy {
        let platform = this.appPlatform();
        switch (platform) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case "ios":
                let iosDebugStrategy = require("./ios/iosDebugStrategy");
                return new iosDebugStrategy.IOSDebugStrategy(this.reactNativeProject());
            case "android":
                let androidDebugStrategy = require("./android/androidDebugStrategy");
                return new androidDebugStrategy.AndroidDebugStrategy(this.reactNativeProject());
            default:
                throw new RangeError("The platform <" + platform + "> is not a valid react-native platform.");
        }
    }

    public launch() {
        this.debugStrategy = this.createDebugStrategy();

        return Q({})
            .then(() => Q.delay(new Packager(this.projectRootPath).start(), 3000))
            .then(() => Q.delay(this.debugStrategy.runApp(), 3000))
            .then(() => Q.delay(new DebuggerWorker(this.projectRootPath).start(), 3000)) // Start the worker
            .then(() => this.debugStrategy.enableJSDebuggingMode())
            .done(() => { }, reason => {
                Log.logError("Cannot debug application.", reason);
            });
    }
}
