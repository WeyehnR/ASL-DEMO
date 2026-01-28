/**
 * Video Data Model
 * Handles WLASL dataset lookup
 */

import { CONFIG } from "../config.js";

export const VideoData = {
  wordToVideos: {},
  isLoaded: false,

  // Load pre-built glossary hashmap
  async init() {
    try {
      const response = await fetch("../archive/glossary.json");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      this.wordToVideos = await response.json();
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to fetch data: ", error);
    }
  },

  // Implement VideoData.getVideoPath() - lookup word in hashmap
  getVideoPath(word) {
    try {
      const normalizedWord = word.toLowerCase();
      if (this.hasWord(normalizedWord)) {
        return (
          CONFIG.video.basePath +
          this.getRandomVideoForWord(normalizedWord) +
          CONFIG.video.extension
        );
      }
    } catch (error) {
      console.error(error);
    }
  },

  getRandomVideoForWord(word) {
    //this is an array of video ids
    const instances = this.wordToVideos[word];
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  },
  // Implement VideoData.hasWord() - check if word exists
  hasWord(word) {
    return Object.hasOwn(this.wordToVideos, word.toLowerCase());
  },

  getWordsInText(text) {
    const textLower = text.toLowerCase();
    return Object.keys(this.wordToVideos).filter((word) =>
      textLower.includes(word.toLowerCase()),
    );
  }
};
