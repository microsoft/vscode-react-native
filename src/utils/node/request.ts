import request = require("request");
import http = require("http");
import Q = require("q");

export class Request {
    public request(uri: string, expectStatusOK = false): Q.Promise<any> {
        let result = Q.defer<any>();

        request(uri, function(error: any, response: http.IncomingMessage, body: any) {
            if (!error) {
                if (expectStatusOK && response.statusCode !== 200) {
                    result.reject(body);
                } else {
                    result.resolve(body);
                }
            } else {
                result.reject(error);
            }
        });

        return result.promise;
    }
}
