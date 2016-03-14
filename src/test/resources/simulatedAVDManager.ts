import * as Q from "q";
import {SimulatedDeviceHelper} from "./simulatedDeviceHelper";

export interface IAVDManager {
    createAndLaunch(avdId: string): Q.Promise<string>;
    create(avdId: string): Q.Promise<void>;
    launch(avdId: string): Q.Promise<string>;
    createAndLaunchAll(...avdIds: string[]): Q.Promise<string[]>;
}

interface IDeviceState {

}

interface IDeviceStateMapping {
    [avdId: string]: IDeviceState;
}

/* Simulation of AVD Manager. */
export class SimulatedAVDManager implements IAVDManager {
    private nextAvailablePort = 5555;

    private devices: IDeviceStateMapping = {};

    constructor(private deviceHelper: SimulatedDeviceHelper) {
    }

    public createAndLaunch(avdId: string): Q.Promise<string> {
        return this.create(avdId).then(() =>
            this.launch(avdId));
    }

    public create(avdId: string): Q.Promise<void> {
        if (!this.devices[avdId]) {
            this.devices[avdId] = {};
            return Q.resolve<void>(void 0);
        } else {
            throw new Error("Implement to match AVD: Device already exists");
        }
    }

    public launch(avdId: string): Q.Promise<string> {
        if (this.devices[avdId]) {
            this.deviceHelper.notifyDeviceWasConnected(avdId);
            return Q(`emulator-${this.nextAvailablePort++}`);
        } else {
            throw new Error("Implement to match AVD: Device doesn't exists");
        }
   }

   public createAndLaunchAll(...avdIds: string[]): Q.Promise<string[]> {
        return Q.all(avdIds.map(avdId => this.createAndLaunch(avdId)));
   }
}