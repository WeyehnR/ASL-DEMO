/**
 * Video Data Model
 * Handles ASL-LEX dataset lookup with definitions
 * Uses pre-computed inflection map for word matching (no runtime suffix stripping)
 */

import { CONFIG } from "../config.js";
import { wordResolver } from "./word-resolver.js";

export const VideoData = {
  wordToVideos: {},
  isLoaded: false,

  // Load ASL-LEX glossary
  async init() {
    try {
      const response = await fetch(CONFIG.video.glossaryPath);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      // Extract inflection map, then remove it from word entries
      wordResolver.inflectionMap = data.__inflectionMap || {};
      delete data.__inflectionMap;

      this.wordToVideos = data;

      // Build reverse map: base word → [inflected forms]
      wordResolver.reverseMap = {};
      for (const [inflected, base] of Object.entries(wordResolver.inflectionMap)) {
        if (!wordResolver.reverseMap[base]) {
          wordResolver.reverseMap[base] = [];
        }
        wordResolver.reverseMap[base].push(inflected);
      }
      wordResolver.init(this.wordToVideos);
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to fetch glossary: ", error);
    }
  },

  // Get video path for a word
  getVideoPath(word) {
    const entry = this.getEntryForWord(word);
    if (entry) {
      return CONFIG.video.basePath + entry.videoFile;
    }
    return null;
  },

  // Get entry (with all metadata) for a word
  // Tries exact match first, then uses inflection map
  getEntryForWord(word) {
    const baseWord = wordResolver.findBaseWord(word);
    if (!baseWord) {
      return null;
    }
    const entries = this.wordToVideos[baseWord];
    return entries[0];
  },

  // Get all entries for a word (for showing variants)
  getAllEntriesForWord(word) {
    const baseWord = wordResolver.findBaseWord(word);
    return baseWord ? this.wordToVideos[baseWord] : [];
  },


  // Pick the best variant for a word based on nearby context.
  //
  // Two scoring layers:
  //   Layer 1 (existing): nearby glossary words' lexicalClass/semanticField
  //     +1 per neighbor with matching lexicalClass
  //     +2 per neighbor with matching semanticField
  //   Layer 2 (Lesk-style): overlap between paragraph words and variant meanings
  //     +3 per meaning-token that also appears in the surrounding text
  //
  // The meanings overlap is weighted highest because it's the most specific
  // signal. For example, "hit" near "bat" matching bat_3's meanings
  // ("hit, strike, swing") is strong evidence for the verb sense.
  //
  // Returns:
  //   index >= 0  — a confident pick (context gave a signal)
  //   -1          — no context signal; caller should loop all variants
  disambiguate(entries, nearbyBaseWords, contextWords = [], targetBaseWord = "") {
    if (entries.length <= 1) return 0;

    // ── Layer 1: lexicalClass + semanticField from nearby glossary words ──

    const neighborClasses = [];
    const neighborFields = [];

    for (const word of nearbyBaseWords) {
      const entry = this.wordToVideos[word]?.[0];
      if (!entry) continue;
      if (entry.lexicalClass) neighborClasses.push(entry.lexicalClass);
      const field = entry.semanticField;
      if (field && field !== "None" && field !== "-")
        neighborFields.push(field);
    }

    const scores = new Array(entries.length).fill(0);

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];

      for (const nc of neighborClasses) {
        if (nc === e.lexicalClass) scores[i] += 1;
      }

      const field = e.semanticField;
      if (field && field !== "None" && field !== "-") {
        for (const nf of neighborFields) {
          if (nf === field) scores[i] += 2;
        }
      }
    }

    // ── Layer 2: Lesk-style meanings matching from paragraph context ──
    //
    // Compare every word in the surrounding paragraph against each
    // variant's "meanings" field. A direct synonym hit (e.g. "breeze"
    // in cool_5's meanings) is the strongest disambiguation signal.

    if (contextWords.length > 0) {
      // Build Set of context words, excluding the target word itself
      // and words <= 2 chars (articles, prepositions — too common)
      const contextSet = new Set();
      for (const w of contextWords) {
        if (w !== targetBaseWord && w.length > 2) {
          contextSet.add(w);
        }
      }

      for (let i = 0; i < entries.length; i++) {
        if (!entries[i].meanings) continue;

        // Split "hit, hit stick, knock, strike, swing" → individual tokens
        // Deduplicate so "hit" from "hit" and "hit stick" counts once
        const meaningTokens = new Set(
          entries[i].meanings.toLowerCase()
            .split(/,/)
            .flatMap(phrase => phrase.trim().split(/\s+/))
            .filter(t => t.length > 2 && t !== targetBaseWord)
        );

        for (const token of meaningTokens) {
          if (contextSet.has(token)) {
            scores[i] += 3;
          }
        }
      }
    }

    // Find the highest-scoring variant
    let bestIndex = 0;
    let bestScore = 0;

    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIndex = i;
      }
    }

    // No signal at all — return -1 so the caller can loop all variants
    if (bestScore <= 0) return -1;

    return bestIndex;
  },

  // Get specific entry by index
  getEntryByIndex(word, index) {
    const entries = this.getAllEntriesForWord(word);
    if (index >= 0 && index < entries.length) {
      return entries[index];
    }
    return null;
  },

  // Get count of variants for a word
  getVariantCount(word) {
    const entries = this.getAllEntriesForWord(word);
    return entries.length;
  },
};
