/* eslint-env node, mocha */
var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require('chai-as-promised');
var assert = chai.assert;
var Promise = require('bluebird');
var MercadopagoResponse = require('../lib/utils/mercadopagoResponse');
var MercadopagoError = require('../lib/utils/mercadopagoError');
var requestManager = require('../lib/request-manager');

chai.use(chaiAsPromised);

describe('mercadopagoResponse Class', function () {
  describe('Constructor', function () {
    it('with no arguments', function () {
      var mpResponse = new MercadopagoResponse();

      assert.instanceOf(mpResponse, MercadopagoResponse, 'mpResponse is an instance of MercadopagoResponse');
      assert.isUndefined(mpResponse.body);
      assert.isUndefined(mpResponse.status);
      assert.isUndefined(mpResponse.idempotency);
      assert.isUndefined(mpResponse.pagination);
    });

    it('with arguments', function () {
      var mpResponse = new MercadopagoResponse({}, 200, 'idempotency', {});

      assert.instanceOf(mpResponse, MercadopagoResponse, 'mpResponse is an instance of MercadopagoResponse');
      assert.equal(JSON.stringify(mpResponse.body), JSON.stringify({}));
      assert.equal(mpResponse.status, 200);
      assert.equal(mpResponse.idempotency, 'idempotency');
      assert.equal(JSON.stringify(mpResponse.pagination), JSON.stringify({}));
    });
  });

  describe('Pagination', function(){
    it('hasNext()', function () {
      var mpResponseWithoutNext = new MercadopagoResponse({}, 200, 'idempotency', {
        total: 100,
        limit: 10,
        offset: 0
      }, {});

      var mpResponseWithNext = new MercadopagoResponse({}, 200, 'idempotency', {
        total: 100,
        limit: 10,
        offset: 95
      }, {});

      assert.isTrue(mpResponseWithoutNext.hasNext());
      assert.isFalse(mpResponseWithNext.hasNext());
    });

    it('next() - No pagination available', function () {
      var promise;
      var callback = sinon.spy();

      var mpResponse = new MercadopagoResponse({}, 200, 'idempotency', undefined, {});

      promise = mpResponse.next(callback);

      assert.isRejected(promise, 'This response doesnt support pagination');

      promise.catch(function () {
        var callbackError = callback.args[0][0];

        assert.isTrue(callback.called);

        assert.equal(callbackError.message, 'This response doesnt support pagination');
      });
    });

    it('next() - No pagination available', function () {
      var promise;
      var callback = sinon.spy();

      var mpResponse = new MercadopagoResponse({}, 200, 'idempotency', undefined, {});

      promise = mpResponse.next(callback);

      assert.isRejected(promise, 'This response doesnt support pagination');

      promise.catch(function () {
        var callbackError = callback.args[0][0];

        assert.isTrue(callback.called);

        assert.equal(callbackError.message, 'This response doesnt support pagination');
      });
    });

    it('next() - Get Next Page', function () {
      var promise;
      var callback = sinon.spy();
      var execOptions = {
        config: {
          qs: {}
        }
      };
      var mpResponse = new MercadopagoResponse({
        paging: {
          total: 200,
          limit: 20,
          offset: 10
        },
        results: [
          {
            id: 1
          },
          {
            id: 2
          }
        ]
      }, 200, 'idempotency', {
        total: 200,
        limit: 20,
        offset: 10
      }, execOptions, requestManager);

      var generateToken = sinon.stub(requestManager, 'generateAccessToken', function (callbackToken) {
        return new Promise(function (resolve) {
          resolve('ACCESS_TOKEN');
          return callbackToken.apply(null, ['ACCESS_TOKEN', null]);
        });
      });

      var requestStub = sinon.stub(requestManager, 'exec', function(options, callbackExec){
        return new Promise(function (resolve) {
          resolve(mpResponse);
          return callbackExec.apply(null, [null, mpResponse]);
        });
      });

      promise = mpResponse.next(callback);

      assert.isFulfilled(promise);

      promise.then(function () {
        var requestArgs;

        assert.isTrue(generateToken.called);
        assert.isTrue(requestStub.called);

        requestArgs = requestStub.args[0][0];

        // Final offset must be: original offset + limit
        assert.equal(requestArgs.config.qs.offset, mpResponse.pagination.offset + mpResponse.pagination.limit);
        assert.equal(JSON.stringify(requestArgs), JSON.stringify(execOptions));
        assert.equal(JSON.stringify(requestArgs), JSON.stringify(mpResponse.getExecOptions()));

        generateToken.restore();
        requestStub.restore();
      });
    });

    it('next() - Get Next Page With Error', function () {
      var promise;
      var callback = sinon.spy();
      var execOptions = {
        config: {
          qs: {}
        }
      };
      var mpResponse = new MercadopagoResponse({
        paging: {
          total: 200,
          limit: 20,
          offset: 10
        },
        results: [
          {
            id: 1
          },
          {
            id: 2
          }
        ]
      }, 200, 'idempotency', {
        total: 200,
        limit: 20,
        offset: 10
      }, execOptions, requestManager);

      var generateToken = sinon.stub(requestManager, 'generateAccessToken', function (callbackToken) {
        return new Promise(function (resolve) {
          resolve('ACCESS_TOKEN');
          return callbackToken.apply(null, ['ACCESS_TOKEN', null]);
        });
      });

      var requestStub = sinon.stub(requestManager, 'exec', function (options, callbackExec) {
        return new Promise(function (resolve, reject) {
          var error = new MercadopagoError('Error', 'Cause', 500, 'idempotency');
          reject(error);
          return callbackExec.apply(null, [null, error]);
        });
      });

      promise = mpResponse.next(callback);

      assert.isRejected(promise);

      promise.catch(function () {
        var callbackError = callback.args[0][0];

        assert.instanceOf(callbackError, MercadopagoError);
        assert.equal(callbackError.message, 'Error');

        generateToken.restore();
        requestStub.restore();
      });
    });
  });
});