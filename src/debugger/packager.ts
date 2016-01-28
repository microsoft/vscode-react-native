import {Request} from "../utils/node/request";
import {StopWatch} from "../utils/node/stopWatch";
import {CommandExecutor} from "../utils/commands/commandExecutor";
import * as Q from "q";
import * as _ from "lodash";

export interface IPackagerOptions {
    executableName: string;
    packagerStartExtraParameters: string[];
}

export class Packager {
    private projectPath: string;
    private strategy = this.createStrategy();

    constructor(projectPath: string) {
        this.projectPath = projectPath;
    }

    private status(): Q.Promise<string> {
        return new Request().request("http://localhost:8081/status").then(
            (body: string) => { return body === "packager-status:running" ? "running" : "unrecognized"; },
            (error: any) => { return "not_running"; });
    }

    private awaitUntilRunning(callback: () => void, millisecondsUntilRetry: number): void {
        this.status().done(status => {
            if (status === "running") {
                callback();
            } else {
                setTimeout(() => this.awaitUntilRunning(callback, millisecondsUntilRetry), millisecondsUntilRetry);
            }
        }, reason => {
            setTimeout(() => this.awaitUntilRunning(callback, millisecondsUntilRetry), millisecondsUntilRetry);
        });
    }

    private awaitStart(millisecondsUntilRetry: number = 1000): Q.Promise<number> {
        let result = Q.defer<number>();
        let stopWatch = new StopWatch();
        this.awaitUntilRunning(() => result.resolve(stopWatch.stopAsSeconds()), millisecondsUntilRetry);
        return result.promise;
    }

    private createStrategy(): IPackagerStrategy {
        let platform = process.platform;
        switch (platform) {
            case "darwin":
                let packagerOSXStrategy = require("./packagerOSXStrategy");
                return new packagerOSXStrategy.PackagerOSXStrategy(this);
            case "win32":
            default:
                // By default we use the windows strategy, which is more conservative
                let packagerWindowsStrategy = require("./packagerWindowsStrategy");
                return new packagerWindowsStrategy.PackagerWindowsStrategy(this);
        }
    }

    // TODO: Remove either the old or the new createStrategy version
    /* tslint:disable:no-unused-variable */
    private createStrategyNew(): IPackagerOptions {
        let platform = process.platform;
        switch (platform) {
            case "darwin":
                return { executableName: "react-native", packagerStartExtraParameters: []};
            case "win32":
            default:
                return { executableName: "react-native.cmd", packagerStartExtraParameters: ["--nonPersistent"]};
        }
    }
    /* tslint:enable:no-unused-variable */

    public start(): Q.Promise<number> {

        this.status().done(status => {
            if (status !== "running") {
                let mandatoryArgs = ["start"];
                let args = mandatoryArgs.concat(this.strategy.packagerStartExtraParameters());
                let childEnv = _.extend({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish
                new CommandExecutor(this.projectPath).spawn("Packager", this.strategy.executableName(), args, { env: childEnv }).done();
            }
        });

        return this.awaitStart().then(timeToStart => {
            console.log("Packager was started after " + timeToStart + " secs");
            return timeToStart;
        });
    }
}
