/**
 * Video Data Model
 * Handles ASL-LEX dataset lookup with definitions
 */

import { CONFIG } from "../config.js";

export const VideoData = {
  wordToVideos: {},
  isLoaded: false,

  // Common suffixes to strip when looking up words
  // Order matters - try longer suffixes first
  suffixes: ['ing', 'tion', 'sion', 'ment', 'ness', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'ly', 'ed', 'er', 'es', 's'],

  // Try to find the base/stem word in glossary
  findBaseWord(word) {
    const normalized = word.toLowerCase();

    // First try exact match
    if (this.wordToVideos[normalized]) {
      return normalized;
    }

    // Try removing common suffixes
    for (const suffix of this.suffixes) {
      if (normalized.endsWith(suffix) && normalized.length > suffix.length + 2) {
        const stem = normalized.slice(0, -suffix.length);
        if (this.wordToVideos[stem]) {
          return stem;
        }
        // Handle doubling: "running" -> "run" (remove extra consonant)
        if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
          const dedoubled = stem.slice(0, -1);
          if (this.wordToVideos[dedoubled]) {
            return dedoubled;
          }
        }
      }
    }

    return null;
  },

  // Load ASL-LEX glossary
  async init() {
    try {
      const response = await fetch(CONFIG.video.glossaryPath);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      this.wordToVideos = await response.json();
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to fetch glossary: ", error);
    }
  },

  // Get video path for a word
  getVideoPath(word) {
    const entry = this.getRandomEntryForWord(word);
    if (entry) {
      return CONFIG.video.basePath + entry.videoFile;
    }
    return null;
  },

  // Get a random entry (with all metadata) for a word
  // Tries exact match first, then stems the word
  getRandomEntryForWord(word) {
    const baseWord = this.findBaseWord(word);
    if (!baseWord) {
      return null;
    }
    const entries = this.wordToVideos[baseWord];
    const randomIndex = Math.floor(Math.random() * entries.length);
    return entries[randomIndex];
  },

  // Get all entries for a word (for showing variants)
  // Uses stemming to find base word
  getAllEntriesForWord(word) {
    const baseWord = this.findBaseWord(word);
    return baseWord ? this.wordToVideos[baseWord] : [];
  },

  // Get specific entry by index
  getEntryByIndex(word, index) {
    const entries = this.getAllEntriesForWord(word);
    if (index >= 0 && index < entries.length) {
      return entries[index];
    }
    return null;
  },

  // Check if word exists in glossary (with stemming)
  hasWord(word) {
    return this.findBaseWord(word) !== null;
  },

  // Get count of variants for a word
  getVariantCount(word) {
    const entries = this.getAllEntriesForWord(word);
    return entries.length;
  },

  // Find all glossary words in a text
  // Uses same matching logic as highlighter (word + common suffixes)
  // Short words (1-3 chars) get exact match only to avoid false positives
  getWordsInText(text) {
    const textLower = text.toLowerCase();

    return Object.keys(this.wordToVideos).filter((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const suffixPattern = word.length >= 4 ? '(s|es|ed|ing|er|ers|tion|ly|ment|ness)?' : '';
      const regex = new RegExp(`\\b${escapedWord}${suffixPattern}\\b`, 'gi');
      return regex.test(textLower);
    });
  }
};
