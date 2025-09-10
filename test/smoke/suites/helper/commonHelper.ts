import * as fs from "fs";
import * as rimraf from "rimraf";
import * as path from "path";
import { SmokeTestLogger } from "./smokeTestLogger";

export class CommonHelper {
    public static async findAndDeleteDirectory(projectPath: string): Promise<void> {
        const isExisting = await this.isDirectoryExisting(projectPath);
        if (isExisting) {
            try {
                rimraf.sync(projectPath);
                SmokeTestLogger.log(`Complete to delete target dir: ${projectPath}`);
            } catch (error) {
                throw new Error(`Fail to delete target dir: ${projectPath}`);
            }
        }
    }

    public static async isDirectoryExisting(projectPath: string): Promise<boolean> {
        if (fs.existsSync(projectPath)) {
            SmokeTestLogger.log(`Target dir is existing: ${projectPath}`);
            return true;
        } else {
            SmokeTestLogger.log(`Target dir is not existing: ${projectPath}`);
            return false;
        }
    }

    public static async findAndDeleteVSCodeSettingsDirectory(projectName: string): Promise<void> {
        const projectPath = path.join(__dirname, "..", "..", "resources", projectName, ".vscode");
        await this.findAndDeleteDirectory(projectPath);
    }
}
