/// <reference path="../typings/vscode-react-native/vscode-react-native" />

import * as Q from "q";
import {DebuggerWorker} from "./debuggerWorker";
import {Package} from "../utils/node/package";
import {Packager} from "./packager";

export class Launcher {
    private appStrategy: IDebugStrategy;
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

    private createAppStrategy(): IDebugStrategy {
        let platform = this.appPlatform();
        switch (platform) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case "ios":
                let iosAppStrategy = require("./ios/appStrategy");
                return new iosAppStrategy.AppStrategy(this.reactNativeProject());
            case "android":
                let androidAppStrategy = require("./android/appStrategy");
                return new androidAppStrategy.AppStrategy(this.reactNativeProject());
            default:
                throw new RangeError("The platform <" + platform + "> is not a valid react-native platform. Accepted platforms are \"iOS\" and \"Android\"");
        }
    }

    private printError(error: any): string {
        try {
            let errorText = JSON.stringify(error);
            if (errorText.length > 2) {
                return errorText;
            }
        } catch (exception) {
            // Swallow the exception so we"ll return the next line
        }

        return "" + error;
    }

    public launch() {
        this.appStrategy = this.createAppStrategy();

        return Q({})
            .then(() => Q.delay(new Packager(this.projectRootPath).start(), 3000))
            .then(() => Q.delay(this.appStrategy.runApp(), 3000))
            .then(() => Q.delay(new DebuggerWorker(this.projectRootPath).start(), 3000)) // Start the worker
            .then(() => this.appStrategy.enableJSDebuggingMode())
            .done(() => {}, reason => {
                console.log("Couldn\"t debug react-native app: " + this.printError(reason));
            });

        /* TODO: We could show some onboarding experience here such as:
            * You might need to set the Debug Server host & port for device for Android
            * You might need to replace localhost with your Mac's ip if you are running on a physical iOS device
        */
    }
}
