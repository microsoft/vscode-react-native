# React Native Tools Functionality Smoke Tests
Test cases of extension common E2E scenarios verification, include extension UI, commands, functionalities and other scenarios related to user experiences.<br>Tests are executed in vscode latest version without Extension Host.

## Setup Tests
In project root folder:<br>
`npm run prepare-smoke-tests`: setup smoke test dependencies.<br>
`npm run prepare-smoke-tests-project`: setup test sample project dependencies

## Security Dependency Override
The `serialize-javascript` override uses the official v7.1.3 source archive,
pinned to commit `4d36b828f7c1c6a1f0de9ef932fefadcca0edace`, because the configured
npm registry does not currently provide that release. This version fixes
[GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v).
Dependency installation requires access to `codeload.github.com`. Once the
release is available from the registry, replace the archive URL with `7.1.3`
or a newer patched version and regenerate the lockfile.

## Run Tests
In project root folder:<br>
`npm run smoke-tests`: Execute tests
