const assert = require('node:assert/strict');
const blacklistUtils = require('../blacklist-utils.js');

function run() {
  assert.deepEqual(
    blacklistUtils.normalizeMatchModes([], 'prefix'),
    ['prefix'],
    'empty match modes should fall back to prefix when requested'
  );

  assert.deepEqual(
    blacklistUtils.normalizeMatchModes([], null),
    [],
    'empty match modes should stay empty when fallback is disabled'
  );

  assert.equal(
    blacklistUtils.normalizePattern('https://Example.com/settings?tab=1#hash', ['exact'], null),
    'example.com/settings?tab=1',
    'exact mode should normalize host casing and strip hash'
  );

  assert.equal(
    blacklistUtils.normalizePattern('example.com/docs/', ['prefix'], null),
    'example.com/docs/',
    'prefix mode should accept domain/path input without scheme'
  );

  assert.equal(
    blacklistUtils.normalizePattern('settings', ['suffix'], null),
    '/settings',
    'suffix mode should normalize into a slash-prefixed suffix'
  );

  assert.equal(
    blacklistUtils.normalizePattern('https://example.com/settings', ['suffix'], null),
    '',
    'suffix mode should reject full URLs'
  );

  assert.deepEqual(
    blacklistUtils.normalizeItems([
      'example.com/a',
      { pattern: 'example.com/a', matchModes: ['prefix'] },
      { pattern: 'example.com/a', matchModes: ['exact'] }
    ], 'prefix'),
    [
      { pattern: 'example.com/a', matchModes: ['prefix'] },
      { pattern: 'example.com/a', matchModes: ['exact'] }
    ],
    'items should dedupe by pattern + match mode, not pattern alone'
  );

  assert.equal(
    blacklistUtils.isUrlBlocked('https://example.com/docs/article#section', [
      { pattern: 'example.com/docs/', matchModes: ['prefix'] }
    ]),
    true,
    'prefix rules should match normalized URLs and ignore hashes'
  );

  assert.equal(
    blacklistUtils.isUrlBlocked('http://example.com/a', [
      { pattern: 'example.com/a', matchModes: ['exact'] }
    ]),
    true,
    'exact rules should not depend on http vs https input'
  );

  assert.equal(
    blacklistUtils.isUrlBlocked('https://exampleurl.com/settings', [
      { pattern: '/settings', matchModes: ['suffix'] }
    ]),
    true,
    'suffix rules should match a trailing path segment'
  );

  assert.equal(
    blacklistUtils.isUrlBlocked('https://exampleurl2.com/test/settings', [
      { pattern: '/settings', matchModes: ['suffix'] }
    ]),
    true,
    'suffix rules should match nested paths that end with the same suffix'
  );

  assert.equal(
    blacklistUtils.isUrlBlocked('chrome://extensions', [
      { pattern: 'extensions', matchModes: ['suffix'] }
    ]),
    false,
    'non-http URLs should not be matched by blacklist rules'
  );
}

run();
console.log('blacklist tests passed');
