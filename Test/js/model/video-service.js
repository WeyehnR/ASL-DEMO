/**
 * Video Service
 * Handles video blob fetching, LRU caching, race condition tracking,
 * and variant cycling. Extracted from PopupPresenter to separate
 * data/caching concerns from UI coordination.
 */

import { LRUCache } from '../utils/LRUCache.js';
import { CONFIG } from '../config.js';

export const VideoService = {
    _cache: null,
    // Tracks which word is currently being loaded to handle race conditions
    // (user hovers word A, then quickly hovers word B — A's fetch should be ignored)
    _loadingWord: null,

    /**
     * Initialize the cache. On eviction, revoke all blob URLs to free memory.
     */
    init() {
        this._cache = new LRUCache(20, (_key, cached) => {
            cached.blobUrls.forEach(url => URL.revokeObjectURL(url));
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
            .then(response => response.blob())
            .then(blob => {
                if (this._loadingWord !== word) return;

                const blobUrl = URL.createObjectURL(blob);
                const cacheEntry = {
                    entries,
                    blobUrls: [],
                    currentIndex: bestIndex
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
            entry: cached.entries[nextIndex]
        };
    },

    /**
     * Fetch remaining variant blobs in background and add to cache entry.
     * Skips the index that was already fetched eagerly.
     */
    _fetchRemainingVariants(entries, cacheEntry, skipIndex) {
        entries.forEach((entry, i) => {
            if (i === skipIndex) return;
            const path = CONFIG.video.basePath + entry.videoFile;
            fetch(path)
                .then(response => response.blob())
                .then(blob => {
                    cacheEntry.blobUrls[i] = URL.createObjectURL(blob);
                })
                .catch(() => {
                    cacheEntry.blobUrls[i] = null;
                });
        });
    }
};
