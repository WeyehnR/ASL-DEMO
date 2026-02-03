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

    this.assert(regex.test("say hello there"), "regex matches word in sentence");
    regex.lastIndex = 0; // .test() with /g advances lastIndex — must reset
    this.assert(!regex.test("helloworld"), "regex rejects partial match (no word boundary)");
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
    // TODO: create a view, build regex from ["run", "running"]
    // TODO: exec against "she was running fast"
    // TODO: assert match[0] === "running" (not "run")
  },

  /**
   * Tests that special regex characters in words are escaped.
   *
   * Remember the U.S.A. example: an unescaped dot matches ANY character.
   * The escape step should turn "U.S.A." into "U\.S\.A\." in the regex.
   */
  testRegexEscapesSpecialChars() {
    // TODO: build regex from ["U.S.A."]
    // TODO: assert it matches "U.S.A."
    //       reset lastIndex, then:
    // TODO: assert it does NOT match "UXSXA." (dots should be literal, not wildcards)
  },

  /**
   * Tests case-insensitive matching.
   *
   * The regex uses the "gi" flags — "i" means case insensitive.
   * HINT: use a loop or call exec() multiple times to find all matches.
   */
  testRegexCaseInsensitive() {
    // TODO: build regex from ["hello"]
    // TODO: count all matches in "Hello HELLO hello"
    // TODO: assert 3 matches found
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
    this.assert(matches[0].word === "ASL", 'highlightAll: callback received "ASL"');
    this.assert(matches[0].offset === 7, "highlightAll: callback received correct offset");
    this.assert(
      CSS.highlights.has("asl-words"),
      "highlightAll: highlight registered in CSS.highlights"
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
    // TODO: makeContainer("ASL is great and ASL is fun")
    // TODO: highlightAll with ["ASL"]
    // TODO: assert 2 ranges created
    // TODO: assert callback was called twice
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
    // TODO: makeContainer("first has ASL", "second has ASL too")
    // TODO: highlightAll with ["ASL"]
    // TODO: assert 2 ranges
    // TODO: assert each range's _startNode is a different text node
    //       HINT: view._ranges[0]._startNode !== view._ranges[1]._startNode
  },

  /**
   * Tests that whitespace-only text nodes don't produce matches.
   *
   * Remember all those "\n" nodes you saw when calling walker.nextNode()
   * on Wikipedia? The regex finds no word matches in "\n" or "\t",
   * so no ranges should be created from them.
   */
  testSkipsWhitespaceNodes() {
    // TODO: makeContainer("\n", "hello world", "\t\n")
    // TODO: highlightAll with ["hello"]
    // TODO: assert only 1 range (from the middle text node, not the whitespace ones)
  },

  /**
   * Tests that the onEachMatch callback receives the correct offset.
   *
   * The offset is match.index — the character position within that
   * text node's textContent where the match starts.
   */
  testCallbackReceivesCorrectOffset() {
    // TODO: makeContainer("the cat sat on the mat")
    // TODO: highlightAll with ["cat", "mat"]
    // TODO: collect all { word, offset } from the callback
    // TODO: assert "cat" was found at offset 4
    // TODO: assert "mat" was found at offset 19
  },

  /**
   * Tests that onEachMatch is optional — highlightAll shouldn't crash
   * if no callback is provided.
   */
  testCallbackIsOptional() {
    // TODO: makeContainer("hello world")
    // TODO: call highlightAll(container, ["hello"]) — no third argument
    // TODO: assert it didn't throw (1 range created, no crash)
  },

  // ─── clear TESTS ────────────────────────────────────────────────

  /**
   * Tests that clear() removes the highlight and empties the ranges array.
   */
  testClear() {
    // TODO: create view, run highlightAll to populate ranges
    // TODO: call view.clear()
    // TODO: assert CSS.highlights.has("asl-words") === false
    // TODO: assert view._ranges.length === 0
  },

  /**
   * Tests that calling highlightAll a second time clears previous highlights.
   *
   * highlightAll() starts with this.clear() — so old ranges from the
   * first call shouldn't linger.
   */
  testHighlightAllClearsPrevious() {
    // TODO: highlightAll once with ["hello"] on "hello world"
    // TODO: highlightAll again with ["world"] on "hello world"
    // TODO: assert only 1 range exists (for "world", not "hello")
    // HINT: if clear() didn't work, you'd have 2 ranges
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
    // TODO: makeContainer("hello world")
    // TODO: highlightAll with ["xyz"]
    // TODO: assert 0 ranges
    // TODO: assert highlight is still registered (just empty)
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
    // TODO: makeContainer("hello world")
    // TODO: try calling highlightAll with []
    // TODO: observe what happens — does it create unexpected ranges?
    // TODO: if it does, that's a bug to fix in highlightAll!
  },

  /**
   * Tests matching a word that appears at the very start and very end
   * of a text node. Word boundaries (\b) should work at string edges.
   */
  testWordAtStartAndEnd() {
    // TODO: makeContainer("ASL is great and I love ASL")
    // TODO: highlightAll with ["ASL"]
    // TODO: assert 2 ranges found
    // TODO: assert first range starts at offset 0
    // TODO: assert second range ends at offset 27 (the string length)
  },

  /**
   * Tests case-insensitive matching in highlightAll, not just the regex.
   *
   * "hello" should match "Hello", "HELLO", "hello" — three matches
   * in a single text node.
   */
  testCaseInsensitiveHighlight() {
    // TODO: makeContainer("Hello HELLO hello")
    // TODO: highlightAll with ["hello"]
    // TODO: assert 3 ranges
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
      `\n=== HighlightOverlayView Tests: ${passed}/${total} passed ===\n`
    );

    this.results.forEach((r) => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${r.testName}`);
    });

    return { passed, total, allPassed: passed === total };
  },
};

HighlightOverlayViewTests.runAll();
