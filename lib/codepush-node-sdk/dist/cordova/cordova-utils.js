"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const which = require("which");
const xml2js = require("xml2js");
const fs = require("fs");
const path = require("path");
function getAppVersion(projectRoot) {
    return new Promise((resolve, reject) => {
        let configString;
        try {
            projectRoot = projectRoot || process.cwd();
            configString = fs.readFileSync(path.join(projectRoot, 'config.xml'), { encoding: 'utf8' });
        }
        catch (error) {
            reject(new Error(`Unable to find or read "config.xml" in the CWD. The "release-cordova" command must be executed in a Cordova project folder.`));
        }
        xml2js.parseString(configString, (err, parsedConfig) => {
            if (err) {
                reject(new Error(`Unable to parse "config.xml" in the CWD. Ensure that the contents of "config.xml" is valid XML.`));
            }
            const config = parsedConfig.widget;
            resolve(config['$'].version);
        });
    });
}
exports.getAppVersion = getAppVersion;
function isValidOS(os) {
    switch (os.toLowerCase()) {
        case 'android':
        case 'ios':
            return true;
        default:
            return false;
    }
}
exports.isValidOS = isValidOS;
function isValidPlatform(platform) {
    return platform.toLowerCase() === 'cordova';
}
exports.isValidPlatform = isValidPlatform;
// Check whether the Cordova or PhoneGap CLIs are
// installed, and if not, fail early
function getCordovaOrPhonegapCLI() {
    var cordovaCLI = 'cordova';
    try {
        which.sync(cordovaCLI);
        return cordovaCLI;
    }
    catch (e) {
        cordovaCLI = 'phonegap';
        which.sync(cordovaCLI);
        return cordovaCLI;
    }
}
exports.getCordovaOrPhonegapCLI = getCordovaOrPhonegapCLI;
function makeUpdateContents(os) {
    if (!isValidOS(os)) {
        throw new Error(`Platform must be either "ios" or "android".`);
    }
    const projectRoot = process.cwd();
    const platformFolder = path.join(projectRoot, 'platforms', os);
    let outputFolder;
    if (os === 'ios') {
        outputFolder = path.join(platformFolder, 'www');
    }
    else if (os === 'android') {
        // Since cordova-android 7 assets directory moved to android/app/src/main/assets instead of android/assets                
        const outputFolderVer7 = path.join(platformFolder, 'app', 'src', 'main', 'assets', 'www');
        if (fs.existsSync(outputFolderVer7)) {
            outputFolder = outputFolderVer7;
        }
        else {
            outputFolder = path.join(platformFolder, 'assets', 'www');
        }
    }
    return outputFolder;
}
exports.makeUpdateContents = makeUpdateContents;
function getCordovaCommand() {
    return this.build ? (this.isReleaseBuildType ? 'build --release' : 'build') : 'prepare';
}
exports.getCordovaCommand = getCordovaCommand;
