/**
 * VideoData Unit Tests
 * Run with: node Test/js/tests/video-data.test.js
 */

import { VideoData } from '../model/video-data.js';
import { CONFIG } from '../config.js';

const VideoDataTests = {
  // Mock glossary data (ASL-LEX format)
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

  results: [],

  // Test helper
  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    return passed;
  },

  // Reset VideoData state before tests
  setup() {
    VideoData.wordToVideos = {};
    VideoData.isLoaded = false;
  },

  // Test: entry structure and lookup
  testEntryLookup() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    this.assert("book" in VideoData.wordToVideos, "lookup: 'book' key exists");
    this.assert("hello" in VideoData.wordToVideos, "lookup: 'hello' key exists");

    const bookEntries = VideoData.wordToVideos["book"];
    this.assert(Array.isArray(bookEntries), "lookup: 'book' value is array");
    this.assert(bookEntries.length === 2, "lookup: 'book' has 2 entries");
    this.assert(bookEntries[0].meanings === "book, novel, read", "lookup: 'book' entry has meanings");
    this.assert(bookEntries[0].lexicalClass === "Noun", "lookup: 'book' entry has lexicalClass");
  },

  // Test: hasWord with stemming
  testHasWord() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    this.assert(VideoData.hasWord("book") === true, "hasWord: exact 'book'");
    this.assert(VideoData.hasWord("hello") === true, "hasWord: exact 'hello'");
    this.assert(VideoData.hasWord("notaword") === false, "hasWord: false for non-existent");
    this.assert(VideoData.hasWord("") === false, "hasWord: false for empty string");
  },

  // Test: getRandomEntryForWord returns entry with metadata
  testGetRandomEntryForWord() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    const entry = VideoData.getRandomEntryForWord("book");
    this.assert(entry !== null, "getRandomEntry: returns entry for 'book'");
    this.assert(entry.entryId !== undefined, "getRandomEntry: entry has entryId");
    this.assert(entry.meanings !== undefined, "getRandomEntry: entry has meanings");
    this.assert(entry.videoFile !== undefined, "getRandomEntry: entry has videoFile");

    const noEntry = VideoData.getRandomEntryForWord("notaword");
    this.assert(noEntry === null, "getRandomEntry: null for non-existent");
  },

  // Test: getVideoPath
  testGetVideoPath() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    const path = VideoData.getVideoPath("book");
    this.assert(path !== null, "getVideoPath: returns path for 'book'");
    this.assert(path.startsWith(CONFIG.video.basePath), "getVideoPath: starts with basePath");
    this.assert(path.endsWith(".mp4"), "getVideoPath: ends with .mp4");

    const noPath = VideoData.getVideoPath("notaword");
    this.assert(noPath === null, "getVideoPath: null for non-existent");
  },

  // Test: findBaseWord stemming
  testFindBaseWord() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    // Exact matches
    this.assert(VideoData.findBaseWord("conflict") === "conflict", "stem: exact 'conflict'");
    this.assert(VideoData.findBaseWord("book") === "book", "stem: exact 'book'");

    // Suffix stripping (4+ char words)
    this.assert(VideoData.findBaseWord("conflicting") === "conflict", "stem: 'conflicting' -> 'conflict'");
    this.assert(VideoData.findBaseWord("conflicts") === "conflict", "stem: 'conflicts' -> 'conflict'");
    this.assert(VideoData.findBaseWord("conflicted") === "conflict", "stem: 'conflicted' -> 'conflict'");
    this.assert(VideoData.findBaseWord("books") === "book", "stem: 'books' -> 'book'");

    // Doubled consonant: "running" -> "run"
    this.assert(VideoData.findBaseWord("running") === "run", "stem: 'running' -> 'run' (doubled consonant)");

    // Non-existent words
    this.assert(VideoData.findBaseWord("xyz") === null, "stem: null for non-existent");

    // Case insensitivity
    this.assert(VideoData.findBaseWord("CONFLICT") === "conflict", "stem: case insensitive 'CONFLICT'");
    this.assert(VideoData.findBaseWord("Conflicting") === "conflict", "stem: case insensitive 'Conflicting'");
  },

  // Test: regex matching - short words (1-3 chars) exact only
  testShortWordMatching() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    const suffixPattern = (word) =>
      word.length >= 4 ? '(s|es|ed|ing|tion|ly|ment|ness)?' : '';

    const testMatch = (word, text) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}${suffixPattern(word)}\\b`, 'gi');
      return regex.test(text);
    };

    // "on" should NOT match "only"
    this.assert(!testMatch("on", "She only turned the light"), "match: 'on' does NOT match 'only'");
    this.assert(testMatch("on", "She turned on the light"), "match: 'on' matches exact 'on'");

    // "die" should NOT match "audience"
    this.assert(!testMatch("die", "The audience applauded"), "match: 'die' does NOT match 'audience'");
    this.assert(testMatch("die", "He will die"), "match: 'die' matches exact 'die'");

    // "bra" should NOT match "Brazil"
    this.assert(!testMatch("bra", "Brazil is beautiful"), "match: 'bra' does NOT match 'Brazil'");
    this.assert(testMatch("bra", "She bought a bra"), "match: 'bra' matches exact 'bra'");
  },

  // Test: regex matching - long words (4+ chars) with suffixes
  testLongWordMatching() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    const suffixPattern = (word) =>
      word.length >= 4 ? '(s|es|ed|ing|tion|ly|ment|ness)?' : '';

    const testMatch = (word, text) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}${suffixPattern(word)}\\b`, 'gi');
      return regex.test(text);
    };

    // "conflict" should match suffixed forms
    this.assert(testMatch("conflict", "The conflict arose"), "match: 'conflict' exact");
    this.assert(testMatch("conflict", "Conflicting reports"), "match: 'conflict' -> 'Conflicting'");
    this.assert(testMatch("conflict", "Multiple conflicts"), "match: 'conflict' -> 'conflicts'");
    this.assert(testMatch("conflict", "They conflicted"), "match: 'conflict' -> 'conflicted'");

    // "conflict" should NOT match in hyphenated second part
    this.assert(testMatch("conflict", "A conflict-free zone"), "match: 'conflict' in 'conflict-free'");

    // "book" should match suffixed forms
    this.assert(testMatch("book", "She booked a flight"), "match: 'book' -> 'booked'");
    this.assert(testMatch("book", "Two books on the shelf"), "match: 'book' -> 'books'");

    // "page" should NOT match "Paget" (different word ending in 't')
    this.assert(!testMatch("page", "Paget Gorman system"), "match: 'page' does NOT match 'Paget'");
    this.assert(testMatch("page", "See this page for details"), "match: 'page' matches exact 'page'");
    this.assert(testMatch("page", "Multiple pages exist"), "match: 'page' -> 'pages'");

    // "sign" should NOT match "signer" or "signers" (-er/-ers create agent nouns)
    this.assert(!testMatch("sign", "Native signers use ASL"), "match: 'sign' does NOT match 'signers'");
    this.assert(!testMatch("sign", "The signer demonstrated"), "match: 'sign' does NOT match 'signer'");
    this.assert(testMatch("sign", "Learn to sign"), "match: 'sign' matches exact 'sign'");
    this.assert(testMatch("sign", "Multiple signs exist"), "match: 'sign' -> 'signs'");
    this.assert(testMatch("sign", "She signed the document"), "match: 'sign' -> 'signed'");
    this.assert(testMatch("sign", "He was signing"), "match: 'sign' -> 'signing'");
  },

  // Test: getWordsInText should not return false positives
  testGetWordsInText() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    // Should find "conflict" in text containing "conflicting"
    const words1 = VideoData.getWordsInText("The conflicting reports were discussed");
    this.assert(words1.includes("conflict"), "getWordsInText: finds 'conflict' in 'conflicting'");

    // Should NOT find "bra" in text containing only "Brazil"
    const words2 = VideoData.getWordsInText("Brazil is a beautiful country");
    this.assert(!words2.includes("bra"), "getWordsInText: no 'bra' in 'Brazil'");

    // Should NOT find "on" in text containing only "only"
    const words3 = VideoData.getWordsInText("She only went home");
    this.assert(!words3.includes("on"), "getWordsInText: no 'on' in 'only'");

    // Should find "on" when it's actually in the text
    const words4 = VideoData.getWordsInText("She turned on the light");
    this.assert(words4.includes("on"), "getWordsInText: finds 'on' in exact match");

    // Should NOT find "die" in "audience"
    const words5 = VideoData.getWordsInText("The audience applauded loudly");
    this.assert(!words5.includes("die"), "getWordsInText: no 'die' in 'audience'");
  },

  // Run all tests
  runAll() {
    this.results = [];

    this.testEntryLookup();
    this.testHasWord();
    this.testGetRandomEntryForWord();
    this.testGetVideoPath();
    this.testFindBaseWord();
    this.testShortWordMatching();
    this.testLongWordMatching();
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
