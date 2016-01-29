import {Request} from "../utils/node/request";
import {StopWatch} from "../utils/node/stopWatch";
import {CommandExecutor} from "../utils/commands/commandExecutor";
import {Log} from "../utils/commands/log";
import * as Q from "q";
import * as _ from "lodash";

export class Packager {
    private projectPath: string;
    private packagerOptions = this.getPackagerOptions();

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


    // TODO: Remove either the old or the new createStrategy version
    /* tslint:disable:no-unused-variable */
    private getPackagerOptions(): IPackagerOptions {
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
                let args = mandatoryArgs.concat(this.packagerOptions.packagerStartExtraParameters);
                let childEnv = _.extend({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish
                new CommandExecutor(this.projectPath).spawn("Packager", this.packagerOptions.executableName, args, { env: childEnv }).done();
            }
        });

        return this.awaitStart().then(timeToStart => {
            Log.logMessage("Packager was started after " + timeToStart + " secs");
            return timeToStart;
        });
    }
}
