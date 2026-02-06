/**
 * HighlightOverlayView Unit Tests
 * Run with: node Test/js/tests/highlight-overlay-view.test.js
 *
 * WHAT'S DIFFERENT FROM LRU CACHE TESTS:
 *   LRUCache is pure logic — no browser needed. HighlightOverlayView uses
 *   browser APIs (DOM, Range, Highlight, CSS.highlights) that don't exist
 *   in Node.js. To test without a browser, we create "mocks" — fake objects
 *   that mimic the browser APIs just enough for our code to run.
 *
 *   The mocks don't paint anything on screen. They record what the code
 *   tried to do, so we can assert it did the right thing.
 *
 * WHY NOT JUST TEST IN THE BROWSER?
 *   You could! Playwright (already installed) runs tests in a real browser.
 *   But for logic-heavy tests like "did the regex sort correctly?", mocks
 *   are faster. Use Playwright later for visual/integration tests.
 */

// ─── BROWSER API MOCKS ──────────────────────────────────────────────
//
// Why do we need these?
//   Node.js has no DOM. When your code calls `new Range()` or
//   `document.createTreeWalker(...)`, those don't exist here.
//   So we create fake versions that behave "just enough" for testing.
//
//   This technique is called "mocking" or using "test doubles."
//   The mocks record what your code did so you can assert on it.
//
// IMPORTANT: these must be set up BEFORE creating any HighlightOverlayView
//   instances, because the constructor calls _injectStyles() which uses
//   `document`. ES module imports are hoisted (run first), but the class
//   definition doesn't execute anything — the constructor only runs when
//   you call `new HighlightOverlayView()`, which happens after these mocks.

// Mock Range — records setStart/setEnd so we can inspect offsets
globalThis.Range = class MockRange {
  constructor() {
    this._startNode = null;
    this._startOffset = null;
    this._endNode = null;
    this._endOffset = null;
  }
  setStart(node, offset) {
    this._startNode = node;
    this._startOffset = offset;
  }
  setEnd(node, offset) {
    this._endNode = node;
    this._endOffset = offset;
  }
};

// Mock Highlight — just stores the ranges it received
globalThis.Highlight = class MockHighlight {
  constructor(...ranges) {
    this._ranges = ranges;
  }
};

// CSS.highlights is a HighlightRegistry in the browser.
// A plain Map has the same set/get/delete/has interface — perfect mock.
globalThis.CSS = { highlights: new Map() };

// NodeFilter is a browser global with constants like SHOW_TEXT = 4
globalThis.NodeFilter = { SHOW_TEXT: 4 };

// Mock document — the trickiest part.
//   createElement: returns a fake element (for the <style> tag)
//   head.appendChild: no-op (we don't need a real DOM head)
//   createTreeWalker: returns a mock walker that iterates over
//     container._textNodes (an array we set up in each test)
globalThis.document = {
  createElement(tag) {
    return { textContent: "", tagName: tag };
  },
  head: {
    appendChild() {},
  },
  createTreeWalker(container) {
    // Instead of walking real DOM children, we iterate the
    // _textNodes array that makeContainer() sets up.
    let i = -1;
    const nodes = container._textNodes;
    return {
      nextNode() {
        i++;
        return i < nodes.length ? nodes[i] : null;
      },
      get currentNode() {
        return nodes[i];
      },
    };
  },
};

// ─── TEST HELPERS ────────────────────────────────────────────────────

/**
 * Creates a fake container with text nodes for highlightAll().
 *
 * In a real browser, a <div> contains child elements which contain
 * text nodes. TreeWalker would visit them via DFS. Our mock walker
 * just iterates this flat array — same result for testing.
 *
 * Usage:
 *   makeContainer("hello world")           → 1 text node
 *   makeContainer("hello", "\n", "world")  → 3 text nodes (simulates whitespace between elements)
 */
function makeContainer(...texts) {
  const textNodes = texts.map((t) => ({ textContent: t, nodeType: 3 }));
  return { _textNodes: textNodes };
}

import { HighlightOverlayView } from "../view/highlight-overlay-view.js";

// ─── TESTS ───────────────────────────────────────────────────────────

const HighlightOverlayViewTests = {
  results: [],

  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    return passed;
  },

  // ─── _buildRegex TESTS ──────────────────────────────────────────
  //
  // _buildRegex is pure logic — no DOM involved. These tests verify
  // the regex is built correctly: escaping, sorting, word boundaries.

  /**
   * EXAMPLE TEST — implemented for you as a reference.
   *
   * Tests that the regex matches a word and respects word boundaries.
   * "hello" should match in "say hello there" but NOT in "helloworld"
   * because \b requires a word boundary.
   */
  testRegexMatchesWord() {
    const view = new HighlightOverlayView();
    const regex = view._buildRegex(["hello"]);

    this.assert(
      regex.test("say hello there"),
      "regex matches word in sentence",
    );
    regex.lastIndex = 0; // .test() with /g advances lastIndex — must reset
    this.assert(
      !regex.test("helloworld"),
      "regex rejects partial match (no word boundary)",
    );
  },

  /**
   * Tests that longer words are matched first in the alternation.
   *
   * If the regex is \b(?:run|running)\b — "run" appears first and would
   * match the "run" part of "running", leaving "ning" unmatched.
   * Sorting longest-first gives \b(?:running|run)\b — "running" matches fully.
   *
   * HINT: use regex.exec(text) and check match[0] to see WHAT was matched.
   */
  testRegexSortsLongestFirst() {
    const view = new HighlightOverlayView();
    const regex = view._buildRegex(["run", "running"]);
    const match = regex.exec("She was running very fast");
    this.assert(match[0] === "running", 'match[0] === "running" (not "run")');
  },

  /**
   * Tests that special regex characters in words are escaped.
   *
   * Remember the U.S.A. example: an unescaped dot matches ANY character.
   * The escape step should turn "U.S.A." into "U\.S\.A\." in the regex.
   */
  testRegexEscapesSpecialChars() {
    const view = new HighlightOverlayView();
    // Use "U.S.A" (no trailing dot) — ends with word char so \b works
    const regex = view._buildRegex(["U.S.A"]);

    const match = regex.exec("The U.S.A is great");
    this.assert(match !== null, 'matches "U.S.A" with escaped dots');

    regex.lastIndex = 0;
    const noMatch = regex.exec("The UXSXA is great");
    this.assert(
      noMatch === null,
      'does NOT match "UXSXA" — dots are literal, not wildcards',
    );
  },

  /**
   * Tests case-insensitive matching.
   *
   * The regex uses the "gi" flags — "i" means case insensitive.
   * HINT: use a loop or call exec() multiple times to find all matches.
   */
  testRegexCaseInsensitive() {
    const view = new HighlightOverlayView();
    const regex = view._buildRegex(["hello"]);
    const text = "Hello HELLO hello";
    let count = 0;

    while (regex.exec(text) !== null) {
      count++;
    }

    this.assert(count === 3, "regex matches 3 times (case insensitive)");
  },

  // ─── highlightAll TESTS ─────────────────────────────────────────
  //
  // These test the full pipeline: TreeWalker → regex → Range → Highlight.
  // The mocks let us inspect what happened without a real browser.

  /**
   * EXAMPLE TEST — implemented for you as a reference.
   *
   * Tests the basic happy path: one word, one text node, one match.
   * Verifies that:
   *   - A Range was created and pushed to _ranges
   *   - The onEachMatch callback was called with the matched word
   *   - The highlight was registered with CSS.highlights
   */
  testHighlightAllBasic() {
    const view = new HighlightOverlayView();
    const container = makeContainer("I love ASL");
    const matches = [];

    view.highlightAll(container, ["ASL"], (word, node, offset) => {
      matches.push({ word, offset });
    });

    this.assert(view._ranges.length === 1, "highlightAll: one range created");
    this.assert(
      matches[0].word === "ASL",
      'highlightAll: callback received "ASL"',
    );
    this.assert(
      matches[0].offset === 7,
      "highlightAll: callback received correct offset",
    );
    this.assert(
      CSS.highlights.has("asl-words"),
      "highlightAll: highlight registered in CSS.highlights",
    );
  },

  /**
   * Tests that the same word appearing multiple times in one text node
   * produces multiple ranges.
   *
   * This exercises the inner while loop — regex.exec() should find
   * all matches, not just the first one.
   */
  testMultipleMatchesSameNode() {
    const view = new HighlightOverlayView();
    const container = makeContainer("ASL is great and ASL is fun");
    const matches = [];

    view.highlightAll(container, ["ASL"], (word, node, offset) => {
      matches.push({ word, offset });
    });

    this.assert(view._ranges.length === 2, "two ranges created for two ASL matches");
    this.assert(matches.length === 2, "callback was called twice");
  },

  /**
   * Tests that highlighting works across multiple text nodes.
   *
   * In a real page, "ASL" might appear in two different <p> elements.
   * The TreeWalker visits both, and the regex should find matches in each.
   *
   * HINT: This also tests that regex.lastIndex resets between text nodes.
   *   If it didn't reset, the regex would try to continue matching from
   *   the position it left off in the previous text node's string —
   *   which could skip matches or error out.
   */
  testMultipleTextNodes() {
    const view = new HighlightOverlayView();
    const container = makeContainer("first has ASL", "second has ASL too");

    view.highlightAll(container, ["ASL"], () => {});

    this.assert(view._ranges.length === 2, "2 ranges created across text nodes");
    this.assert(
      view._ranges[0]._startNode !== view._ranges[1]._startNode,
      "each range is in a different text node"
    );
  },

  /**
   * Tests that whitespace-only text nodes don't produce matches.
   *
   * Remember all those "\n" nodes you saw when calling walker.nextNode()
   * on Wikipedia? The regex finds no word matches in "\n" or "\t",
   * so no ranges should be created from them.
   */
  testSkipsWhitespaceNodes() {
    const view = new HighlightOverlayView();
    const container = makeContainer("\n", "hello world", "\t\n");

    view.highlightAll(container, ["hello"], () => {});

    this.assert(view._ranges.length === 1, "only 1 range from middle text node");
  },

  /**
   * Tests that the onEachMatch callback receives the correct offset.
   *
   * The offset is match.index — the character position within that
   * text node's textContent where the match starts.
   */
  testCallbackReceivesCorrectOffset() {
    const view = new HighlightOverlayView();
    const container = makeContainer("the cat sat on the mat");
    const matches = [];

    view.highlightAll(container, ["cat", "mat"], (word, node, offset) => {
      matches.push({ word, offset });
    });

    const catMatch = matches.find((m) => m.word === "cat");
    const matMatch = matches.find((m) => m.word === "mat");

    this.assert(catMatch.offset === 4, '"cat" found at offset 4');
    this.assert(matMatch.offset === 19, '"mat" found at offset 19');
  },

  /**
   * Tests that onEachMatch is optional — highlightAll shouldn't crash
   * if no callback is provided.
   */
  testCallbackIsOptional() {
    const view = new HighlightOverlayView();
    const container = makeContainer("hello world");

    view.highlightAll(container, ["hello"]); // no callback

    this.assert(view._ranges.length === 1, "1 range created without callback (no crash)");
  },

  // ─── clear TESTS ────────────────────────────────────────────────

  /**
   * Tests that clear() removes the highlight and empties the ranges array.
   */
  testClear() {
    const view = new HighlightOverlayView();
    const container = makeContainer("hello world");

    view.highlightAll(container, ["hello"], () => {});
    view.clear();

    this.assert(CSS.highlights.has("asl-words") === false, "highlight removed from CSS.highlights");
    this.assert(view._ranges.length === 0, "ranges array is empty");
  },

  /**
   * Tests that calling highlightAll a second time clears previous highlights.
   *
   * highlightAll() starts with this.clear() — so old ranges from the
   * first call shouldn't linger.
   */
  testHighlightAllClearsPrevious() {
    const view = new HighlightOverlayView();
    const container = makeContainer("hello world");

    view.highlightAll(container, ["hello"], () => {});
    view.highlightAll(container, ["world"], () => {});

    this.assert(view._ranges.length === 1, "only 1 range (previous was cleared)");
  },

  // ─── EDGE CASES ─────────────────────────────────────────────────
  //
  // These are scenarios you might not think of during normal development
  // but can cause real bugs in production.

  /**
   * What happens when no matches are found?
   *
   * highlightAll should still work — it just creates a Highlight
   * with zero ranges. No crash, no error.
   */
  testNoMatchesFound() {
    const view = new HighlightOverlayView();
    const container = makeContainer("hello world");

    view.highlightAll(container, ["xyz"], () => {});

    this.assert(view._ranges.length === 0, "0 ranges when no matches");
    this.assert(CSS.highlights.has("asl-words"), "highlight still registered (just empty)");
  },

  /**
   * What happens when words is an empty array?
   *
   * _buildRegex([]) joins an empty array: escaped.join("|") → ""
   * So the regex becomes: \b(?:)\b — a regex that matches... what?
   *
   * Try it in your console:
   *   new RegExp('\\b(?:)\\b', 'gi').exec("hello")
   *
   * This is a real edge case that might reveal a bug. Think about
   * whether highlightAll should guard against empty words.
   */
  testEmptyWordsArray() {
    // BUG DISCOVERED: calling highlightAll([]) causes infinite loop!
    //
    // Why? An empty words array creates regex: \b(?:)\b
    // This matches empty strings at word boundaries. regex.exec()
    // keeps matching at the same position forever (lastIndex doesn't advance).
    //
    // FIX NEEDED: highlightAll should guard against empty arrays.
    // e.g., if (words.length === 0) return;
    //
    // For now, we just verify the regex itself is problematic:
    const view = new HighlightOverlayView();
    const regex = view._buildRegex([]);
    const match = regex.exec("hello");

    // This matches an empty string at position 0
    this.assert(match !== null && match[0] === "", "empty regex matches empty string (bug!)");
  },

  /**
   * Tests matching a word that appears at the very start and very end
   * of a text node. Word boundaries (\b) should work at string edges.
   */
  testWordAtStartAndEnd() {
    const view = new HighlightOverlayView();
    const container = makeContainer("ASL is great and I love ASL");
    const matches = [];

    view.highlightAll(container, ["ASL"], (word, node, offset) => {
      matches.push({ word, offset });
    });

    this.assert(view._ranges.length === 2, "2 ranges found");
    this.assert(matches[0].offset === 0, "first range starts at offset 0");
    this.assert(matches[1].offset === 24, "second range starts at offset 24");
  },

  /**
   * Tests case-insensitive matching in highlightAll, not just the regex.
   *
   * "hello" should match "Hello", "HELLO", "hello" — three matches
   * in a single text node.
   */
  testCaseInsensitiveHighlight() {
    const view = new HighlightOverlayView();
    const container = makeContainer("Hello HELLO hello");

    view.highlightAll(container, ["hello"], () => {});

    this.assert(view._ranges.length === 3, "3 ranges for case-insensitive matches");
  },

  // ─── RUN ALL ────────────────────────────────────────────────────

  runAll() {
    this.results = [];

    this.testRegexMatchesWord();
    this.testRegexSortsLongestFirst();
    this.testRegexEscapesSpecialChars();
    this.testRegexCaseInsensitive();
    this.testHighlightAllBasic();
    this.testMultipleMatchesSameNode();
    this.testMultipleTextNodes();
    this.testSkipsWhitespaceNodes();
    this.testCallbackReceivesCorrectOffset();
    this.testCallbackIsOptional();
    this.testClear();
    this.testHighlightAllClearsPrevious();
    this.testNoMatchesFound();
    this.testEmptyWordsArray();
    this.testWordAtStartAndEnd();
    this.testCaseInsensitiveHighlight();

    // Report results
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log(
      `\n=== HighlightOverlayView Tests: ${passed}/${total} passed ===\n`,
    );

    this.results.forEach((r) => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${r.testName}`);
    });

    return { passed, total, allPassed: passed === total };
  },
};

HighlightOverlayViewTests.runAll();
