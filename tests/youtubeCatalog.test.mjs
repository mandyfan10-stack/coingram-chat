import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYtDuration,
  tasteQueriesFromTags
} from '../src/services/youtubeCatalog.js';

describe('youtubeCatalog helpers', () => {
  it('parses ISO-8601 durations', () => {
    assert.equal(parseYtDuration('PT15S'), 15);
    assert.equal(parseYtDuration('PT1M30S'), 90);
    assert.equal(parseYtDuration('PT1H2M3S'), 3723);
    assert.equal(parseYtDuration(''), 0);
  });

  it('builds taste queries from tags with exploration defaults', () => {
    const q = tasteQueriesFromTags(['music', 'cat-10', 'travel']);
    assert.ok(q.includes('music'));
    assert.ok(q.includes('travel'));
    assert.ok(!q.includes('cat-10'));
    assert.ok(q.length > 2);
  });
});
