const cp = require("child_process");
const path = require("path");

function runTypeScriptCompile() {
    return new Promise((resolve, reject) => {
        const child = cp.fork(
            path.join(appRoot, "node_modules", "typescript", "bin", "tsc"),
            ["-p", "tsconfig.json"],
            {
                cwd: appRoot,
                stdio: "inherit",
            },
        );

        child.on("exit", code => {
            code ? reject(new Error(`tsc exited with code ${code}`)) : resolve();
        });
    });
}

module.exports = {
    runTypeScriptCompile,
};
