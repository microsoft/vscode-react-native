import * as Q from "q";
import {Node} from "../node/node";
import * as _ from "lodash";
import {Log} from "./log";

interface EnvironmentOptions {
    REACT_DEBUGGER?: string;
}

interface Options {
    env?: EnvironmentOptions;
}

export class CommandExecutor {
    private log = new Log();
    private currentWorkingDirectory: string;

    constructor(currentWorkingDirectory: string) {
        this.currentWorkingDirectory = currentWorkingDirectory;
    }

    public execute(subject: string, command: string, options: Options = {}): Q.Promise<void> {
        // let outputChannel = vscode.window.createOutputChannel("React Native: " + subject);
        this.log.commandStarted(command);
        // outputChannel.show();
        // let process = child_process.exec(command, {cwd: vscode.workspace.rootPath});
        return new Node.ChildProcess().execToString(command, {  cwd: this.currentWorkingDirectory, env: options.env })
            .then(stdout => {
                console.log(stdout);
                this.log.commandEnded(command);
            },
            reason => this.log.commandFailed(command, reason));
    }

    public spawn(subject: string, command: string, args: string[], options: Options = {}): Q.Promise<void> {
        let spawnOptions = _.extend({}, {  cwd: this.currentWorkingDirectory }, options);
        let commandWithArgs = command + " " + args.join(" ");

        this.log.commandStarted(commandWithArgs);
        let result = new Node.ChildProcess().spawn(command, args, spawnOptions);

        result.stderr.on("data", (data: Buffer) => {
            process.stdout.write(data);
        });

        result.stdout.on("data", (data: Buffer) => {
            process.stdout.write(data);
        });

        return result.outcome.then(() => {
                this.log.commandEnded(commandWithArgs);
            },
            reason => this.log.commandFailed(commandWithArgs, reason));
    }

}
