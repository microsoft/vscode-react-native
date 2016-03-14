import * as path from "path";
import {FileSystem} from "../../common/node/fileSystem";

interface IAPKInformation {
    packageName: string;
}

const APK_FORMAT_SIGNATURE = "APKSimulatedFormat";

interface APKFormat {
    format: string; // Should always be "APKSimulatedFormat"
    information: IAPKInformation;
}

/* This class stores a "fake" APK file in the file system, and then can be used to verify that a certain file is a
   valid "fake" APK file, and also read metadata from it. */
export class SimulatedAndroidAPK {
    private fileSystem: FileSystem;

    constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public readPackageNameFromFile(apkPath: string): Q.Promise<string> {
        return this.fileSystem.readFile(apkPath, "utf8").then(data => {
            const information = this.readAPKData(data);
            return information.packageName;
        });
    }

    public writeApk(apkPath: string, information: IAPKInformation): Q.Promise<void> {
        this.fileSystem.makeDirectoryRecursiveSync(path.dirname(apkPath));
        return this.fileSystem.writeFile(apkPath, this.generateAPKData(information));
    }

    private generateAPKData(information: IAPKInformation): string {
        return JSON.stringify({ format: APK_FORMAT_SIGNATURE, information: information});
    }

    private readAPKData(data: string): IAPKInformation {
        const json = JSON.parse(data);
        if (json.format === APK_FORMAT_SIGNATURE) {
            return (<APKFormat>json).information;
        } else {
            throw new Error("Attempted to read an invalid simulated .apk file");
        }
    }
}
