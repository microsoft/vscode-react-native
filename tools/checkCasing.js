var fs = require("fs");
var path = require("path");
var os = require("os");
var child_process = require("child_process");

// Recursively find all instances of 'import [...] from "[...]";'
if (os.platform() === "win32") {
    child_process.exec("findstr /sir /C:\"import.*from\" *.ts", parseOutput);
} else {
    child_process.exec("grep -Ri 'import.*from' .", parseOutput);
}

function parseOutput(err, out, stderr) {
    // Extract out the filename containing the match,
    // and the relative path of the file it is searching for
    var regex = /(\s|^)([^\n:]*):.*from ["'](\.[^"']*)["'];/g;
    var imports = [];
    out.replace(regex, function (all, _, file, from) {
        imports.push({ path: file, relative: from });
    });
    checkImports(imports);
}

function checkImports(imports) {
    // Check to see if the import references a source file
    // with an exact match of a name, and complain otherwise
    imports.map(function (i) {
        i.resolved = path.resolve(path.dirname(i.path), i.relative + ".ts");
        return i;
    }).filter(function (i) {
        var entries = fs.readdirSync(path.dirname(i.resolved));
        return entries.indexOf(path.basename(i.resolved)) === -1;
    }).forEach(function (i) {
        console.log("Missing file for import in " + i.path + ": " + i.relative);
        process.exitCode = 1;
    });
}
