"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const semver = require("semver");
// Check if the given string is a semver-compliant version number (e.g. '1.2.3')
// (missing minor/patch values will be added on server side to pass semver.satisfies check)
function isValidVersion(version) {
    return !!semver.valid(version) || /^\d+\.\d+$/.test(version) || /^\d+$/.test(version);
}
exports.isValidVersion = isValidVersion;
// Allow plain integer versions (as well as '1.0' values) for now, e.g. '1' is valid here and we assume that it is equal to '1.0.0'. 
function isValidRange(semverRange) {
    return !!semver.validRange(semverRange);
}
exports.isValidRange = isValidRange;
function isValidRollout(rollout) {
    return (rollout && rollout > 0 && rollout <= 100);
}
exports.isValidRollout = isValidRollout;
