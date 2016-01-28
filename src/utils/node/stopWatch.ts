export class StopWatch {
    private startTime = process.hrtime();
    private nanoSecondsInOneMilliSecond = 1000000;
    private milliSecondsInOneSecond = 1000;

    public stopAsMilliseconds(): number {
        let ellapsedTime = process.hrtime(this.startTime);
        let smallPartInNanoSeconds = ellapsedTime[1];
        let smallPartInMilliSeconds = smallPartInNanoSeconds / this.nanoSecondsInOneMilliSecond;
        let bigPartInSeconds = ellapsedTime[0];
        let bigPartInMilliSeconds = bigPartInSeconds * this.milliSecondsInOneSecond;
        let ellapsedTimeInMilliSeconds = bigPartInMilliSeconds + smallPartInMilliSeconds;
        return ellapsedTimeInMilliSeconds;
    }

    public stopAsSeconds(): number {
        return this.stopAsMilliseconds() / this.milliSecondsInOneSecond;
    }
}