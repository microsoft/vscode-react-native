const gulp = require("gulp");
const log = require("fancy-log");
const path = require("path");
const os = require("os");
const fs = require("fs");
const GulpExtras = require("../tools/gulp-extras");

const isNightly = process.argv.includes("--nightly");
const extensionName = isNightly ? "vscode-react-native-preview" : "vscode-react-native";
const executeCommand = GulpExtras.executeCommand;

function release(cb) {
    prepareLicenses();
    cb();
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
            if (isNightly) {
                log("Performing gul release...");
                packageJson.version = getVersionNumber();
                packageJson.name = extensionName;
                packageJson.preview = true;
                packageJson.displayName += " (Preview)";
            }
            writeJson("/package.json", packageJson);
            log("Creating release package...");
            return new Promise((resolve, reject) => {
                // NOTE: vsce must see npm 3.X otherwise it will not correctly strip out dev dependencies.
                executeCommand(
                    "vsce",
                    ["package"],
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
