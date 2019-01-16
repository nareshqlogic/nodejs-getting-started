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

const proxyquire = require('proxyquire').noPreserveCache();
const sinon = require('sinon');
const assert = require('assert');

let background;
const mocks = {};

beforeEach(() => {
  // Mock dependencies used by background.js
  mocks.config = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    SUBSCRIPTION_NAME: 'shared-worker-subscription',
    TOPIC_NAME: 'book-process-queue',
  };
  mocks.config.get = function(key) {
    return this[key];
  };
  mocks.subscription = {
    on: sinon.stub(),
  };
  mocks.publisher = {
    publish: sinon.stub().callsArgWith(1, null),
  };
  mocks.topic = {
    createSubscription: sinon.stub().callsArgWith(1, null, mocks.subscription),
    publisher: sinon.stub().returns(mocks.publisher),
  };
  mocks.pubsub = {
    createTopic: sinon.stub().callsArgWith(1, null, mocks.topic),
    topic: sinon.stub().returns(mocks.topic),
  };
  mocks.Pubsub = sinon.stub().returns(mocks.pubsub);
  mocks.logging = {
    info: sinon.stub(),
    error: sinon.stub(),
  };
  // Load background.js with provided mocks
  background = proxyquire('../lib/background', {
    '@google-cloud/pubsub': mocks.Pubsub,
    '../config': mocks.config,
    './logging': mocks.logging,
  });

  assert.strictEqual(
    mocks.Pubsub.calledOnce,
    true,
    'Pubsub() should have been called once'
  );
});

it('should subscribe and log message', async () => {
  // Setup
  const testMessage = {test: 'foo'};

  // Run target functionality
  background.subscribe((err, message) => {
    // Assertions
    assert.strictEqual(err, null);
    assert.deepStrictEqual(message, testMessage, 'should have message');
    assert.strictEqual(
      mocks.pubsub.createTopic.calledOnce,
      true,
      'pubsub.createTopic() should have been called once'
    );
    assert.strictEqual(
      mocks.pubsub.createTopic.firstCall.args[0],
      'book-process-queue',
      'pubsub.createTopic() should have been called with the right args'
    );
    assert.strictEqual(
      mocks.pubsub.topic.callCount,
      0,
      'pubsub.topic() should NOT have been called'
    );
    assert.strictEqual(
      mocks.topic.createSubscription.calledOnce,
      true,
      'topic.createSubscription should have been called once'
    );
    assert.strictEqual(
      mocks.topic.createSubscription.firstCall.args[0],
      'shared-worker-subscription',
      'topic.createSubscription() should have been called with the right arguments'
    );
    assert.strictEqual(
      mocks.subscription.on.calledTwice,
      true,
      'subscription.on should have been called twice'
    );
    assert.strictEqual(
      mocks.subscription.on.firstCall.args[0],
      'message',
      'subscription.on() should have been called with the right arguments'
    );
    assert.strictEqual(
      typeof mocks.subscription.on.firstCall.args[1] === 'function',
      true,
      'subscription.on() should have been called with the right arguments'
    );
    assert.strictEqual(
      mocks.subscription.on.secondCall.args[0],
      'error',
      'subscription.on() should have been called with the right arguments'
    );
    assert.strictEqual(
      typeof mocks.subscription.on.secondCall.args[1] === 'function',
      true,
      'subscription.on() should have been called with the right arguments'
    );
  });
  await new Promise(r => setTimeout(r, 10));
  // Trigger a message
  mocks.subscription.on.firstCall.args[1]({
    data: JSON.stringify(testMessage),
    ack: sinon.stub(),
  });
});

it('should return topic error, if any', () => {
  // Setup
  const testErrorMsg = 'test error';
  mocks.pubsub.createTopic = sinon.stub().callsArgWith(1, testErrorMsg);

  // Run target functionality
  background.subscribe(data => {
    // Assertions
    assert.strictEqual(
      mocks.pubsub.createTopic.calledOnce,
      true,
      'pubsub.createTopic() should have been called once'
    );
    assert.strictEqual(
      mocks.pubsub.createTopic.firstCall.args[0],
      'book-process-queue',
      'pubsub.createTopic() should have been called with the right args'
    );
    assert.strictEqual(
      mocks.pubsub.topic.callCount,
      0,
      'pubsub.topic() should NOT have been called'
    );
    assert.strictEqual(data, testErrorMsg);
    assert.strictEqual(
      mocks.topic.createSubscription.callCount,
      0,
      'topic.createSubscription() should NOT have been called'
    );
    assert.strictEqual(
      mocks.subscription.on.callCount,
      0,
      'subscription.on() should NOT have been called'
    );
  });
});

it('should return subscription error, if any', () => {
  // Setup
  const testErrorMsg = 'test error';
  mocks.topic.createSubscription = sinon.stub().callsArgWith(1, testErrorMsg);

  // Run target functionality
  background.subscribe(data => {
    // Assertions
    assert.strictEqual(
      mocks.pubsub.createTopic.calledOnce,
      true,
      'pubsub.createTopic() should have been called once'
    );
    assert.strictEqual(
      mocks.pubsub.createTopic.firstCall.args[0],
      'book-process-queue',
      'pubsub.createTopic() should have been called with the right args'
    );
    assert.strictEqual(
      mocks.pubsub.topic.callCount,
      0,
      'pubsub.topic() should NOT have been called'
    );
    assert.strictEqual(
      mocks.topic.createSubscription.calledOnce,
      true,
      'topic.createSubscription should have been called once'
    );
    assert.strictEqual(
      mocks.topic.createSubscription.firstCall.args[0],
      'shared-worker-subscription',
      'topic.createSubscription() should have been called with the right arguments'
    );
    assert.strictEqual(data, testErrorMsg);
    assert.strictEqual(
      mocks.subscription.on.callCount,
      0,
      'subscription.on() should NOT have been called'
    );
    assert.strictEqual(
      mocks.logging.info.callCount,
      0,
      'logging.info() should NOT have been called'
    );
  });
});

it('should queue a book and log message', () => {
  // Setup
  const testBookId = 1;

  // Run target functionality
  background.queueBook(testBookId);

  // Assertions
  assert.strictEqual(
    mocks.pubsub.createTopic.calledOnce,
    true,
    'pubsub.createTopic() should have been called once'
  );
  assert.strictEqual(
    mocks.pubsub.createTopic.firstCall.args[0],
    'book-process-queue',
    'pubsub.createTopic() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.pubsub.topic.callCount,
    0,
    'pubsub.topic() should NOT have been called'
  );
  assert.strictEqual(
    mocks.topic.publisher.calledOnce,
    true,
    'topic.publisher() should have been called once'
  );
  assert.strictEqual(
    mocks.publisher.publish.calledOnce,
    true,
    'publisher.publish() should have been called once'
  );
  assert.deepStrictEqual(
    mocks.publisher.publish.firstCall.args[0],
    Buffer.from(
      JSON.stringify({
        action: 'processBook',
        bookId: testBookId,
      })
    ),
    'publisher.publish() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.logging.info.calledOnce,
    true,
    'logging.info() should have been called'
  );
  assert.strictEqual(
    mocks.logging.info.firstCall.args[0],
    `Book ${testBookId} queued for background processing`,
    'logging.info() should have been called with the right arguments'
  );
});

it('should queue a book and log message even if topic exists', () => {
  // Setup
  const testBookId = 1;
  mocks.pubsub.createTopic = sinon.stub().callsArgWith(1, {
    code: 6,
  });

  // Run target functionality
  background.queueBook(testBookId);

  // Assertions
  assert.strictEqual(
    mocks.pubsub.createTopic.calledOnce,
    true,
    'pubsub.createTopic() should have been called once'
  );
  assert.strictEqual(
    mocks.pubsub.createTopic.firstCall.args[0],
    'book-process-queue',
    'pubsub.createTopic() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.pubsub.topic.calledOnce,
    true,
    'pubsub.topic() should have been called once'
  );
  assert.strictEqual(
    mocks.pubsub.topic.firstCall.args[0],
    'book-process-queue',
    'pubsub.topic() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.topic.publisher.calledOnce,
    true,
    'topic.publisher() should have been called once'
  );
  assert.strictEqual(
    mocks.publisher.publish.calledOnce,
    true,
    'publisher.publish() should have been called once'
  );
  assert.deepStrictEqual(
    mocks.publisher.publish.firstCall.args[0],
    Buffer.from(
      JSON.stringify({
        action: 'processBook',
        bookId: testBookId,
      })
    ),
    'publisher.publish() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.logging.info.calledOnce,
    true,
    'logging.info() should have been called'
  );
  assert.strictEqual(
    mocks.logging.info.firstCall.args[0],
    `Book ${testBookId} queued for background processing`,
    'logging.info() should have been called with the right arguments'
  );
});

it('should log error if cannot get topic', () => {
  // Setup
  const testBookId = 1;
  const testErrorMsg = 'test error';
  mocks.pubsub.createTopic = sinon.stub().callsArgWith(1, testErrorMsg);

  // Run target functionality
  background.queueBook(testBookId);

  // Assertions
  assert.strictEqual(
    mocks.pubsub.createTopic.calledOnce,
    true,
    'pubsub.createTopic() should have been called once'
  );
  assert.strictEqual(
    mocks.pubsub.createTopic.firstCall.args[0],
    'book-process-queue',
    'pubsub.createTopic() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.pubsub.topic.callCount,
    0,
    'pubsub.topic() should NOT have been called'
  );
  assert.strictEqual(
    mocks.topic.publisher.callCount,
    0,
    'topic.publisher() should NOT have been called'
  );
  assert.strictEqual(
    mocks.publisher.publish.callCount,
    0,
    'publisher.publish() should NOT have been called'
  );
  assert.strictEqual(
    mocks.logging.info.callCount,
    0,
    'logging.info() should NOT have been called'
  );
  assert.strictEqual(
    mocks.logging.error.calledOnce,
    true,
    'logging.error() should have been called'
  );
});

it('should log error if cannot publish message', () => {
  // Setup
  const testBookId = 1;
  const testErrorMsg = 'test error';
  mocks.topic.publish = sinon.stub().callsArgWith(1, testErrorMsg);

  // Run target functionality
  background.queueBook(testBookId);

  // Assertions
  assert.strictEqual(
    mocks.pubsub.createTopic.calledOnce,
    true,
    'pubsub.createTopic() should have been called once'
  );
  assert.strictEqual(
    mocks.pubsub.createTopic.firstCall.args[0],
    'book-process-queue',
    'pubsub.createTopic() should have been called with the right arguments'
  );
  assert.strictEqual(
    mocks.pubsub.topic.callCount,
    0,
    'pubsub.topic() should NOT have been called'
  );
  assert.strictEqual(
    mocks.topic.publisher.calledOnce,
    true,
    'topic.publisher() should have been called once'
  );
  assert.strictEqual(
    mocks.publisher.publish.calledOnce,
    true,
    'publisher.publish() should have been called once'
  );
});
