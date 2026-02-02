/**
 * AppState Unit Tests
 * Run with: node Test/js/tests/state.test.js
 *
 * Key behaviors to verify:
 * - Setters store values correctly
 * - setLoading(true) has a side effect: resets hasVideo to false
 * - setHasVideo() has a side effect: sets isLoading to false
 * - reset() clears ALL fields back to defaults
 * - State doesn't leak between calls (no stale values)
 */

import { AppState } from '../model/state.js';

const AppStateTests = {
  results: [],

  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    return passed;
  },

  // Reset before each test group to prevent state leaking between tests
  setup() {
    AppState.reset();
  },

  // ── Basic setters ─────────────────────────────────────────────────────

  testSetCurrentWord() {
    this.setup();

    // TODO: Set a word, assert it was stored
    AppState.setCurrentWord('actor')
    this.assert('actor' === AppState.currentWord, 'setCurrentWord actually stores word')
    // TODO: Set a different word, assert it overwrote the previous one
    AppState.setCurrentWord('doctor')
    this.assert('doctor' === AppState.currentWord, 'setCurrentWord actually overwrites the old stored word')
    // TODO: Set empty string, assert it's stored (not rejected)
    AppState.setCurrentWord('')
    this.assert('' === AppState.currentWord, 'setCurrentWord actually stores empty strings')
  },

  testSetCurrentEntry() {
    this.setup();

    const mockEntry = { entryId: "book", meanings: "book, novel", videoFile: "book.mp4" };

    // TODO: Set the mock entry, assert currentEntry matches
    AppState.setCurrentEntry(mockEntry)
    this.assert(AppState.currentEntry === mockEntry, "setCurrentEntry: stores entry")
    // TODO: Set null, assert currentEntry is null (this happens on error/clear)
    AppState.setCurrentEntry(null)
    this.assert(AppState.currentEntry === null, "setCurrentEntry: stores null")
  },

  testSetMatchCount() {
    this.setup();

    AppState.setMatchCount(5);
    this.assert(AppState.matchCount === 5, 'setMatchCount: stores count');

    AppState.setMatchCount(0);
    this.assert(AppState.matchCount === 0, 'setMatchCount: stores zero');
  },

  testSetHighlightMode() {
    this.setup();

    AppState.setHighlightMode('all');
    this.assert(AppState.highlightMode === 'all', 'setHighlightMode: stores all');

    AppState.setHighlightMode('word');
    this.assert(AppState.highlightMode === 'word', 'setHighlightMode: stores word');

    AppState.setHighlightMode('none');
    this.assert(AppState.highlightMode === 'none', 'setHighlightMode: stores none');
  },

  // ── Side effects — the interesting ones ───────────────────────────────

  /**
   * setLoading(true) should reset hasVideo to false.
   *
   * Why this matters: when the user hovers a new word, the presenter calls
   * setLoading(true) to show the spinner. If hasVideo is still true from
   * the previous word, the popup would incorrectly show the old video
   * instead of the loading state.
   */
  testSetLoadingSideEffect() {
    this.setup();

    // TODO:
    // 1. Set hasVideo to true (simulate a loaded video)
    AppState.hasVideo = true;
    // 2. Call setLoading(true)
    AppState.setLoading(true)
    // 3. Assert hasVideo is now false (the side effect)
    this.assert(AppState.hasVideo === false,"Should reset hasVideo to False")
    // 4. Assert isLoading is true
    this.assert(AppState.isLoading == true, "isLoading should be true")

    // Also test: setLoading(false) should NOT touch hasVideo
    AppState.setHasVideo(true);
    AppState.setLoading(false);
    this.assert(AppState.hasVideo === true, 'setLoading(false): does not reset hasVideo');
    this.assert(AppState.isLoading === false, 'setLoading(false): isLoading is false');
  },

  /**
   * setHasVideo() should set isLoading to false.
   *
   * Why this matters: when a video finishes loading, the presenter calls
   * setHasVideo(true). The spinner should disappear (isLoading = false)
   * without needing a separate setLoading(false) call.
   *
   * Also: setHasVideo(false) on error should STILL clear isLoading,
   * otherwise the spinner would spin forever on a failed fetch.
   */
  testSetHasVideoSideEffect() {
    this.setup();

    // Success case: video loaded
    AppState.setLoading(true);
    AppState.setHasVideo(true);
    this.assert(AppState.isLoading === false, 'setHasVideo(true): clears isLoading');
    this.assert(AppState.hasVideo === true, 'setHasVideo(true): hasVideo is true');

    // Error case: video fetch failed
    AppState.setLoading(true);
    AppState.setHasVideo(false);
    this.assert(AppState.isLoading === false, 'setHasVideo(false): clears isLoading even on error');
    this.assert(AppState.hasVideo === false, 'setHasVideo(false): hasVideo is false');
  },

  // ── Reset ─────────────────────────────────────────────────────────────

  /**
   * reset() should return ALL fields to their initial defaults.
   * This catches regressions if someone adds a new field to AppState
   * but forgets to reset it.
   */
  testReset() {
    this.setup();

    // Dirty every field
    AppState.setCurrentWord('dirty');
    AppState.setCurrentEntry({ entryId: 'dirty' });
    AppState.isLoading = true;
    AppState.hasVideo = true;
    AppState.setMatchCount(99);
    AppState.setHighlightMode('all');

    AppState.reset();

    this.assert(AppState.currentWord === '', 'reset: currentWord is empty');
    this.assert(AppState.currentEntry === null, 'reset: currentEntry is null');
    this.assert(AppState.isLoading === false, 'reset: isLoading is false');
    this.assert(AppState.hasVideo === false, 'reset: hasVideo is false');
    this.assert(AppState.matchCount === 0, 'reset: matchCount is 0');
    this.assert(AppState.highlightMode === 'none', 'reset: highlightMode is none');
  },

  // ── State isolation ───────────────────────────────────────────────────

  /**
   * Verify that setting one field doesn't accidentally affect others.
   * This is a sanity check — if someone refactors a setter and
   * introduces an unintended side effect, this catches it.
   */
  testNoUnintendedSideEffects() {
    this.setup();

    // setCurrentWord should not touch other fields
    AppState.setCurrentWord('hello');
    this.assert(AppState.currentEntry === null, 'setCurrentWord: currentEntry untouched');
    this.assert(AppState.matchCount === 0, 'setCurrentWord: matchCount untouched');
    this.assert(AppState.highlightMode === 'none', 'setCurrentWord: highlightMode untouched');

    this.setup();

    // setMatchCount should not touch other fields
    AppState.setMatchCount(10);
    this.assert(AppState.currentWord === '', 'setMatchCount: currentWord untouched');
    this.assert(AppState.currentEntry === null, 'setMatchCount: currentEntry untouched');
    this.assert(AppState.highlightMode === 'none', 'setMatchCount: highlightMode untouched');

    this.setup();

    // setHighlightMode should not touch other fields
    AppState.setHighlightMode('all');
    this.assert(AppState.currentWord === '', 'setHighlightMode: currentWord untouched');
    this.assert(AppState.matchCount === 0, 'setHighlightMode: matchCount untouched');
    this.assert(AppState.currentEntry === null, 'setHighlightMode: currentEntry untouched');
  },

  // ── Run all ───────────────────────────────────────────────────────────

  runAll() {
    this.results = [];

    this.testSetCurrentWord();
    this.testSetCurrentEntry();
    this.testSetMatchCount();
    this.testSetHighlightMode();
    this.testSetLoadingSideEffect();
    this.testSetHasVideoSideEffect();
    this.testReset();
    this.testNoUnintendedSideEffects();

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    console.log(`\n=== AppState Tests: ${passed}/${total} passed ===\n`);

    this.results.forEach(r => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${r.testName}`);
    });

    return { passed, total, allPassed: passed === total };
  }
};

AppStateTests.runAll();
