import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRequest,
  createResponse,
  createErrorResponse,
  serialize,
  deserializeRequest,
  deserializeResponse,
  decodeBody,
  PROTOCOL_VERSION,
  isErrorResponse,
} from './index.js';

describe('createRequest', () => {
  it('creates a valid request envelope with a UUID id', () => {
    const req = createRequest('GET', '/api/test', { accept: 'application/json' });
    assert.equal(req.v, PROTOCOL_VERSION);
    assert.match(req.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/api/test');
    assert.deepEqual(req.headers, { accept: 'application/json' });
    assert.equal(req.body, null);
  });

  it('prepends / to path if missing', () => {
    const req = createRequest('GET', 'no-slash');
    assert.equal(req.path, '/no-slash');
  });

  it('base64 encodes a string body', () => {
    const req = createRequest('POST', '/data', {}, '{"key":"value"}');
    assert.equal(req.body, Buffer.from('{"key":"value"}').toString('base64'));
  });

  it('base64 encodes a Buffer body', () => {
    const buf = Buffer.from([0x00, 0xff, 0x42]);
    const req = createRequest('PUT', '/bin', {}, buf);
    assert.equal(req.body, buf.toString('base64'));
  });

  it('sets body to null when no body provided', () => {
    const req = createRequest('DELETE', '/item');
    assert.equal(req.body, null);
  });
});

describe('createResponse', () => {
  it('creates a valid response envelope', () => {
    const body = Buffer.from('hello');
    const res = createResponse('req-123', 200, { 'content-type': 'text/plain' }, body);
    assert.equal(res.v, PROTOCOL_VERSION);
    assert.equal(res.id, 'req-123');
    assert.equal(res.status, 200);
    assert.deepEqual(res.headers, { 'content-type': 'text/plain' });
    assert.equal(res.body, body.toString('base64'));
  });

  it('sets body to null when no body provided', () => {
    const res = createResponse('req-456', 204, {});
    assert.equal(res.body, null);
  });
});

describe('createErrorResponse', () => {
  it('creates an error response with error field', () => {
    const res = createErrorResponse('req-789', 502, 'connection refused');
    assert.equal(res.v, PROTOCOL_VERSION);
    assert.equal(res.id, 'req-789');
    assert.equal(res.status, 502);
    assert.equal(res.error, 'connection refused');
  });
});

describe('serialize / deserialize round-trip', () => {
  it('round-trips a request', () => {
    const req = createRequest('POST', '/api/hook', { 'content-type': 'application/json' }, '{"a":1}');
    const json = serialize(req);
    const parsed = deserializeRequest(json);
    assert.deepEqual(parsed, req);
  });

  it('round-trips a success response', () => {
    const res = createResponse('id-1', 200, { 'x-foo': 'bar' }, Buffer.from('ok'));
    const json = serialize(res);
    const parsed = deserializeResponse(json);
    assert.deepEqual(parsed, res);
  });

  it('round-trips an error response', () => {
    const res = createErrorResponse('id-2', 500, 'internal');
    const json = serialize(res);
    const parsed = deserializeResponse(json);
    assert.deepEqual(parsed, res);
  });
});

describe('deserializeRequest validation', () => {
  it('throws on invalid JSON', () => {
    assert.throws(() => deserializeRequest('not json'), { name: 'SyntaxError' });
  });

  it('throws on missing version', () => {
    assert.throws(() => deserializeRequest('{"id":"x","method":"GET","path":"/","headers":{}}'));
  });

  it('throws on missing id', () => {
    assert.throws(() => deserializeRequest('{"v":1,"method":"GET","path":"/","headers":{}}'));
  });

  it('throws on missing method', () => {
    assert.throws(() => deserializeRequest('{"v":1,"id":"x","path":"/","headers":{}}'));
  });

  it('throws on missing path', () => {
    assert.throws(() => deserializeRequest('{"v":1,"id":"x","method":"GET","headers":{}}'));
  });

  it('throws on missing headers', () => {
    assert.throws(() => deserializeRequest('{"v":1,"id":"x","method":"GET","path":"/"}'));
  });
});

describe('deserializeResponse validation', () => {
  it('throws on invalid JSON', () => {
    assert.throws(() => deserializeResponse('{bad'), { name: 'SyntaxError' });
  });

  it('throws on missing status', () => {
    assert.throws(() => deserializeResponse('{"v":1,"id":"x"}'));
  });
});

describe('decodeBody', () => {
  it('decodes base64 to the original bytes', () => {
    const original = new TextEncoder().encode('hello world');
    const encoded = 'aGVsbG8gd29ybGQ=';
    const decoded = decodeBody(encoded);
    assert.ok(decoded);
    assert.deepEqual(decoded, original);
  });

  it('returns null for null input', () => {
    assert.equal(decodeBody(null), null);
  });
});

describe('isErrorResponse', () => {
  it('returns true for error responses', () => {
    const err = createErrorResponse('id', 502, 'fail');
    assert.equal(isErrorResponse(err), true);
  });

  it('returns false for success responses', () => {
    const res = createResponse('id', 200, {}, Buffer.from('ok'));
    assert.equal(isErrorResponse(res), false);
  });
});
