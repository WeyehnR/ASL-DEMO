/**
 * VideoData Unit Tests
 * Run with: node Test/js/tests/video-data.test.js
 */

import { VideoData } from '../model/video-data.js';
import { CONFIG } from '../config.js';

const VideoDataTests = {
  // Mock glossary data (pre-built hashmap format)
  mockGlossary: {
    "book": ["07068", "07069", "07070"],
    "hello": ["12345"],
    "thank you": ["99001", "99002"]
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

  // Test: wordToVideos structure is correct
  testWordToVideos() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    // Check that all words exist as keys
    const hasBook = "book" in VideoData.wordToVideos;
    const hasHello = "hello" in VideoData.wordToVideos;
    const hasThankYou = "thank you" in VideoData.wordToVideos;

    this.assert(hasBook, "wordToVideos: 'book' key exists");
    this.assert(hasHello, "wordToVideos: 'hello' key exists");
    this.assert(hasThankYou, "wordToVideos: 'thank you' key exists");

    // Check that values are arrays with correct video_ids
    const bookVideos = VideoData.wordToVideos["book"];
    this.assert(Array.isArray(bookVideos), "wordToVideos: 'book' value is array");
    this.assert(bookVideos.length === 3, "wordToVideos: 'book' has 3 videos");
    this.assert(bookVideos.includes("07068"), "wordToVideos: 'book' contains '07068'");

    const helloVideos = VideoData.wordToVideos["hello"];
    this.assert(helloVideos.length === 1, "wordToVideos: 'hello' has 1 video");
  },

  // Test: hasWord returns correct boolean
  testHasWord() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    this.assert(VideoData.hasWord("book") === true, "hasWord: returns true for 'book'");
    this.assert(VideoData.hasWord("hello") === true, "hasWord: returns true for 'hello'");
    this.assert(VideoData.hasWord("notaword") === false, "hasWord: returns false for non-existent word");
    this.assert(VideoData.hasWord("") === false, "hasWord: returns false for empty string");
  },

  // Test: getRandomVideoForWord returns valid video_id
  testGetRandomVideoForWord() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    const bookVideo = VideoData.getRandomVideoForWord("book");
    const validBookIds = ["07068", "07069", "07070"];
    this.assert(validBookIds.includes(bookVideo), "getRandomVideoForWord: returns valid video_id for 'book'");

    const helloVideo = VideoData.getRandomVideoForWord("hello");
    this.assert(helloVideo === "12345", "getRandomVideoForWord: returns '12345' for 'hello'");

    // Test randomness - run multiple times and check we get different results sometimes
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(VideoData.getRandomVideoForWord("book"));
    }
    this.assert(results.size > 1, "getRandomVideoForWord: returns varied results (randomness check)");
  },

  // Test: getVideoPath returns correctly formatted path
  testGetVideoPath() {
    this.setup();
    VideoData.wordToVideos = this.mockGlossary;

    const path = VideoData.getVideoPath("book");

    // Check path starts with base path from config
    this.assert(path.startsWith(CONFIG.video.basePath), "getVideoPath: starts with basePath");

    // Check path ends with extension from config
    this.assert(path.endsWith(CONFIG.video.extension), "getVideoPath: ends with extension");

    // Check path contains a valid video_id
    const validBookIds = ["07068", "07069", "07070"];
    const containsValidId = validBookIds.some(id => path.includes(id));
    this.assert(containsValidId, "getVideoPath: contains valid video_id");

    // Check non-existent word returns undefined
    const noPath = VideoData.getVideoPath("notaword");
    this.assert(noPath === undefined, "getVideoPath: returns undefined for non-existent word");
  },

  // Run all tests
  runAll() {
    this.results = [];

    this.testWordToVideos();
    this.testHasWord();
    this.testGetRandomVideoForWord();
    this.testGetVideoPath();

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
