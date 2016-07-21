/**
 * @providesModule callApiAsync
 */

import { NativeModules } from 'react-native';
const { ExponentConstants } = NativeModules;

import { isString, isObject } from 'lodash';

const HOST = 'https://exponent-push-server.herokuapp.com';
const TIMEOUT = 12000;

export default async function callApiAsync(collection, args = [], query = {}, options = {}) {
  let fetchOpts = {};
  let method = options.method || 'get';
  let argString = args.map(encodeURIComponent).join('/');
  if (argString) {
    argString = '/' + argString;
  }

  let queryString = _queryObjToString(query);
  let apiUrl = `${HOST}/${collection}${argString}` + (queryString.length ? ('?' + queryString) : '');

  try {
    let headers = {};

    if (options.method === 'post' || options.method === 'put') {
      headers['Content-Type'] = 'application/json';
      if (isString(options.postBody)) {
        fetchOpts.body = options.postBody;
      } else if (options.postBody instanceof FormData) {
        fetchOpts.body = options.postBody;
        headers['Content-Type'] = 'multipart/form-data';
      } else if (isObject(options.postBody)) {
        fetchOpts.body = JSON.stringify(options.postBody);
      } else {
        fetchOpts.body = '';
      }
      headers['Content-Length'] = fetchOpts.body.length;
    }
    fetchOpts = Object.assign(fetchOpts, {
      method,
      headers,
    });

    let response = await _timeoutAsync(
      fetch(apiUrl, fetchOpts),
      options.timeout || TIMEOUT,
    );

    // Handle all 4xx and 5xx errors
    if (response.status >= 400 && response.status < 600) {
      throw _createApiError('Request failed.', response.status);
    }

    let json = await response.json();
    return json;
  } catch (error) {
    throw _createApiError(error, 'API_FAILURE');
  }
}

function _queryObjToString(obj) {
  let pairs = [];
  for (let key in obj) {
    let val = obj[key];
    if (val !== undefined) {
      let pair = encodeURIComponent(key) + '=' + encodeURIComponent(val);
      pairs.push(pair);
    }
  }
  return pairs.length ? pairs.join('&') : '';
}

function _createApiError(error, code) {
  if (error._isApiError) {
    return error;
  }

  var apiError = new Error(`API Error: ${error.message}`);
  apiError._isApiError = true;
  apiError.message = error;
  apiError.code = code;
  return apiError;
}

function _timeoutAsync(promise, ms) {
  return new Promise((resolve, reject) => {
    let _timer = setTimeout(() => {
      reject(new Error('API timeout'));
    }, ms);

    promise.then((result) => {
      clearTimeout(_timer);
      return resolve(result);
    }, reject);
  });
}
