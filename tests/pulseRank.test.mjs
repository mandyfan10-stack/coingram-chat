import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  rankPulseFeed,
  scorePulseItem,
  applyDiversity,
  buildTagAffinity,
  classifyWatch,
  dedupePulseItems,
  demoteWatchedInFeed,
  isFreshForUser,
  PULSE_RANK_WEIGHTS
} from '../src/utils/pulseRank.js';

const items = [
  { id: 'a', youtubeId: 'yt-a', tags: ['music', 'pop'], reactCount: 2, commentCount: 0, durationSec: 200 },
  { id: 'b', youtubeId: 'yt-b', tags: ['music', 'pop'], reactCount: 1, commentCount: 1, durationSec: 200 },
  { id: 'c', youtubeId: 'yt-c', tags: ['funny'], reactCount: 50, commentCount: 0, durationSec: 60 },
  { id: 'd', youtubeId: 'yt-d', tags: ['rock'], reactCount: 0, commentCount: 0, durationSec: 180 },
  { id: 'e', youtubeId: 'yt-e', tags: ['nature'], reactCount: 0, commentCount: 0, durationSec: 120 }
];

describe('pulseRank', () => {
  it('classifyWatch detects skip, engage, complete', () => {
    assert.equal(classifyWatch({ watchMs: 800, watchedSec: 0.5, durationSec: 100 }).skipped, true);
    assert.equal(classifyWatch({ watchMs: 8000, watchedSec: 10, durationSec: 100 }).engaged, true);
    assert.equal(classifyWatch({ watchMs: 90000, watchedSec: 80, durationSec: 100 }).completed, true);
  });

  it('dedupePulseItems drops duplicate youtube ids', () => {
    const out = dedupePulseItems([
      { id: '1', youtubeId: 'same' },
      { id: '2', youtubeId: 'same' },
      { id: '3', youtubeId: 'other' }
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].id, '1');
    assert.equal(out[1].id, '3');
  });

  it('fresh items always rank before watched recycled ones', () => {
    const ranked = rankPulseFeed(items, {
      friendIds: [],
      myId: 'me',
      // c is most popular but already completed
      myViewsByItem: {
        c: { watchMs: 60000, watchedSec: 55, durationSec: 60, completed: true }
      },
      viewsByItem: {
        c: [{ profileId: 'me', watchMs: 60000, watchedSec: 55, durationSec: 60, completed: true }]
      }
    });
    const idxC = ranked.findIndex((x) => x.id === 'c');
    // All other unwatched should appear before recycled c
    for (const id of ['a', 'b', 'd', 'e']) {
      assert.ok(ranked.findIndex((x) => x.id === id) < idxC, `${id} should be before c`);
    }
  });

  it('sessionSeenIds force item out of fresh queue', () => {
    assert.equal(
      isFreshForUser(items[0], { sessionSeenIds: ['a'], myViewsByItem: {} }),
      false
    );
    const ranked = rankPulseFeed(items, {
      friendIds: [],
      sessionSeenIds: ['c'],
      myViewsByItem: {}
    });
    // c was popular but session-seen → after fresh items
    const firstFresh = ranked.filter((x) => x._fresh);
    assert.ok(firstFresh.every((x) => x.id !== 'c'));
    assert.ok(ranked.some((x) => x.id === 'c' && x._fresh === false));
  });

  it('demoteWatchedInFeed moves item to end without reshuffling rest', () => {
    const feed = [
      { id: 'a', _score: 10 },
      { id: 'b', _score: 9 },
      { id: 'c', _score: 8 }
    ];
    const next = demoteWatchedInFeed(feed, 'a');
    assert.deepEqual(
      next.map((x) => x.id),
      ['b', 'c', 'a']
    );
  });

  it('boosts items liked by friends above pure popularity (among fresh)', () => {
    const ranked = rankPulseFeed(items, {
      friendIds: ['friend-1'],
      reactionsByItem: {
        a: ['friend-1'],
        c: []
      },
      viewsByItem: {}
    });
    assert.equal(ranked[0].id, 'a');
    assert.ok(ranked[0]._score >= PULSE_RANK_WEIGHTS.FRIEND_LIKE);
  });

  it('boosts friend views over threshold', () => {
    const affinity = buildTagAffinity(items, {
      friendIds: ['f1'],
      reactionsByItem: {}
    });
    const scored = scorePulseItem(
      items[3],
      {
        friendIds: ['f1'],
        viewsByItem: {
          d: [{ profileId: 'f1', watchMs: 5000, watchedSec: 8, durationSec: 180 }]
        }
      },
      affinity
    );
    assert.ok(scored.score >= PULSE_RANK_WEIGHTS.FRIEND_VIEW);
    assert.deepEqual(scored.engagedFriendIds, ['f1']);
  });

  it('penalizes skipped items hard', () => {
    const affinity = buildTagAffinity(items, { friendIds: [] });
    const base = scorePulseItem(items[2], { friendIds: [] }, affinity);
    const skipped = scorePulseItem(
      items[2],
      {
        friendIds: [],
        myViewsByItem: {
          c: { watchMs: 900, watchedSec: 0.8, durationSec: 60, skipped: true }
        }
      },
      affinity
    );
    assert.ok(skipped.score < base.score - 40);
  });

  it('taste from completed watches boosts similar tags for FRESH items only', () => {
    const ranked = rankPulseFeed(items, {
      friendIds: [],
      myId: 'me',
      reactionsByItem: {},
      viewsByItem: {
        a: [{ profileId: 'me', watchMs: 150000, watchedSec: 160, durationSec: 200, completed: true }]
      },
      myViewsByItem: {
        a: { watchMs: 150000, watchedSec: 160, durationSec: 200, completed: true }
      }
    });
    // a is recycled (completed); b shares tags and is fresh → b before a
    assert.ok(ranked.findIndex((x) => x.id === 'b') < ranked.findIndex((x) => x.id === 'a'));
  });

  it('diversity avoids three same primary tags when alternatives exist', () => {
    const ordered = [
      { id: '1', tags: ['music'], _score: 10 },
      { id: '2', tags: ['music'], _score: 9 },
      { id: '3', tags: ['music'], _score: 8 },
      { id: '4', tags: ['funny'], _score: 7 }
    ];
    const out = applyDiversity(ordered);
    const tags = out.map((i) => i.tags[0]);
    assert.notEqual(tags[0] + tags[1] + tags[2], 'musicmusicmusic');
    assert.ok(tags.includes('funny'));
  });

  it('empty friends falls back to popularity among fresh', () => {
    const ranked = rankPulseFeed(items, {
      friendIds: [],
      reactionsByItem: {},
      viewsByItem: {}
    });
    assert.equal(ranked[0].id, 'c');
  });
});
