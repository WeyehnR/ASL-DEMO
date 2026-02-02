/**
 * LRUCache Unit Tests
 * Run with: node Test/js/tests/lru-cache.test.js
 *
 * Tests the LRU (Least Recently Used) cache — a fixed-size key-value store
 * that automatically evicts the oldest unused entry when it runs out of room.
 *
 * Why LRU matters in this project:
 *   VideoService caches blob URLs for the 20 most recently hovered words.
 *   When the 21st word is hovered, the least recently used blob gets evicted
 *   and its URL is revoked to free memory. If the LRU is broken, either:
 *     - Memory leaks (blobs never evicted)
 *     - Wrong videos evicted (user keeps seeing stale data)
 *     - onEvict never fires (blob URLs pile up forever)
 *
 * The cache is built from two structures:
 *   1. A Map — for O(1) key→node lookup
 *   2. A doubly-linked list (Node objects) — for tracking access order
 *      Head = most recently used, Tail = least recently used
 *
 * Key behaviors to verify:
 *   - put/get: basic storage and retrieval
 *   - Overwrite: put same key twice updates value (doesn't duplicate)
 *   - Eviction: when capacity is exceeded, the TAIL (LRU) is removed
 *   - Eviction callback: onEvict fires with the correct key and value
 *   - Access promotion: get() moves a node to HEAD, saving it from eviction
 *   - Update promotion: put() on existing key also moves to HEAD
 */

import { LRUCache } from '../utils/LRUCache.js';

const LRUCacheTests = {
  results: [],

  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    return passed;
  },

  /**
   * Tests basic put() and get() operations.
   *
   * put(key, value) stores data, get(key) retrieves it.
   * get() on a missing key should return null (not undefined, not an error).
   *
   * This is the most fundamental test — if put/get don't work,
   * nothing else in the cache works either.
   */
  testPutAndGet() {
    const cache = new LRUCache(3);

    // TODO: put a key-value pair into the cache
    cache.put('a',1)
    // TODO: assert that get() returns the value you stored
    // console.log(cache.get('a'))
    this.assert(cache.get('a') === 1, 'get() returns the value you stored')
    // TODO: assert that get() on a key that was never stored returns null
    this.assert(cache.get('b') === null, 'get() on a key that was never stored returns null')
  },

  /**
   * Tests that putting the same key twice updates the value in place.
   *
   * This is important because VideoService might re-fetch a word's video
   * (e.g., if the first fetch was partial). The cache should update the
   * existing entry, NOT create a duplicate.
   *
   * Also verify the cache size stays the same (still 1 entry, not 2).
   */
  testOverwrite() {
    const cache = new LRUCache(3);

    // TODO: put("a", "first") then put("a", "second")
    cache.put("a", "first")
    cache.put("a", "second")
    // TODO: assert get("a") returns "second"
    this.assert(cache.get("a")=== "second",'get("a") returns "second"')
    // TODO: assert cache.map.size is still 1 (not 2)
    this.assert(cache.map.size === 1,'cache.map.size is still 1 (not 2)')
  },

  /**
   * Tests that the cache evicts the LEAST recently used entry when full.
   *
   * With capacity 3:
   *   put A, put B, put C  → cache is full [C, B, A] (A is tail/LRU)
   *   put D                → cache must evict A (the tail / oldest)
   *
   * After eviction:
   *   - get("a") should return null (evicted)
   *   - get("b"), get("c"), get("d") should still work
   *
   * This is the core LRU guarantee: the item you haven't touched
   * in the longest time is the first to go.
   */
  testEviction() {
    const cache = new LRUCache(3);

    // TODO: put 4 items into a capacity-3 cache (keys "a", "b", "c", "d")
    cache.put("a",1)
    cache.put("b",2)
    cache.put("c",3)
    cache.put("d",4)
    // TODO: assert the first key ("a") was evicted — get("a") === null
    this.assert(cache.get("a") === null, 'a was evicted')
    // TODO: assert the other three keys are still retrievable
    this.assert(cache.get("d") === 4, 'd is retrievable')
    this.assert(cache.get("c") === 3, 'c is retrievable')
    this.assert(cache.get("b") === 2, 'b is retrievable')
  },

  /**
   * Tests that the onEvict callback fires with the correct key and value.
   *
   * In VideoService, onEvict calls URL.revokeObjectURL() to free blob memory.
   * If onEvict doesn't fire, or fires with the wrong data, we leak memory.
   *
   * Strategy: pass a callback that records what it receives into an array,
   * then inspect the array after eviction happens.
   */
  testEvictionCallback() {
    const evicted = []; // Will collect { key, value } objects
    const cache = new LRUCache(2, (key, value) => {
      evicted.push({ key, value });
    });

    // TODO: put 3 items into a capacity-2 cache to trigger one eviction
    cache.put("a",1)
    cache.put("b",2)
    cache.put("c",3)
    // TODO: assert evicted.length === 1
    this.assert(evicted.length === 1, 'evicted length is 1')
    // TODO: assert the evicted entry has the correct key and value (the first one you inserted)
    this.assert(evicted[0].key === 'a' && evicted[0].value === 1, "evicted entry has the correct key and value")
  },

  /**
   * Tests that get() promotes an item to most-recently-used (head).
   *
   * This is the "LRU" part of LRU Cache. Without this, get() would be
   * just a Map lookup, and eviction would always remove the oldest INSERT
   * rather than the oldest ACCESS.
   *
   * Scenario with capacity 3:
   *   put A, put B, put C         → order: [C, B, A] (A is tail/LRU)
   *   get("a")                    → promotes A to head: [A, C, B] (B is now LRU)
   *   put D                       → evicts B (the new tail), NOT A
   *
   * This is why the linked list exists — the Map alone can't track access order.
   */
  testGetPromotesToMRU() {
    const cache = new LRUCache(3);

    // TODO: put "a", "b", "c"
    cache.put("a", 1);
    cache.put("b", 2);
    cache.put("c", 3);
    // TODO: get("a") — this should save "a" from eviction
    cache.get("a");
    // TODO: put "d" — this should evict "b" (the new LRU), not "a"
    cache.put("d", 4);
    // TODO: assert get("a") still returns its value (was promoted, not evicted)
    this.assert(cache.get("a") === 1, 'get() promotes to MRU — "a" survives eviction');
    // TODO: assert get("b") returns null (was evicted as the new LRU)
    this.assert(cache.get("b") === null, 'get() promotes to MRU — "b" was evicted as new LRU');
    // TODO: assert get("c") and get("d") still work
    this.assert(cache.get("c") === 3, 'get() promotes to MRU — "c" still retrievable');
    this.assert(cache.get("d") === 4, 'get() promotes to MRU — "d" still retrievable');
  },

  /**
   * Tests that put() on an existing key also promotes it to head.
   *
   * Similar to testGetPromotesToMRU, but triggered by an UPDATE instead of a read.
   * If put() didn't promote, updating an old entry wouldn't save it from eviction.
   *
   * Scenario with capacity 3:
   *   put A, put B, put C         → [C, B, A]
   *   put("a", newValue)          → updates & promotes: [A, C, B]
   *   put D                       → evicts B, not A
   */
  testUpdatePromotesToMRU() {
    const cache = new LRUCache(3);

    // TODO: put "a", "b", "c"
    cache.put("a", 1);
    cache.put("b", 2);
    cache.put("c", 3);
    // TODO: put "a" again with a new value — this should promote "a"
    cache.put("a", 99);
    // TODO: put "d" — should evict "b"
    cache.put("d", 4);
    // TODO: assert get("a") returns the NEW value
    this.assert(cache.get("a") === 99, 'put() promotes to MRU — "a" updated to new value');
    // TODO: assert get("b") returns null (evicted)
    this.assert(cache.get("b") === null, 'put() promotes to MRU — "b" evicted as new LRU');
  },

  /**
   * Tests edge case: capacity of 1.
   *
   * Every new put() should evict the previous entry.
   * This verifies the linked list handles the case where head === tail
   * (only one node in the list).
   */
  testCapacityOne() {
    const evicted = [];
    const cache = new LRUCache(1, (key, value) => {
      evicted.push({ key, value });
    });

    // TODO: put "a" — cache has one item, no eviction
    cache.put("a", 1);
    // TODO: assert get("a") works
    this.assert(cache.get("a") === 1, 'capacity-1 — get("a") works');
    // TODO: put "b" — should evict "a"
    cache.put("b", 2);
    // TODO: assert get("a") returns null
    this.assert(cache.get("a") === null, 'capacity-1 — "a" evicted after "b" inserted');
    // TODO: assert get("b") works
    this.assert(cache.get("b") === 2, 'capacity-1 — get("b") works');
    // TODO: assert evicted[0].key === "a"
    this.assert(evicted[0].key === "a", 'capacity-1 — onEvict fired with correct key');
  },

  runAll() {
    this.results = [];

    this.testPutAndGet();
    this.testOverwrite();
    this.testEviction();
    this.testEvictionCallback();
    this.testGetPromotesToMRU();
    this.testUpdatePromotesToMRU();
    this.testCapacityOne();

    // Report results
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    console.log(`\n=== LRUCache Tests: ${passed}/${total} passed ===\n`);

    this.results.forEach(r => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${r.testName}`);
    });

    return { passed, total, allPassed: passed === total };
  }
};

// Run tests
LRUCacheTests.runAll();
