/**
 * Video Service
 * Handles video blob fetching, LRU caching, race condition tracking,
 * and variant cycling. Extracted from PopupPresenter to separate
 * data/caching concerns from UI coordination.
 */

import { LRUCache } from "../utils/LRUCache.js";
import { CONFIG } from "../config.js";

export const VideoService = {
  _cache: null,
  // Tracks which word is currently being loaded to handle race conditions
  // (user hovers word A, then quickly hovers word B — A's fetch should be ignored)
  _loadingWord: null,

  // Background fetch queue — limits how many variant fetches run at once
  // so they don't compete with the primary fetch the user is waiting on.
  _fetchQueue: [],
  _activeFetches: 0,
  _MAX_BACKGROUND_FETCHES: 3,

  /**
   * Initialize the cache. On eviction, revoke all blob URLs to free memory.
   */
  init() {
    this._cache = new LRUCache(20, (_key, cached) => {
      cached.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    });
  },

  /**
   * Get video blob URL for a word — checks cache first, fetches on miss.
   * @param {string} word - base word to load video for
   * @param {number} bestIndex - best variant index (from disambiguation)
   * @param {Array} entries - all glossary entries for this word
   * @param {Object} callbacks
   * @param {Function} callbacks.onReady - called with (blobUrl, entry) when video is available
   * @param {Function} callbacks.onError - called when fetch fails
   */
  getVideo(word, bestIndex, entries, { onReady, onError }) {
    this._loadingWord = word;
    // New word hovered — drop any queued background fetches from the old word
    this._fetchQueue = [];

    // --- Cache hit: serve from memory ---
    const cached = this._cache.get(word);
    if (cached && cached.blobUrls[bestIndex]) {
      cached.currentIndex = bestIndex;
      onReady(cached.blobUrls[bestIndex], cached.entries[bestIndex]);
      return;
    }

    // --- Cache miss: fetch the best variant's blob ---
    const videoPath = CONFIG.video.basePath + entries[bestIndex].videoFile;

    fetch(videoPath)
      .then((response) => response.blob())
      .then((blob) => {
        if (this._loadingWord !== word) return;

        const blobUrl = URL.createObjectURL(blob);
        const cacheEntry = {
          entries,
          blobUrls: [],
          currentIndex: bestIndex,
        };
        cacheEntry.blobUrls[bestIndex] = blobUrl;
        this._cache.put(word, cacheEntry);

        onReady(blobUrl, entries[bestIndex]);

        // Fetch remaining variants in background
        if (entries.length > 1) {
          this._fetchRemainingVariants(entries, cacheEntry, bestIndex);
        }
      })
      .catch(() => {
        if (this._loadingWord !== word) return;
        onError();
      });
  },

  // Code from video service

  /**
   * Cycle to next variant for a word.
   * Returns { blobUrl, entry } if available, null otherwise.
   */
  nextVariant(word) {
    const cached = this._cache.get(word);
    if (!cached || cached.entries.length <= 1) return null;

    const nextIndex = (cached.currentIndex + 1) % cached.entries.length;

    // Check if this variant's blob has been fetched yet
    if (!cached.blobUrls[nextIndex]) return null;

    cached.currentIndex = nextIndex;
    return {
      blobUrl: cached.blobUrls[nextIndex],
      entry: cached.entries[nextIndex],
    };
  },

  /**
   * Fetch remaining variant blobs in background and add to cache entry.
   * Skips the index that was already fetched eagerly.
   */
  _fetchRemainingVariants(entries, cacheEntry, skipIndex) {
    entries.forEach((entry, i) => {
      if (i === skipIndex) return;
      this._fetchQueue.push({ entry, cacheEntry, index: i });
    });
    this._processQueue();
  },

  /**
   * Pull items off the queue up to _MAX_BACKGROUND_FETCHES at a time.
   * Each fetch calls _processQueue again when it finishes, so the
   * queue keeps draining without exceeding the concurrency cap.
   */
  _processQueue() {
    while (
      this._activeFetches < this._MAX_BACKGROUND_FETCHES &&
      this._fetchQueue.length > 0
    ) {
      const { entry, cacheEntry, index } = this._fetchQueue.shift();
      const path = CONFIG.video.basePath + entry.videoFile;
      this._activeFetches++;

      fetch(path)
        .then((response) => response.blob())
        .then((blob) => {
          cacheEntry.blobUrls[index] = URL.createObjectURL(blob);
        })
        .catch(() => {
          cacheEntry.blobUrls[index] = null;
        })
        .finally(() => {
          this._activeFetches--;
          this._processQueue();
        });
    }
  },
};
