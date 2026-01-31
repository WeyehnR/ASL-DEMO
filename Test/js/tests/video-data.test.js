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

  // Mock inflection map (simulates build script output)
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

  // Test helper
  assert(condition, testName) {
    const passed = Boolean(condition);
    this.results.push({ testName, passed });
    return passed;
  },

  // Reset VideoData state before tests
  setup() {
    VideoData.wordToVideos = {};
    VideoData.inflectionMap = {};
    VideoData.reverseMap = {};
    VideoData.isLoaded = false;
  },

  // Setup with mock data including inflection map
  setupWithData() {
    VideoData.wordToVideos = this.mockGlossary;
    VideoData.inflectionMap = this.mockInflectionMap;
    // Build reverse map
    VideoData.reverseMap = {};
    for (const [inflected, base] of Object.entries(this.mockInflectionMap)) {
      if (!VideoData.reverseMap[base]) VideoData.reverseMap[base] = [];
      VideoData.reverseMap[base].push(inflected);
    }
  },

  // Test: entry structure and lookup
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

  // Test: hasWord with inflection map
  testHasWord() {
    this.setupWithData();

    this.assert(VideoData.hasWord("book") === true, "hasWord: exact 'book'");
    this.assert(VideoData.hasWord("hello") === true, "hasWord: exact 'hello'");
    this.assert(VideoData.hasWord("books") === true, "hasWord: inflection 'books'");
    this.assert(VideoData.hasWord("running") === true, "hasWord: inflection 'running'");
    this.assert(VideoData.hasWord("notaword") === false, "hasWord: false for non-existent");
    this.assert(VideoData.hasWord("") === false, "hasWord: false for empty string");
  },

  // Test: getEntryForWord returns entry with metadata
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

  // Test: getVideoPath
  testGetVideoPath() {
    this.setupWithData();

    const path = VideoData.getVideoPath("book");
    this.assert(path !== null, "getVideoPath: returns path for 'book'");
    this.assert(path.startsWith(CONFIG.video.basePath), "getVideoPath: starts with basePath");
    this.assert(path.endsWith(".mp4"), "getVideoPath: ends with .mp4");

    const noPath = VideoData.getVideoPath("notaword");
    this.assert(noPath === null, "getVideoPath: null for non-existent");
  },

  // Test: findBaseWord via inflection map
  testFindBaseWord() {
    this.setupWithData();

    // Exact matches
    this.assert(VideoData.findBaseWord("conflict") === "conflict", "stem: exact 'conflict'");
    this.assert(VideoData.findBaseWord("book") === "book", "stem: exact 'book'");

    // Inflection map lookups
    this.assert(VideoData.findBaseWord("conflicting") === "conflict", "stem: 'conflicting' -> 'conflict'");
    this.assert(VideoData.findBaseWord("conflicts") === "conflict", "stem: 'conflicts' -> 'conflict'");
    this.assert(VideoData.findBaseWord("conflicted") === "conflict", "stem: 'conflicted' -> 'conflict'");
    this.assert(VideoData.findBaseWord("books") === "book", "stem: 'books' -> 'book'");
    this.assert(VideoData.findBaseWord("booked") === "book", "stem: 'booked' -> 'book'");
    this.assert(VideoData.findBaseWord("booking") === "book", "stem: 'booking' -> 'book'");

    // Doubled consonant via inflection map
    this.assert(VideoData.findBaseWord("running") === "run", "stem: 'running' -> 'run' (pre-computed)");

    // Irregular form
    this.assert(VideoData.findBaseWord("ran") === "run", "stem: 'ran' -> 'run' (irregular)");

    // Verb forms from noun-classified words (sign is Noun in ASL-LEX)
    this.assert(VideoData.findBaseWord("signed") === "sign", "stem: 'signed' -> 'sign'");
    this.assert(VideoData.findBaseWord("signing") === "sign", "stem: 'signing' -> 'sign'");

    // ie → ying special case
    this.assert(VideoData.findBaseWord("dying") === "die", "stem: 'dying' -> 'die' (ie→ying)");
    this.assert(VideoData.findBaseWord("died") === "die", "stem: 'died' -> 'die'");

    // Non-existent words
    this.assert(VideoData.findBaseWord("xyz") === null, "stem: null for non-existent");

    // Agent nouns should NOT match (not in inflection map)
    this.assert(VideoData.findBaseWord("signer") === null, "stem: 'signer' does NOT map (agent noun)");
    this.assert(VideoData.findBaseWord("signers") === null, "stem: 'signers' does NOT map (agent noun)");
    this.assert(VideoData.findBaseWord("runner") === null, "stem: 'runner' does NOT map (agent noun)");

    // Case insensitivity
    this.assert(VideoData.findBaseWord("CONFLICT") === "conflict", "stem: case insensitive 'CONFLICT'");
    this.assert(VideoData.findBaseWord("Conflicting") === "conflict", "stem: case insensitive 'Conflicting'");
  },

  // Test: getAllForms returns base + inflections
  testGetAllForms() {
    this.setupWithData();

    const bookForms = VideoData.getAllForms("book");
    this.assert(bookForms.includes("book"), "getAllForms: includes base 'book'");
    this.assert(bookForms.includes("books"), "getAllForms: includes 'books'");
    this.assert(bookForms.includes("booked"), "getAllForms: includes 'booked'");
    this.assert(bookForms.includes("booking"), "getAllForms: includes 'booking'");
    this.assert(!bookForms.includes("booker"), "getAllForms: does NOT include 'booker'");

    // Works when called with an inflected form too
    const runForms = VideoData.getAllForms("running");
    this.assert(runForms.includes("run"), "getAllForms: 'running' returns base 'run'");
    this.assert(runForms.includes("running"), "getAllForms: 'running' includes 'running'");

    const noForms = VideoData.getAllForms("notaword");
    this.assert(noForms.length === 0, "getAllForms: empty for non-existent word");
  },

  // Test: getWordsInText — no false positives from substrings
  testGetWordsInText() {
    this.setupWithData();

    // Should find "conflict" via inflection map when "conflicting" is in text
    const words1 = VideoData.getWordsInText("The conflicting reports were discussed");
    this.assert(words1.includes("conflict"), "getWordsInText: finds 'conflict' via 'conflicting'");

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

    // Should find via inflected forms
    const words6 = VideoData.getWordsInText("She signed the document and kept running");
    this.assert(words6.includes("sign"), "getWordsInText: finds 'sign' via 'signed'");
    this.assert(words6.includes("run"), "getWordsInText: finds 'run' via 'running'");

    // Agent nouns should NOT match base words
    const words7 = VideoData.getWordsInText("The signer demonstrated ASL");
    this.assert(!words7.includes("sign"), "getWordsInText: no 'sign' from 'signer'");
  },

  // Run all tests
  runAll() {
    this.results = [];

    this.testEntryLookup();
    this.testHasWord();
    this.testGetRandomEntryForWord();
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
