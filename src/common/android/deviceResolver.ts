import {ChildProcess} from "../node/childProcess";
import * as Q from "q";

export interface IDevice {
    id: string;
    isOnline: boolean;
}

export class DeviceResolver {

    /**
     * Gets the list of Android connected devices and emulators.
     */
    public getConnectedDevices(): Q.Promise<IDevice[]> {
        let childProcess = new ChildProcess();
        return childProcess.execToString("adb devices")
            .then(output => {
                return this.parseConnectedDevices(output);
            });
    }

    private parseConnectedDevices(input: string): IDevice[] {
        let result: IDevice[] = [];
        let regex = new RegExp("^(\\S+)\\t(\\S+)$", "mg");
        let match = regex.exec(input);
        while (match != null) {
            result.push({ id: match[1], isOnline: match[2] === "device" });
            match = regex.exec(input);
        }
        return result;
    }
}