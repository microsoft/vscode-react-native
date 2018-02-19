import * as which from 'which';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import * as path from 'path';

export function getAppVersion(projectRoot?: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let configString: string;
    try {
      projectRoot = projectRoot || process.cwd();
      configString = fs.readFileSync(path.join(projectRoot, 'config.xml'), { encoding: 'utf8' });
    } catch (error) {
      reject(new Error(`Unable to find or read "config.xml" in the CWD. The "release-cordova" command must be executed in a Cordova project folder.`));
    }

    xml2js.parseString(configString, (err: Error, parsedConfig: any) => {
      if (err) {
        reject(new Error(`Unable to parse "config.xml" in the CWD. Ensure that the contents of "config.xml" is valid XML.`));
      }

      const config: any = parsedConfig.widget;
      resolve(config['$'].version);
    });
  });
}

export function isValidOS(os: string): boolean {
  switch (os.toLowerCase()) {
    case 'android':
    case 'ios':
      return true;
    default:
      return false;
  }
}

export function isValidPlatform(platform: string): boolean {
  return platform.toLowerCase() === 'cordova';
}

// Check whether the Cordova or PhoneGap CLIs are
// installed, and if not, fail early
export function getCordovaOrPhonegapCLI(): string {
  var cordovaCLI: string = 'cordova';

  try {
    which.sync(cordovaCLI);
    return cordovaCLI;
  } catch (e) {
    cordovaCLI = 'phonegap';
    which.sync(cordovaCLI);
    return cordovaCLI;
  }
}

export function makeUpdateContents(os: string): string {
  if (!isValidOS(os)) {
    throw new Error(`Platform must be either "ios" or "android".`);
  }

  const projectRoot: string = process.cwd();
  const platformFolder: string = path.join(projectRoot, 'platforms', os);
  let outputFolder: string;

  if (os === 'ios') {
    outputFolder = path.join(platformFolder, 'www');
  } else if (os === 'android') {
    // Since cordova-android 7 assets directory moved to android/app/src/main/assets instead of android/assets                
    const outputFolderVer7 = path.join(platformFolder, 'app', 'src', 'main', 'assets', 'www');
    if (fs.existsSync(outputFolderVer7)) {
      outputFolder = outputFolderVer7;
    } else {
      outputFolder = path.join(platformFolder, 'assets', 'www');
    }
  }

  return outputFolder;
}

export function getCordovaCommand(): string {
  return this.build ? (this.isReleaseBuildType ? 'build --release' : 'build') : 'prepare';
}
