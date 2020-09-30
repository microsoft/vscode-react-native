import * as assert from "assert";
import { stripJsonTrailingComma } from "../../src/common/utils";

suite("utilHelper", function () {
  suite("stripJsonTrailingComma", function () {
    test("should remove trailing comma from a JSON", (done: Mocha.Done) => {
      const strWithTrailingComma = `
            {
                "runtimeArgs": [
                    "--inspect-brk=9237",
                    "start",
                ],
                "runtimeVersion": "12.16.3",
                "port": 9237,
                "type": "node",
                "name": "some-project",
                "timeout": 300000
            }
            `;
      const strippedStr = `
            {
                "runtimeArgs": [
                    "--inspect-brk=9237",
                    "start"
                ],
                "runtimeVersion": "12.16.3",
                "port": 9237,
                "type": "node",
                "name": "some-project",
                "timeout": 300000
            }
            `;
      assert.strictEqual(
        stripJsonTrailingComma(strWithTrailingComma),
        strippedStr
      );
      done();
    });
  });
});
