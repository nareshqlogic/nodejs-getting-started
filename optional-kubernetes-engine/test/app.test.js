// Copyright 2018, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const testConfig = require('./_test-config');
const proxyquire = require('proxyquire').noPreserveCache();
const sinon = require('sinon');
const assert = require('assert');
const utils = require('@google-cloud/nodejs-repo-tools');

it('should redirect / to /books', async () => {
  await utils
    .getRequest(testConfig)
    .get('/')
    .expect(302)
    .expect(response => {
      assert.strictEqual(
        new RegExp(/Redirecting to \/books/).test(response.text),
        true
      );
    });
});

it('should check config', () => {
  const nconfMock = {
    argv: sinon.stub().returnsThis(),
    env: sinon.stub().returnsThis(),
    file: sinon.stub().returnsThis(),
    defaults: sinon.stub().returnsThis(),
    get: function(setting) {
      return this[setting];
    },
  };

  function getMsg(setting) {
    return `You must set ${setting} as an environment variable or in config.json!`;
  }

  const testFunc = () => {
    proxyquire('../config', {nconf: nconfMock});
  };

  nconfMock.DATA_BACKEND = 'datastore';

  assert.throws(testFunc, Error, getMsg('GCLOUD_PROJECT'));
  nconfMock.GCLOUD_PROJECT = 'project';

  assert.throws(testFunc, Error, getMsg(`CLOUD_BUCKET`));
  nconfMock.CLOUD_BUCKET = `bucket`;

  assert.throws(testFunc, Error, getMsg(`OAUTH2_CLIENT_ID`));
  nconfMock.OAUTH2_CLIENT_ID = `foo`;

  assert.throws(testFunc, Error, getMsg(`OAUTH2_CLIENT_SECRET`));
  nconfMock.OAUTH2_CLIENT_SECRET = `bar`;

  assert.doesNotThrow(testFunc);

  nconfMock.DATA_BACKEND = 'cloudsql';

  assert.throws(testFunc, Error, getMsg('MYSQL_USER'));
  nconfMock.MYSQL_USER = 'user';

  assert.throws(testFunc, Error, getMsg('MYSQL_PASSWORD'));
  nconfMock.MYSQL_PASSWORD = 'password';

  assert.doesNotThrow(testFunc);
  nconfMock.DATA_BACKEND = `mongodb`;

  assert.throws(testFunc, Error, getMsg(`MONGO_DB_NAME`));
  nconfMock.MONGO_DB_NAME = `test`;

  assert.throws(testFunc, Error, getMsg(`MONGO_URL`));
  nconfMock.MONGO_URL = `url`;

  assert.throws(testFunc, Error, getMsg(`MONGO_COLLECTION`));
  nconfMock.MONGO_COLLECTION = `collection`;

  assert.doesNotThrow(testFunc);
});
