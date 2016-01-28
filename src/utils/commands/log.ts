export class Log {
    public printTopic(topicName: string) {
        process.stdout.write("########### " + topicName + " ###########\n");
    }

    public commandStarted(command: string) {
        this.printTopic("EXECUTING: " + command);
    }

    public commandEnded(command: string) {
        this.printTopic("FINISHED EXECUTING: " + command);
        process.stdout.write("\n\n");
    }

    public commandFailed(command: string, error: any) {
        console.error("Error while executing " + command + ": " + JSON.stringify(error));
    }
}