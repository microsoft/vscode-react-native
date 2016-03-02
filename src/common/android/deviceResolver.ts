import {ChildProcess} from "../node/childProcess";
import * as Q from "q";

export interface IDevice {
    id: string;
    status: string;
}

export class DeviceResolver {

    /**
     * Gets the list of Android connected devices and emulators.
     */
    public getConnectedDevices(): Q.Promise<IDevice[]> {
        let deferred = Q.defer<IDevice[]>();

        let childProcess = new ChildProcess();
        childProcess.execToString("adb devices")
            .then(output => {
                let devices = this.parseConnectedDevices(output);
                deferred.resolve(devices);
            });

        return deferred.promise;
    }

    public parseConnectedDevices(input: string): IDevice[] {
        let result: IDevice[] = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({ id: match[1], status: match[2] });
            match = regex.exec(input);
        }
        return result;
    }
}