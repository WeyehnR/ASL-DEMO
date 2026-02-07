/**
 * Pre-filter Unit Tests
 * Run with: node Test/js/tests/prefilter.test.js
 *
 * Tests the prefilterWords() method on HighlightOverlayPresenter.
 * This method scans page text, finds glossary words via hash lookup,
 * and expands them to include inflected forms — producing a small
 * word list instead of the full ~5,000-word glossary.
 *
 * WHAT WE'RE TESTING:
 *   prefilterWords() lives on the presenter, but it delegates to
 *   wordResolver.getWordsInText() and wordResolver.getAllForms().
 *   We mock those dependencies so we can test the presenter's logic
 *   in isolation — does it correctly wire together tokenization,
 *   lookup, and expansion?
 */

// ─── MOCKS ──────────────────────────────────────────────────────────
//
// prefilterWords() uses:
//   1. container.textContent — to get the page text
//   2. wordResolver.getWordsInText(text) — to find base words
//   3. wordResolver.getAllForms(baseWord) — to expand to inflections
//
// We mock the container (a plain object with textContent) and
// set up wordResolver with a fake glossary + inflection map.

// Browser API mocks (needed because presenter imports the view)
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

globalThis.Highlight = class MockHighlight {
  constructor() {
    this._ranges = [];
  }
  add(r) {
    this._ranges.push(r);
  }
};

globalThis.CSS = { highlights: new Map() };
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.document = {
  createElement(tag) {
    return { textContent: "", tagName: tag };
  },
  head: { appendChild() {} },
  createTreeWalker(container) {
    let i = -1;
    const nodes = container._textNodes || [];
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

// Mock AppState and ResultView (presenter calls these but we don't care here)
const mockAppState = {
  setHighlightMode() {},
  setMatchCount() {},
  reset() {},
};
const mockResultView = {
  clear() {},
  showCount() {},
  showCleared() {},
  updatePosition() {},
};

// We need to mock the modules that the presenter imports.
// Since we're in Node with ES modules, we set up wordResolver directly.
import { wordResolver } from "../model/word-resolver.js";
import { HighlightOverlayPresenter } from "../presenter/highlight-overlay-presenter.js";

// ─── TEST HELPERS ───────────────────────────────────────────────────

/**
 * Sets up wordResolver with a fake glossary and inflection map.
 *
 * @param {Object} glossary - e.g. { "run": true, "ball": true, "throw": true }
 * @param {Object} inflectionMap - e.g. { "running": "run", "threw": "throw" }
 */
function setupWordResolver(glossary, inflectionMap = {}) {
  wordResolver.init(glossary);
  wordResolver.inflectionMap = inflectionMap;

  // Build the reverse map (base → [inflected forms])
  wordResolver.reverseMap = {};
  for (const [inflected, base] of Object.entries(inflectionMap)) {
    if (!wordResolver.reverseMap[base]) {
      wordResolver.reverseMap[base] = [];
    }
    wordResolver.reverseMap[base].push(inflected);
  }
}

/**
 * Creates a fake container with textContent for prefilterWords().
 * Also includes _textNodes for the TreeWalker mock (in case highlightAll runs).
 */
function makeContainer(text) {
  return {
    textContent: text,
    _textNodes: [{ textContent: text, nodeType: 3 }],
  };
}

// ─── TESTS ──────────────────────────────────────────────────────────

const PrefilterTests = {
  results: [],

  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    if (!passed) {
      console.log(`  DETAIL: assertion failed for "${testName}"`);
    }
    return passed;
  },

  /**
   * Setup: initialize the presenter before each test.
   * Call this at the start of each test method.
   */
  setup() {
    HighlightOverlayPresenter.init();
  },

  // ─── BASIC BEHAVIOR ─────────────────────────────────────────────

  /**
   * EXAMPLE TEST — implemented for you as a reference.
   *
   * Given text "the boy throw the ball" and a glossary with {boy, throw, ball},
   * prefilterWords should return only those 3 words (not "the").
   */
  testFiltersToGlossaryWordsOnly() {
    this.setup();
    setupWordResolver(
      { boy: true, throw: true, ball: true },
      {} // no inflections
    );

    const container = makeContainer("the boy throw the ball");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    // Should contain boy, throw, ball — NOT "the"
    this.assert(result.includes("boy"), "result includes 'boy'");
    this.assert(result.includes("throw"), "result includes 'throw'");
    this.assert(result.includes("ball"), "result includes 'ball'");
    this.assert(!result.includes("the"), "result does NOT include 'the'");
  },

  /**
   * Tests that inflected forms are expanded.
   *
   * If "running" appears in the text and maps to base word "run",
   * the result should include BOTH "run" AND "running" so the
   * regex can highlight all forms.
   *
   * HINT: getAllForms("run") returns ["run", "running", "runs"]
   *       if the reverseMap has run → ["running", "runs"]
   */
  testExpandsInflectedForms() {
    this.setup();
    setupWordResolver(
      { run: true, ball: true },
      { running: "run", runs: "run", ran: "run" }
    );

    const container = makeContainer("the boy was running to the ball");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    // TODO: Fill in assertions
    //   "running" appears in text → base word "run" is found
    //   getAllForms("run") → ["run", "running", "runs", "ran"]
    //   So result should contain: "run", "running", "runs", "ran", "ball"
    //
    //   HINT: check result.includes() for each expected word
  },

  /**
   * Tests that words NOT in the glossary are excluded.
   *
   * "the", "was", "to" are common English words but have no ASL sign.
   * They shouldn't appear in the output.
   */
  testExcludesNonGlossaryWords() {
    this.setup();
    setupWordResolver(
      { cat: true, sit: true },
      { sitting: "sit", sat: "sit" }
    );

    const container = makeContainer("the cat was sitting on the mat");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    // TODO: Fill in assertions
    //   "the", "was", "on", "mat" should NOT be in result
    //   "cat", "sit", "sitting", "sat" SHOULD be in result
  },

  /**
   * Tests that the result has no duplicates.
   *
   * If "run" and "running" both appear in the text, and both resolve
   * to base word "run", getAllForms should only be called once for "run".
   * The result shouldn't have "run" listed twice.
   *
   * HINT: convert result to a Set and compare lengths
   */
  testNoDuplicates() {
    this.setup();
    setupWordResolver(
      { run: true },
      { running: "run", runs: "run" }
    );

    const container = makeContainer("run running runs");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    // TODO: Fill in assertion
    //   HINT: new Set(result).size === result.length means no duplicates
  },

  // ─── EDGE CASES ─────────────────────────────────────────────────

  /**
   * Tests with empty text (no content on page).
   *
   * prefilterWords should return an empty array, not crash.
   */
  testEmptyText() {
    this.setup();
    setupWordResolver({ run: true, ball: true });

    const container = makeContainer("");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    // TODO: Fill in assertion
    //   result should be an empty array
  },

  /**
   * Tests with text that has NO glossary matches.
   *
   * "the quick brown fox" — none of these are in the glossary.
   */
  testNoMatches() {
    this.setup();
    setupWordResolver({ elephant: true, giraffe: true });

    const container = makeContainer("the quick brown fox");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    // TODO: Fill in assertion
    //   result should be an empty array
  },

  /**
   * Tests that result size is smaller than full glossary.
   *
   * This is the whole POINT of pre-filtering — proving the word list
   * shrinks dramatically.
   */
  testResultSmallerThanGlossary() {
    this.setup();

    // Simulate a large glossary (100 words) but text only has 3
    const bigGlossary = {};
    for (let i = 0; i < 100; i++) {
      bigGlossary[`word${i}`] = true;
    }
    bigGlossary["cat"] = true;
    bigGlossary["dog"] = true;
    bigGlossary["fish"] = true;
    setupWordResolver(bigGlossary);

    const container = makeContainer("I have a cat and a dog and a fish");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    const fullGlossarySize = Object.keys(bigGlossary).length; // 103

    // TODO: Fill in assertions
    //   result.length should be exactly 3 (cat, dog, fish)
    //   result.length should be much less than fullGlossarySize
  },

  // ─── RUN ALL ──────────────────────────────────────────────────────

  runAll() {
    this.results = [];

    this.testFiltersToGlossaryWordsOnly();
    this.testExpandsInflectedForms();
    this.testExcludesNonGlossaryWords();
    this.testNoDuplicates();
    this.testEmptyText();
    this.testNoMatches();
    this.testResultSmallerThanGlossary();

    // Report results
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log(`\n=== Prefilter Tests: ${passed}/${total} passed ===\n`);

    this.results.forEach((r) => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${r.testName}`);
    });

    return { passed, total, allPassed: passed === total };
  },
};

PrefilterTests.runAll();
