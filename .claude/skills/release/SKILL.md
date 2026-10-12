---
name: release
description: Use when asked to deploy, release, publish, cut or tag a new version of this patched vscode-react-native fork (versions like v1.14.20261012), or to install the latest patched VSIX into the local editor.
argument-hint: "[version] [install] | install"
---

# Release the patched fork

## Mode

Decide the mode from the request:
- **Install only.** The request asks to install and doesn't mention deploy/release/publish. Set `V=$(gh release view --repo teoboetti/vscode-react-native --json tagName -q .tagName | sed 's/^v//')`, then do step 5 only.
- **Release.** Do steps 1-4. Also do step 5 if the request mentions install.
- **Version.** If the request names one (e.g. `1.14.20261020`), use it without the `v`. Otherwise use `<major>.<minor>.$(date +%Y%m%d)`, taking major.minor from `package.json`. If that version is already released, STOP and ask. Never add a suffix to the date: `1.14.2026101201` sorts above every later date and blocks future releases.

## How this works

A release is a `chore: release X` commit that bumps the version in `package.json` and `package-lock.json`, plus a `vX` tag **on that commit**. Pushing the tag runs `.github/workflows/build-vsix.yml`, which builds the VSIX and creates the GitHub release with it attached. The VSIX version comes from `package.json`, not from the tag.

**Shell variables don't persist between Bash calls.** Start every call with:
```bash
cd "$(git rev-parse --show-toplevel)"; R=teoboetti/vscode-react-native; V=<version>
```
Pass `--repo $R` to every `gh` call. The gh default repo here is upstream `microsoft/vscode-react-native`.

## Steps

**1. Preflight.** If any check fails, STOP and report it:
```bash
git fetch origin --quiet
git status --porcelain --untracked-files=no   # must print nothing
git rev-parse --abbrev-ref HEAD               # must be master
git rev-parse master origin/master            # both lines must match
gh run list --repo $R --workflow ci.yml --commit "$(git rev-parse HEAD)" --limit 1   # must be completed + success
node -p 'require("./package.json").version'   # must be lower than $V
```

**2. Tag check.**
```bash
git ls-remote --tags origin "v$V"   # prints anything → already released: STOP and report
git tag -l "v$V"                    # prints the tag → it's a stale local tag: git tag -d "v$V"
```

**3. Bump, commit, tag.**
```bash
OLD=$(node -p 'require("./package.json").version')
sed -i '' "s/\"version\": \"$OLD\"/\"version\": \"$V\"/" package.json package-lock.json
grep -c "\"version\": \"$V\"" package.json package-lock.json   # must be package.json:1, package-lock.json:2
git commit -am "chore: release $V"   # a pre-commit lint hook runs
git tag "v$V"
```
The commit gets no attribution trailers. If anything in steps 3-4 fails **before the push**, undo it with `git tag -d "v$V"; git reset --hard origin/master`, then STOP and report. This is safe because preflight confirmed there were no tracked changes.

**4. Push and verify.** Use a 10-minute Bash timeout.
```bash
git push --atomic origin master "v$V"   # both refs land, or neither does
for i in $(seq 12); do id=$(gh run list --repo $R --workflow build-vsix.yml --branch "v$V" --commit "$(git rev-parse HEAD)" --limit 1 --json databaseId -q '.[0].databaseId'); [ -n "$id" ] && break; sleep 5; done
gh run watch "${id:?no build-vsix run found for v$V}" --repo $R --exit-status --interval 15
gh release view "v$V" --repo $R --json url,assets -q '.url, .assets[].name'   # must list vscode-react-native-$V.vsix
```
If the build fails after the push, don't delete the pushed tag. Report the run URL; rerunning it is the user's call.

**5. Install.** The patched build lives in **VSCodium** (`codium`). VS Code (`code`) runs the Microsoft marketplace version, so don't touch it unless the request names it (then use `code` wherever this step says `codium`).
```bash
codium --list-extensions --show-versions | grep -x "msjsdiag.vscode-react-native@$V"   # prints → already installed: skip the next two commands
D=$(mktemp -d) && gh release download "v$V" --repo $R --dir "$D" && codium --install-extension "$D/vscode-react-native-$V.vsix" --force
codium --list-extensions --show-versions | grep -x "msjsdiag.vscode-react-native@$V"   # must print
```

## Report

Report in a few lines. On success, give the version, the commit sha, the release URL, the VSIX asset name, and the installed version if you installed. After an install, remind the user to run **Developer: Reload Window** in VSCodium. On a STOP, give the failing command, its output, and anything you undid.

## Common mistakes

| Mistake | Result |
|---|---|
| Tagging before bumping `package.json` | VSIX and release carry the previous version |
| Bumping only `package.json` | `npm ci` in the workflow fails on the lockfile mismatch |
| Using `npm version` to bump | Can rewrite the v2 lockfile |
| Bare `gh` without `--repo $R` | Queries the upstream Microsoft repo |
| Picking the build run without `--branch` + `--commit` | Can watch an old run from an earlier push of the same tag |
| Pushing `master` and the tag separately | One can land without the other, and the undo step then deletes the only copy of the tag |
| Installing a local `npx vsce package` build | Installed build differs from the published release |
