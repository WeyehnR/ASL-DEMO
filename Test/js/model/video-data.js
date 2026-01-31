/**
 * Video Data Model
 * Handles ASL-LEX dataset lookup with definitions
 * Uses pre-computed inflection map for word matching (no runtime suffix stripping)
 */

import { CONFIG } from "../config.js";

export const VideoData = {
  wordToVideos: {},
  inflectionMap: {},   // inflected form → base word
  reverseMap: {},      // base word → [inflected forms]
  isLoaded: false,

  // Find the base/stem word in glossary via inflection map lookup
  findBaseWord(word) {
    const normalized = word.toLowerCase();

    // Exact match in glossary
    if (this.wordToVideos[normalized]) {
      return normalized;
    }

    // Inflection map lookup
    const base = this.inflectionMap[normalized];
    if (base && this.wordToVideos[base]) {
      return base;
    }

    return null;
  },

  // Get all forms (base + inflections) for a word
  getAllForms(word) {
    const baseWord = this.findBaseWord(word);
    if (!baseWord) return [];

    const forms = [baseWord];
    if (this.reverseMap[baseWord]) {
      forms.push(...this.reverseMap[baseWord]);
    }
    return forms;
  },

  // Load ASL-LEX glossary
  async init() {
    try {
      const response = await fetch(CONFIG.video.glossaryPath);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      // Extract inflection map, then remove it from word entries
      this.inflectionMap = data.__inflectionMap || {};
      delete data.__inflectionMap;

      this.wordToVideos = data;

      // Build reverse map: base word → [inflected forms]
      this.reverseMap = {};
      for (const [inflected, base] of Object.entries(this.inflectionMap)) {
        if (!this.reverseMap[base]) {
          this.reverseMap[base] = [];
        }
        this.reverseMap[base].push(inflected);
      }

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
    const baseWord = this.findBaseWord(word);
    if (!baseWord) {
      return null;
    }
    const entries = this.wordToVideos[baseWord];
    return entries[0];
  },

  // Get all entries for a word (for showing variants)
  getAllEntriesForWord(word) {
    const baseWord = this.findBaseWord(word);
    return baseWord ? this.wordToVideos[baseWord] : [];
  },

  // Pick the best variant for a word based on nearby context words.
  // Scores each variant by how well its lexical class and semantic field
  // match the surrounding highlighted words.
  //   +1 per neighbor with matching lexicalClass
  //   +2 per neighbor with matching semanticField (rarer, stronger signal)
  // Returns the index of the best-scoring variant (0 if no signal).
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
      if (field && field !== 'None' && field !== '-') neighborFields.push(field);
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
      if (field && field !== 'None' && field !== '-') {
        for (const nf of neighborFields) {
          if (nf === field) score += 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

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

  // Check if word exists in glossary (with inflection map)
  hasWord(word) {
    return this.findBaseWord(word) !== null;
  },

  // Get count of variants for a word
  getVariantCount(word) {
    const entries = this.getAllEntriesForWord(word);
    return entries.length;
  },

  // Find all glossary words that appear in a text
  // Tokenizes text and does O(1) lookups against glossary + inflection map
  getWordsInText(text) {
    const textWords = new Set(text.toLowerCase().match(/\b[a-z]+\b/g) || []);
    const matchedBaseWords = new Set();

    for (const textWord of textWords) {
      // Direct glossary match
      if (this.wordToVideos[textWord]) {
        matchedBaseWords.add(textWord);
        continue;
      }
      // Inflection map match
      const base = this.inflectionMap[textWord];
      if (base && this.wordToVideos[base]) {
        matchedBaseWords.add(base);
      }
    }

    return [...matchedBaseWords];
  }
};
