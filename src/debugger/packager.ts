import {PlatformResolver} from "./platformResolver";
import {Request} from "../utils/node/request";
import {StopWatch} from "../utils/node/stopWatch";
import {CommandExecutor} from "../utils/commands/commandExecutor";
import {Log} from "../utils/commands/log";
import * as Q from "q";
import * as _ from "lodash";

export class Packager {
    public static PROTOCOL = "http://";
    public static HOST = "localhost:8081";

    private projectPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
    }

    private isRunning(): Q.Promise<boolean> {
        let statusURL = Packager.PROTOCOL + Packager.HOST + "/status";

        return new Request().request(statusURL)
            .then((body: string) => {
                return body === "packager-status:running";
            },
            (error: any) => {
                return false;
            });
    }

    private awaitUntilRunning(callback: () => void, millisecondsUntilRetry: number): void {
        this.isRunning().done(running => {
            if (running) {
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

    public start(): Q.Promise<number> {
        let resolver = new PlatformResolver();
        let desktopPlatform = resolver.resolveDesktopPlatform();

        this.isRunning().done(running => {
            if (running) {
                let mandatoryArgs = ["start"];
                let args = mandatoryArgs.concat(desktopPlatform.packagerStartExtraParameters);
                let childEnv = _.extend({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish
                new CommandExecutor(this.projectPath).spawn("Packager", desktopPlatform.packagerCommandName, args, { env: childEnv }).done();
            }
        });

        return this.awaitStart().then(timeToStart => {
            Log.logMessage("Packager was started after " + timeToStart + " secs");
            return timeToStart;
        });
    }
}
