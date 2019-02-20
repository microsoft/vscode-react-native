import * as fs from "fs";

if (process.argv.length < 4) {
    console.error("Please, specify relative path to the changelog file");
    process.exit(1);
}

const changelogFile = process.argv[2];
const content = fs.readFileSync(changelogFile).toString();

const version = process.argv[3];

// Check how many versions already in changelog by counting version markers like "## 1.0.0".
count = (content.match(/## \d+\.\d+\.\d+/) || []).length;
let versionChangelog;
if (count == 0) {
    console.warn("No version markers were found in the changelog file");
    process.exit(1);
} else if (count == 1) {

    // Check that version marker found in changelog file matches with the version passed in version argument
    const exactVersionPattern = new RegExp(`## ${version}`);
    if (!versionPattern.test(context)) {
        console.error("No version markers were found in the changelog file that would match specified version");
        process.exit(1);
    }
    versionChangelog = content.replace(versionPattern, "").trim();
} else {
    const betweenTwoVersionsPattern = new RegExp(`## ${version}((.|(\r\n|\r|\n))*?)((## \d+\.\d+\.\d+))`);
    const matches = content.match(betweenTwoVersionsPattern) || [];
    if (matches.length === 0) {
        console.error(`No changelog content found between ${version} and previous version`);
        process.exit(1);
    }
    versionChangelog = content.replace(/## \d+\.\d+\.\d+/, "").trim();
}