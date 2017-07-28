// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SourceMapsCombinator } from "../../debugger/sourceMapsCombinator";

import * as assert from "assert";
import * as sinon from "sinon";
import * as fs from "fs";
import * as path from "path";

suite("sourceMapsCombinator", function () {
    let sandbox: Sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.sandbox.create();
    });

    suiteTeardown(() => {
        sandbox.restore();
    });

    suite("#convert", () => {
        test("convert sourcemap", () => {
            const pathToJS = "D:/hello.js";
            const pathToTS = "D:/hello.ts";
            const sourcemapPath = "D:/hello.js.map";
            const code = fs.readFileSync(path.resolve(__dirname, "assets/hello.js"));
            const mapTS = `{"version":3,"sources":["D:/hello.ts"],"names":[],"mappings":"AAAA,MAAM,MAAM;IACR,YAAY,CAAC,OAAO,GAAG,EAAE,MAAM,CAAC;IAChC;IACA,OAAO,QAAQ,CAAC,EAAE;QACd,OAAO,OAAO,EAAE,IAAI,CAAC,IAAI,EAAE,OAAO;IACtC;AACJ;;AAEA,MAAM,MAAM,EAAE,IAAI,KAAK,CAAC,gDAAgD,CAAC;;AAEzE,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,QAAQ,CAAC,CAAC,CAAC","file":"hello.js","sourceRoot":""}`;
            const codeTS = fs.readFileSync(path.resolve(__dirname, "../../../src/test/debugger/assets/hello.ts"));

            const expected = {
                "version": 3,
                "sources": [
                    "D:/hello.ts",
                ],
                "names": [],
                "mappings": "AAAA,IAAA,MAAM,EAAM,CAAA,SAAA,CAAA,EAAA;IACR,SAAA,KAAa,CAAA,GAAA,EAAO;QACpB,IAAA,CAAA,IAAA,EAAA,GAAA;IACA;SACI,CAAA,SAAO,CAAA,SAAc,EAAA,SAAM,CAAA,EAAO;QACtC,OAAA,OAAA,EAAA,IAAA,CAAA,IAAA,EAAA,OAAA;IACJ,CAAA;;AAEA,CAAA,CAAA,CAAA,CAAA;;AAEA,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,QAAQ,CAAC,CAAC,CAAC",
            };

            let rawBundleSourcemap = { "version": 3, "sources": ["D:/hello.js"], "names": [], "mappings": "AAAA,IAAI,MAAM,EAAE,CAAC,SAAS,CAAC,EAAE;IACrB,SAAS,KAAK,CAAC,GAAG,EAAE;QAChB,IAAI,CAAC,IAAI,EAAE,GAAG;IAClB;IACA,KAAK,CAAC,SAAS,CAAC,SAAS,EAAE,SAAS,CAAC,EAAE;QACnC,OAAO,OAAO,EAAE,IAAI,CAAC,IAAI,EAAE,OAAO;IACtC,CAAC;IACD,OAAO,KAAK;AAChB,CAAC,CAAC,CAAC,CAAC;AACJ,IAAI,MAAM,EAAE,IAAI,KAAK,CAAC,gDAAgD,CAAC;AACvE,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,QAAQ,CAAC,CAAC,CAAC", "file": "hello.js", "sourceRoot": "" };

            const stub = sandbox.stub(fs, "readFileSync");

            stub.withArgs(pathToJS).returns(code);
            stub.withArgs(sourcemapPath).returns(mapTS);
            stub.withArgs(pathToTS).returns(codeTS);
            let sourceMapsCombinator = new SourceMapsCombinator();
            let result = sourceMapsCombinator.convert(rawBundleSourcemap);
            result.sources = result.sources.map(p => {
                return p.replace(/\\/g, "/");
            });
            assert.deepEqual(expected, result);
        });
    });
});