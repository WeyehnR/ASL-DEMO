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


  // Pick the best variant for a word based on nearby context words.
  // Scores each variant by how well its lexical class and semantic field
  // match the surrounding highlighted words.
  //   +1 per neighbor with matching lexicalClass
  //   +2 per neighbor with matching semanticField (rarer, stronger signal)
  //
  // Returns:
  //   index >= 0  — a confident pick (context gave a signal)
  //   -1          — no context signal; caller should loop all variants
  disambiguate(entries, nearbyBaseWords) {
    if (entries.length <= 1) return 0;

    // Collect lexical classes and semantic fields of neighbors
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

    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < entries.length; i++) {
      let score = 0;
      const e = entries[i];

      for (const nc of neighborClasses) {
        if (nc === e.lexicalClass) score += 1;
      }

      const field = e.semanticField;
      if (field && field !== "None" && field !== "-") {
        for (const nf of neighborFields) {
          if (nf === field) score += 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    // No neighbor matched anything — no confident pick.
    // Return -1 so the caller can loop through all variants.
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
