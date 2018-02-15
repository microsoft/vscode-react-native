//
// Custom credentials object for talking to AppCenter
//

class AppCenterClientCredentials {
  constructor(getToken) {
    this.getToken = getToken;
  }

  signRequest(request, callback) {
    this.getToken()
      .then(token => {
        request.headers["x-api-token"] = token;
        callback(null);
      })
      .catch((err) => {
        callback(err);
      });
  }
}

module.exports = AppCenterClientCredentials;