/**
 * VideoData Unit Tests
 * Run with: node Test/js/tests/video-data.test.js
 *
 * Tests the VideoData model which is the core data layer responsible for:
 * - Loading and storing the ASL-LEX glossary (word → entry[] mapping)
 * - Loading the inflection map (inflected form → base word, e.g. "running" → "run")
 * - Looking up entries by exact word or inflected form
 * - Building video paths from entry metadata
 * - Scanning text for matchable words (used by the highlighter)
 *
 * The mock data below simulates the two JSON files the build script produces:
 *   1. mockGlossary  — the ASL-LEX glossary keyed by base word
 *   2. mockInflectionMap — inflected forms mapped to their base words
 *
 * These let us test all lookup logic without hitting the network or filesystem.
 */

import { VideoData } from '../model/video-data.js';
import { wordResolver } from '../model/word-resolver.js';
import { CONFIG } from '../config.js';

const VideoDataTests = {
  /**
   * Mock ASL-LEX glossary data.
   * Structure: { baseWord: [ entry, entry, ... ] }
   *
   * Each entry contains:
   *   - entryId:      unique identifier for the sign
   *   - meanings:      comma-separated string of English translations
   *   - lexicalClass:  part of speech (Noun, Verb, etc.)
   *   - videoFile:     filename of the ASL video clip
   *
   * "book" intentionally has TWO entries (Noun + Verb) to test disambiguation —
   * the same English word can map to different ASL signs depending on meaning.
   */
  mockGlossary: {
    "book": [
      { entryId: "book", meanings: "book, novel, read", lexicalClass: "Noun", videoFile: "book.mp4" },
      { entryId: "book_2", meanings: "book, reserve, reservation", lexicalClass: "Verb", videoFile: "book_2.mp4" }
    ],
    "hello": [
      { entryId: "hello", meanings: "hello, hi, greetings", lexicalClass: "Interjection", videoFile: "hello.mp4" }
    ],
    "conflict": [
      { entryId: "conflict", meanings: "conflict, dispute, argument", lexicalClass: "Noun", videoFile: "conflict.mp4" }
    ],
    "run": [
      { entryId: "run", meanings: "run, jog, sprint", lexicalClass: "Verb", videoFile: "run.mp4" }
    ],
    "bra": [
      { entryId: "bra", meanings: "bra, brassiere", lexicalClass: "Noun", videoFile: "bra.mp4" }
    ],
    "on": [
      { entryId: "on", meanings: "on, upon", lexicalClass: "Preposition", videoFile: "on.mp4" }
    ],
    "die": [
      { entryId: "die", meanings: "die, dead, death", lexicalClass: "Verb", videoFile: "die.mp4" }
    ],
    "sign": [
      { entryId: "sign", meanings: "sign, signal", lexicalClass: "Noun", videoFile: "sign.mp4" }
    ]
  },

  /**
   * Mock inflection map — simulates the output of the build script.
   * Structure: { inflectedForm: baseWord }
   *
   * The build script pre-computes all known inflections so the runtime
   * doesn't need a stemmer. This handles:
   *   - Regular plurals:     "books" → "book"
   *   - Past tense:          "booked" → "book", "died" → "die"
   *   - Present participle:  "running" → "run", "dying" → "die"
   *   - Irregular forms:     "ran" → "run"
   *
   * Notably ABSENT: agent nouns like "signer", "runner" — these are
   * intentionally excluded because they're different words, not inflections.
   */
  mockInflectionMap: {
    "books": "book",
    "booked": "book",
    "booking": "book",
    "conflicts": "conflict",
    "conflicted": "conflict",
    "conflicting": "conflict",
    "runs": "run",
    "running": "run",
    "ran": "run",
    "signs": "sign",
    "signed": "sign",
    "signing": "sign",
    "dies": "die",
    "died": "die",
    "dying": "die",
    "bras": "bra",
  },

  results: [],

  /**
   * Test assertion helper.
   * Evaluates a condition and records the result with a descriptive name.
   * All results are collected in this.results and printed by runAll().
   *
   * @param {*} condition - Truthy = pass, falsy = fail
   * @param {string} testName - Descriptive label shown in the test report
   * @returns {boolean} Whether the assertion passed
   */
  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    return passed;
  },

  /**
   * Reset VideoData to a clean, empty state.
   * Called before tests that need to verify behavior from a blank slate
   * (e.g. testing what happens when no data is loaded).
   */
  setup() {
    VideoData.wordToVideos = {};
    VideoData.isLoaded = false;
    wordResolver.inflectionMap = {};
    wordResolver.reverseMap = {};
    wordResolver._glossary = null;
  },

  /**
   * Reset VideoData and populate it with the mock glossary and inflection map.
   * Also builds the reverse map (base → [inflected forms]) which is used
   * by getAllForms() and getWordsInText() to find all forms of a word.
   *
   * Most tests use this since they need data to query against.
   */
  setupWithData() {
    VideoData.wordToVideos = this.mockGlossary;
    wordResolver.inflectionMap = this.mockInflectionMap;
    // Build reverse map
    wordResolver.reverseMap = {};
    for (const [inflected, base] of Object.entries(this.mockInflectionMap)) {
      if (!wordResolver.reverseMap[base]) wordResolver.reverseMap[base] = [];
      wordResolver.reverseMap[base].push(inflected);
    }
    // Give wordResolver a reference to the glossary (same as VideoData.init() does)
    wordResolver.init(this.mockGlossary);
  },

  /**
   * Verifies the raw glossary data structure after loading.
   *
   * Checks that:
   * - Known base words exist as keys in wordToVideos
   * - Each key maps to an array of entries (not a single entry)
   * - "book" has exactly 2 entries (Noun + Verb disambiguation)
   * - Entry objects contain the required fields: meanings, lexicalClass
   *
   * This is the most fundamental test — if the data shape is wrong,
   * every other lookup method will break.
   */
  testEntryLookup() {
    this.setupWithData();

    this.assert("book" in VideoData.wordToVideos, "lookup: 'book' key exists");
    this.assert("hello" in VideoData.wordToVideos, "lookup: 'hello' key exists");

    const bookEntries = VideoData.wordToVideos["book"];
    this.assert(Array.isArray(bookEntries), "lookup: 'book' value is array");
    this.assert(bookEntries.length === 2, "lookup: 'book' has 2 entries");
    this.assert(bookEntries[0].meanings === "book, novel, read", "lookup: 'book' entry has meanings");
    this.assert(bookEntries[0].lexicalClass === "Noun", "lookup: 'book' entry has lexicalClass");
  },

  /**
   * Tests hasWord() — the boolean "does this word exist?" check.
   *
   * hasWord() must handle:
   * - Exact base words ("book", "hello") → true
   * - Inflected forms ("books", "running") → true (via inflection map)
   * - Non-existent words ("notaword") → false
   * - Empty string ("") → false
   *
   * This is the first gate in the hover chain: the highlighter calls
   * hasWord() to decide whether a word on the page should get a <mark> tag.
   * False positives here mean random words get highlighted.
   * False negatives mean real ASL words get missed.
   */
  testHasWord() {
    this.setupWithData();

    this.assert(wordResolver.hasWord("book") === true, "hasWord: exact 'book'");
    this.assert(wordResolver.hasWord("hello") === true, "hasWord: exact 'hello'");
    this.assert(wordResolver.hasWord("books") === true, "hasWord: inflection 'books'");
    this.assert(wordResolver.hasWord("running") === true, "hasWord: inflection 'running'");
    this.assert(wordResolver.hasWord("notaword") === false, "hasWord: false for non-existent");
    this.assert(wordResolver.hasWord("") === false, "hasWord: false for empty string");
  },

  /**
   * Tests getEntryForWord() — returns a full entry object for a given word.
   *
   * The returned entry must contain:
   *   - entryId:   used to identify the sign uniquely
   *   - meanings:  displayed in the popup below the video
   *   - videoFile: used to construct the video URL
   *
   * Returns null for unknown words (the popup uses this to show an error state).
   *
   * This is called by the presenter when the user hovers a highlighted word
   * and we need to populate the popup with video + definition data.
   */
  testGetEntryForWord() {
    this.setupWithData();

    const entry = VideoData.getEntryForWord("book");
    this.assert(entry !== null, "getEntry: returns entry for 'book'");
    this.assert(entry.entryId !== undefined, "getEntry: entry has entryId");
    this.assert(entry.meanings !== undefined, "getEntry: entry has meanings");
    this.assert(entry.videoFile !== undefined, "getEntry: entry has videoFile");

    const noEntry = VideoData.getEntryForWord("notaword");
    this.assert(noEntry === null, "getEntry: null for non-existent");
  },

  /**
   * Tests getVideoPath() — builds the full URL to an ASL video clip.
   *
   * The path is constructed by combining CONFIG.video.basePath with the
   * entry's videoFile field: e.g. "videos/book.mp4"
   *
   * Verifies:
   * - Path starts with the configured base path (not hardcoded)
   * - Path ends with .mp4
   * - Returns null for unknown words (prevents broken video elements)
   *
   * This URL is what gets set as the <video> element's src attribute
   * in the popup when the user hovers a word.
   */
  testGetVideoPath() {
    this.setupWithData();

    const path = VideoData.getVideoPath("book");
    this.assert(path !== null, "getVideoPath: returns path for 'book'");
    this.assert(path.startsWith(CONFIG.video.basePath), "getVideoPath: starts with basePath");
    this.assert(path.endsWith(".mp4"), "getVideoPath: ends with .mp4");

    const noPath = VideoData.getVideoPath("notaword");
    this.assert(noPath === null, "getVideoPath: null for non-existent");
  },

  /**
   * Tests findBaseWord() — resolves any word form to its base/dictionary form.
   *
   * This is the core of the inflection system. Given any form of a word,
   * it returns the base word that exists as a key in the glossary.
   *
   * Resolution order:
   *   1. Exact match — "conflict" is already a base word → "conflict"
   *   2. Inflection map — "conflicting" → "conflict" (pre-computed by build script)
   *   3. Not found — "xyz" → null
   *
   * Test categories:
   *   - Exact matches:       base words that are glossary keys
   *   - Regular inflections:  -s, -ed, -ing suffixes
   *   - Doubled consonants:  "running" → "run" (handled by inflection map, not live stemming)
   *   - Irregular forms:     "ran" → "run" (also pre-computed)
   *   - Cross-class forms:   "signed" → "sign" (sign is a Noun in ASL-LEX but has verb forms)
   *   - ie→ying:             "dying" → "die" (special spelling rule)
   *   - Agent nouns:         "signer" → null (NOT an inflection — different word)
   *   - Case insensitivity:  "CONFLICT" → "conflict"
   *
   * The agent noun exclusion is critical: without it, "signer" would falsely
   * match "sign", and "runner" would falsely match "run".
   */
  testFindBaseWord() {
    this.setupWithData();

    // Exact matches
    this.assert(wordResolver.findBaseWord("conflict") === "conflict", "stem: exact 'conflict'");
    this.assert(wordResolver.findBaseWord("book") === "book", "stem: exact 'book'");

    // Inflection map lookups
    this.assert(wordResolver.findBaseWord("conflicting") === "conflict", "stem: 'conflicting' -> 'conflict'");
    this.assert(wordResolver.findBaseWord("conflicts") === "conflict", "stem: 'conflicts' -> 'conflict'");
    this.assert(wordResolver.findBaseWord("conflicted") === "conflict", "stem: 'conflicted' -> 'conflict'");
    this.assert(wordResolver.findBaseWord("books") === "book", "stem: 'books' -> 'book'");
    this.assert(wordResolver.findBaseWord("booked") === "book", "stem: 'booked' -> 'book'");
    this.assert(wordResolver.findBaseWord("booking") === "book", "stem: 'booking' -> 'book'");

    // Doubled consonant via inflection map
    this.assert(wordResolver.findBaseWord("running") === "run", "stem: 'running' -> 'run' (pre-computed)");

    // Irregular form
    this.assert(wordResolver.findBaseWord("ran") === "run", "stem: 'ran' -> 'run' (irregular)");

    // Verb forms from noun-classified words (sign is Noun in ASL-LEX)
    this.assert(wordResolver.findBaseWord("signed") === "sign", "stem: 'signed' -> 'sign'");
    this.assert(wordResolver.findBaseWord("signing") === "sign", "stem: 'signing' -> 'sign'");

    // ie → ying special case
    this.assert(wordResolver.findBaseWord("dying") === "die", "stem: 'dying' -> 'die' (ie→ying)");
    this.assert(wordResolver.findBaseWord("died") === "die", "stem: 'died' -> 'die'");

    // Non-existent words
    this.assert(wordResolver.findBaseWord("xyz") === null, "stem: null for non-existent");

    // Agent nouns should NOT match (not in inflection map)
    this.assert(wordResolver.findBaseWord("signer") === null, "stem: 'signer' does NOT map (agent noun)");
    this.assert(wordResolver.findBaseWord("signers") === null, "stem: 'signers' does NOT map (agent noun)");
    this.assert(wordResolver.findBaseWord("runner") === null, "stem: 'runner' does NOT map (agent noun)");

    // Case insensitivity
    this.assert(wordResolver.findBaseWord("CONFLICT") === "conflict", "stem: case insensitive 'CONFLICT'");
    this.assert(wordResolver.findBaseWord("Conflicting") === "conflict", "stem: case insensitive 'Conflicting'");
  },

  /**
   * Tests getAllForms() — returns every known form of a word (base + inflections).
   *
   * Given any form (base or inflected), returns an array containing the base
   * word plus all its known inflections from the reverse map.
   * Example: getAllForms("book") → ["book", "books", "booked", "booking"]
   *
   * This is used by the highlighter in "word" mode: when a user hovers "books",
   * we highlight every occurrence of "book", "books", "booked", and "booking"
   * on the page so the user can see all instances of the same sign.
   *
   * Also verifies:
   * - Works when called with an inflected form ("running" finds all "run" forms)
   * - Excludes agent nouns ("booker" is NOT a form of "book")
   * - Returns empty array for unknown words
   */
  testGetAllForms() {
    this.setupWithData();

    const bookForms = wordResolver.getAllForms("book");
    this.assert(bookForms.includes("book"), "getAllForms: includes base 'book'");
    this.assert(bookForms.includes("books"), "getAllForms: includes 'books'");
    this.assert(bookForms.includes("booked"), "getAllForms: includes 'booked'");
    this.assert(bookForms.includes("booking"), "getAllForms: includes 'booking'");
    this.assert(!bookForms.includes("booker"), "getAllForms: does NOT include 'booker'");

    // Works when called with an inflected form too
    const runForms = wordResolver.getAllForms("running");
    this.assert(runForms.includes("run"), "getAllForms: 'running' returns base 'run'");
    this.assert(runForms.includes("running"), "getAllForms: 'running' includes 'running'");

    const noForms = wordResolver.getAllForms("notaword");
    this.assert(noForms.length === 0, "getAllForms: empty for non-existent word");
  },

  /**
   * Tests getWordsInText() — scans a text string and returns all matchable base words.
   *
   * This is the function the highlighter calls to decide WHICH words on a page
   * should be highlighted. It must use word-boundary matching to avoid false
   * positives from substrings.
   *
   * Critical false-positive cases tested:
   *   - "Brazil" must NOT match "bra" (substring at start of word)
   *   - "only" must NOT match "on" (substring at start of word)
   *   - "audience" must NOT match "die" (substring in middle of word)
   *   - "signer" must NOT match "sign" (agent noun, not an inflection)
   *
   * True positive cases:
   *   - "on" in "turned on the light" (standalone word) → match
   *   - "conflicting" → resolves to "conflict" via inflection map → match
   *   - "signed" and "running" in same sentence → both resolve to base words
   *
   * Without word-boundary checks, short ASL words like "on", "bra", "die"
   * would light up inside hundreds of unrelated English words, making the
   * extension unusable on real pages.
   */
  testGetWordsInText() {
    this.setupWithData();

    // Should find "conflict" via inflection map when "conflicting" is in text
    const words1 = wordResolver.getWordsInText("The conflicting reports were discussed");
    this.assert(words1.includes("conflict"), "getWordsInText: finds 'conflict' via 'conflicting'");

    // Should NOT find "bra" in text containing only "Brazil"
    const words2 = wordResolver.getWordsInText("Brazil is a beautiful country");
    this.assert(!words2.includes("bra"), "getWordsInText: no 'bra' in 'Brazil'");

    // Should NOT find "on" in text containing only "only"
    const words3 = wordResolver.getWordsInText("She only went home");
    this.assert(!words3.includes("on"), "getWordsInText: no 'on' in 'only'");

    // Should find "on" when it's actually in the text
    const words4 = wordResolver.getWordsInText("She turned on the light");
    this.assert(words4.includes("on"), "getWordsInText: finds 'on' in exact match");

    // Should NOT find "die" in "audience"
    const words5 = wordResolver.getWordsInText("The audience applauded loudly");
    this.assert(!words5.includes("die"), "getWordsInText: no 'die' in 'audience'");

    // Should find via inflected forms
    const words6 = wordResolver.getWordsInText("She signed the document and kept running");
    this.assert(words6.includes("sign"), "getWordsInText: finds 'sign' via 'signed'");
    this.assert(words6.includes("run"), "getWordsInText: finds 'run' via 'running'");

    // Agent nouns should NOT match base words
    const words7 = wordResolver.getWordsInText("The signer demonstrated ASL");
    this.assert(!words7.includes("sign"), "getWordsInText: no 'sign' from 'signer'");
  },

  /**
   * Runs every test method in sequence and prints a summary report.
   *
   * NOTE: runAll() currently calls this.testGetRandomEntryForWord() on line 244,
   * but that method does not exist in this file — it will throw at runtime.
   * Either remove that line or add the test method.
   */
  runAll() {
    this.results = [];

    this.testEntryLookup();
    this.testHasWord();
    this.testGetEntryForWord();
    this.testGetVideoPath();
    this.testFindBaseWord();
    this.testGetAllForms();
    this.testGetWordsInText();

    // Report results
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    console.log(`\n=== VideoData Tests: ${passed}/${total} passed ===\n`);

    this.results.forEach(r => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${r.testName}`);
    });

    return { passed, total, allPassed: passed === total };
  }
};

// Run tests
VideoDataTests.runAll();
