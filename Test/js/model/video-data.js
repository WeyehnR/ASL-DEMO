/**
 * Video Data Model
 * Handles WLASL dataset lookup
 */

import { CONFIG } from '../config.js';
import { buildHashmap } from '../utils/hashmap-builder.js';

export const VideoData = {
  wordToVideos: {},
  isLoaded: false,

  /**
       * jsonData = [
      { gloss: "book", instances: [{ video_id: "00001" }, { video_id: "00002" }] },
      { gloss: "hello", instances: [{ video_id: "00003" }] },
      // ... more entries
    ];
    */

  // Implement VideoData.init() - load and parse WLASL JSON
  async init() {
    try {
      const response = await fetch("../archive/WLASL_v0.3.json");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const jsonData = await response.json();
      this.loadHashmap(jsonData);
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to fetch data: ", error);
    }
  },

  // Implement VideoData.buildHashmap() - convert array to hashmap
  /**
  * WLASL_v0.3.json structure:
 [
    {
        "gloss": "...",
        "instances": [
      { "video_id": "..." },
      { "video_id": "..." }
      ]
      },
      ...
      ]
      
      */
  loadHashmap(wlaslArray) {
    this.wordToVideos = buildHashmap(wlaslArray);
  },

  // Implement VideoData.getVideoPath() - lookup word in hashmap
  getVideoPath(word) {
    try {
      if (this.hasWord(word)) {
        return CONFIG.video.basePath + this.getRandomVideoForWord(word) + CONFIG.video.extension
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
    return Object.hasOwn(this.wordToVideos,word);
  }
};
