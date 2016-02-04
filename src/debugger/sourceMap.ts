import url = require("url");
import path = require("path");

export class SourceMapUtil {
    /**
     * Updates source map URLs in the script body.
     */
    public updateScriptPaths(scriptBody: string, sourceMappingUrl: url.Url) {
        // Update the body with the new location of the source map on storage.
        return scriptBody.replace(/^\/\/# sourceMappingURL=(.*)$/m, "//# sourceMappingURL=" + path.basename(sourceMappingUrl.pathname));
    }

    /**
     * Given a script body and URL, this method parses the body and finds the corresponding source map URL.
     * If the source map URL is not found in the body in the expected form, null is returned.
     */
    public getSourceMapURL(scriptUrl: url.Url, scriptBody: string): url.Url {
        let result: url.Url = null;

        // scriptUrl = "http://localhost:8081/index.ios.bundle?platform=ios&dev=true"
        let sourceMappingRelativeUrl = this.sourceMapRelativeUrl(scriptBody); // sourceMappingRelativeUrl = "/index.ios.map?platform=ios&dev=true"
        if (sourceMappingRelativeUrl) {
            let sourceMappingUrl = url.parse(sourceMappingRelativeUrl);
            sourceMappingUrl.protocol = scriptUrl.protocol;
            sourceMappingUrl.host = scriptUrl.host;
            // parse() repopulates all the properties of the URL
            result = url.parse(url.format(sourceMappingUrl));
        }

        return result;
    }

    /**
     * Parses the body of a script searching for a source map URL.
     * Returns the first match if found, null otherwise.
     */
    private sourceMapRelativeUrl(body: string) {
        let match = body.match(/^\/\/# sourceMappingURL=(.*)$/m);
        // If match is null, the body doesn't contain the source map
        return match ? match[1] : null;
    }
}