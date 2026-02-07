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

    // "running" appears in text → base word "run" is found
    // getAllForms("run") → ["run", "running", "runs", "ran"]
    this.assert(result.includes("run"), "result includes base word 'run'");
    this.assert(result.includes("running"), "result includes inflection 'running'");
    this.assert(result.includes("runs"), "result includes inflection 'runs'");
    this.assert(result.includes("ran"), "result includes inflection 'ran'");
    this.assert(result.includes("ball"), "result includes 'ball'");
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

    // Glossary words and their inflections should be included
    this.assert(result.includes("cat"), "result includes 'cat'");
    this.assert(result.includes("sit"), "result includes 'sit'");
    this.assert(result.includes("sitting"), "result includes 'sitting'");
    this.assert(result.includes("sat"), "result includes 'sat'");
    // Non-glossary words should be excluded
    this.assert(!result.includes("the"), "result does NOT include 'the'");
    this.assert(!result.includes("was"), "result does NOT include 'was'");
    this.assert(!result.includes("on"), "result does NOT include 'on'");
    this.assert(!result.includes("mat"), "result does NOT include 'mat'");
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

    const unique = new Set(result).size;
    this.assert(unique === result.length, "no duplicate words in result");
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

    this.assert(Array.isArray(result), "result is an array");
    this.assert(result.length === 0, "result is empty for empty text");
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

    this.assert(Array.isArray(result), "result is an array");
    this.assert(result.length === 0, "result is empty when no glossary words match");
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

    this.assert(result.length === 3, "result has exactly 3 words");
    this.assert(result.length < fullGlossarySize, "result is smaller than full glossary (" + result.length + " vs " + fullGlossarySize + ")");
  },

  // ─── EDGE CASES (ADDITIONAL) ────────────────────────────────────

  /**
   * Tests that uppercase/mixed-case text still matches.
   *
   * The tokenizer lowercases text before matching, so "Running",
   * "THE", "Ball" should all resolve correctly.
   */
  testCaseSensitivity() {
    this.setup();
    setupWordResolver(
      { run: true, ball: true },
      { running: "run" }
    );

    const container = makeContainer("The Boy Was RUNNING To The BALL");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    this.assert(result.includes("run"), "uppercase 'RUNNING' resolves to 'run'");
    this.assert(result.includes("running"), "uppercase 'RUNNING' expands to 'running'");
    this.assert(result.includes("ball"), "uppercase 'BALL' matches 'ball'");
  },

  /**
   * Tests that words adjacent to punctuation still match.
   *
   * The regex /\b[a-z]+\b/g uses word boundaries, so "ball," and
   * "(run)" should tokenize to "ball" and "run".
   */
  testPunctuationAdjacent() {
    this.setup();
    setupWordResolver(
      { ball: true, run: true, cat: true },
      {}
    );

    const container = makeContainer('the ball, and (run) "cat"');
    const result = HighlightOverlayPresenter.prefilterWords(container);

    this.assert(result.includes("ball"), "'ball,' still matches 'ball'");
    this.assert(result.includes("run"), "'(run)' still matches 'run'");
    this.assert(result.includes("cat"), "'\"cat\"' still matches 'cat'");
  },

  /**
   * Tests with a single word that IS in the glossary.
   */
  testSingleGlossaryWord() {
    this.setup();
    setupWordResolver({ hello: true }, {});

    const container = makeContainer("hello");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    this.assert(result.length === 1, "result has exactly 1 word");
    this.assert(result.includes("hello"), "result includes 'hello'");
  },

  /**
   * Tests with a single word that is NOT in the glossary.
   */
  testSingleNonGlossaryWord() {
    this.setup();
    setupWordResolver({ hello: true }, {});

    const container = makeContainer("goodbye");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    this.assert(result.length === 0, "result is empty for non-glossary word");
  },

  /**
   * Tests that two base words sharing an inflection don't cause issues.
   *
   * Example: if "run" and "bat" both somehow had "runs" as an inflection
   * (contrived), the Set should deduplicate "runs" in the output.
   */
  testOverlappingInflections() {
    this.setup();
    setupWordResolver(
      { run: true, bat: true },
      { runs: "run", bats: "bat", batting: "bat" }
    );

    const container = makeContainer("he runs while batting");
    const result = HighlightOverlayPresenter.prefilterWords(container);

    this.assert(result.includes("run"), "result includes 'run'");
    this.assert(result.includes("runs"), "result includes 'runs'");
    this.assert(result.includes("bat"), "result includes 'bat'");
    this.assert(result.includes("bats"), "result includes 'bats'");
    this.assert(result.includes("batting"), "result includes 'batting'");
    const unique = new Set(result).size;
    this.assert(unique === result.length, "no duplicates with overlapping inflections");
  },

  // ─── DIRECT wordResolver.getMatchingFormsInText TESTS ──────────
  //
  // These test the logic directly on the word resolver (where it lives),
  // bypassing the presenter's thin DOM wrapper.

  testResolverDirectBasic() {
    setupWordResolver(
      { boy: true, throw: true, ball: true },
      { threw: "throw", throwing: "throw" }
    );

    const result = wordResolver.getMatchingFormsInText("the boy threw the ball");

    this.assert(result.includes("boy"), "[resolver] includes 'boy'");
    this.assert(result.includes("throw"), "[resolver] includes base 'throw'");
    this.assert(result.includes("threw"), "[resolver] includes inflection 'threw'");
    this.assert(result.includes("throwing"), "[resolver] includes inflection 'throwing'");
    this.assert(result.includes("ball"), "[resolver] includes 'ball'");
    this.assert(!result.includes("the"), "[resolver] excludes 'the'");
  },

  testResolverDirectEmpty() {
    setupWordResolver({ run: true }, {});

    const result = wordResolver.getMatchingFormsInText("");

    this.assert(Array.isArray(result), "[resolver] returns array for empty string");
    this.assert(result.length === 0, "[resolver] returns empty array for empty string");
  },

  testResolverDirectNoDuplicates() {
    setupWordResolver(
      { run: true },
      { running: "run", runs: "run", ran: "run" }
    );

    // "run" and "running" both resolve to base "run", expansion should not double up
    const result = wordResolver.getMatchingFormsInText("run running runs ran");

    const unique = new Set(result).size;
    this.assert(unique === result.length, "[resolver] no duplicates when multiple forms appear in text");
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
    this.testCaseSensitivity();
    this.testPunctuationAdjacent();
    this.testSingleGlossaryWord();
    this.testSingleNonGlossaryWord();
    this.testOverlappingInflections();
    this.testResolverDirectBasic();
    this.testResolverDirectEmpty();
    this.testResolverDirectNoDuplicates();

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
