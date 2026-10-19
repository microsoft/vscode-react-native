const gulp = require("gulp");
const log = require("fancy-log");
const path = require("path");
const os = require("os");
const fs = require("fs");
const GulpExtras = require("../tools/gulp-extras");

const isNightly = process.argv.includes("--nightly");
const useNpm = process.argv.includes("--no-yarn");
const isPrepublish = process.argv.includes("--no-prepublish");
const extensionName = isNightly ? "vscode-react-native-preview" : "vscode-react-native";
const executeCommand = GulpExtras.executeCommand;
const smokeResourcesDirectory = path.join(
    appRoot,
    "test",
    "smoke",
    "resources",
    "extension",
);

function release() {
    return prepareLicenses();
}

function prepareLicenses() {
    const backupFiles = [
        "LICENSE.txt",
        "ThirdPartyNotices.txt",
        "package.json",
        "package-lock.json",
    ];
    const backupFolder = path.resolve(path.join(os.tmpdir(), "vscode-react-native"));
    if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder);
    }
    let vsixFileName;

    return Promise.resolve()
        .then(() => {
            /* back up LICENSE.txt, ThirdPartyNotices.txt, README.md */
            log("Backing up license files to " + backupFolder + "...");
            backupFiles.forEach(fileName => {
                fs.writeFileSync(path.join(backupFolder, fileName), fs.readFileSync(fileName));
            });

            /* copy over the release package license files */
            log("Preparing license files for release...");
            fs.writeFileSync("LICENSE.txt", fs.readFileSync("release/LICENSE.txt"));
            fs.writeFileSync(
                "ThirdPartyNotices.txt",
                fs.readFileSync("release/ThirdPartyNotices.txt"),
            );
        })
        .then(() => {
            let packageJson = readJson("/package.json");
            packageJson.main = "/dist/rn-extension";

            if (isPrepublish) {
                log("Ignore vscode:prepublish script before vsce package");
                const scripts = packageJson.scripts;
                delete scripts["vscode:prepublish"];
            }

            if (isNightly) {
                log("Performing gulp release...");
                packageJson.version = getVersionNumber();
                packageJson.name = extensionName;
                packageJson.preview = true;
                packageJson.displayName += " (Preview)";
            }
            vsixFileName = `${packageJson.name}-${packageJson.version}.vsix`;
            writeJson("/package.json", packageJson);
            removeVsixFiles(appRoot);
            log("Creating release package...");
            return new Promise((resolve, reject) => {
                // NOTE: vsce must see npm 3.X otherwise it will not correctly strip out dev dependencies.
                let vsceArgs = ["package"];
                const useBun = process.argv.includes("--bun");
                if (useBun) {
                    vsceArgs = ["package", "--no-yarn"];
                    log("Using bun for vsce packaging...");
                } else if (useNpm) {
                    vsceArgs = ["package", "--no-yarn"];
                    log("Using npm for vsce packaging...");
                } else {
                    log("Using yarn for vsce packaging...");
                }
                executeCommand(
                    "npx",
                    ["vsce", ...vsceArgs],
                    arg => {
                        if (arg) {
                            reject(arg);
                        }
                        resolve();
                    },
                    { cwd: appRoot },
                );
            });
        })
        .then(() => moveVsixToSmokeResources(vsixFileName))
        .finally(() => {
            /* restore backed up files */
            log("Restoring modified files...");
            backupFiles.forEach(fileName => {
                fs.writeFileSync(
                    path.join(appRoot, fileName),
                    fs.readFileSync(path.join(backupFolder, fileName)),
                );
            });
        });
}

function removeVsixFiles(directory) {
    if (!fs.existsSync(directory)) {
        return;
    }

    fs.readdirSync(directory)
        .filter(fileName => fileName.toLowerCase().endsWith(".vsix"))
        .forEach(fileName => fs.unlinkSync(path.join(directory, fileName)));
}

function moveVsixToSmokeResources(vsixFileName) {
    const sourcePath = path.join(appRoot, vsixFileName);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Release package was not created: ${sourcePath}`);
    }

    fs.mkdirSync(smokeResourcesDirectory, { recursive: true });
    removeVsixFiles(smokeResourcesDirectory);
    const targetPath = path.join(smokeResourcesDirectory, vsixFileName);
    fs.renameSync(sourcePath, targetPath);
    log(`Moved release package to ${targetPath}`);
}

function readJson(file) {
    const contents = fs.readFileSync(path.join(appRoot, file), "utf-8").toString();
    return JSON.parse(contents);
}

function writeJson(file, jsonObj) {
    const content = JSON.stringify(jsonObj, null, 2);
    fs.writeFileSync(path.join(appRoot, file), content);
}

const getVersionNumber = () => {
    const date = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));

    return [
        // YY
        date.getFullYear(),
        // MM,
        date.getMonth() + 1,
        //DDHH
        `${date.getDate()}${String(date.getHours()).padStart(2, "0")}`,
    ].join(".");
};

module.exports = {
    release,
};
