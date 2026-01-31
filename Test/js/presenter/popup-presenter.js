/**
 * Popup Presenter
 * Coordinates between PopupView and Models for popup behavior
 */

import { VideoData } from '../model/video-data.js';
import { AppState } from '../model/state.js';
import { PopupView } from '../view/popup-view.js';
import { CONFIG } from '../config.js';
import { LRUCache } from '../utils/LRUCache.js';

export const PopupPresenter = {
    videoCache: null,
    // Tracks which word is currently being loaded to handle race conditions
    // (user hovers word A, then quickly hovers word B — A's fetch should be ignored)
    _loadingWord: null,

    /**
     * Initialize presenter - bind view events
     */
    init() {
        // Cache up to 20 words. On eviction, revoke all blob URLs to free memory.
        this.videoCache = new LRUCache(20, (_key, cached) => {
            cached.blobUrls.forEach(url => URL.revokeObjectURL(url));
        });

        PopupView.create();

        // Keep popup visible when hovering over it
        PopupView.onMouseEnter(() => {
            PopupView.cancelHide();
        });

        PopupView.onMouseLeave(() => {
            this.hidePopup();
        });

        // Close button collapses the expanded popup
        const closeBtn = PopupView.element.querySelector('.asl-popup-close');
        closeBtn.addEventListener('click', () => {
            this.collapsePopup();
        });

        // Fullscreen button
        const fullscreenBtn = PopupView.element.querySelector('.asl-popup-fullscreen');
        fullscreenBtn.addEventListener('click', () => {
            PopupView.enterFullscreen();
        });

        // Esc key collapses the expanded popup
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && PopupView.isPinned) {
                this.collapsePopup();
            }
        });
    },

    /**
     * Show popup for a word at target element (hover)
     */
    showPopup(targetElement, word) {
        // Don't update popup while it's pinned/expanded
        if (PopupView.isPinned) return;

        // Update model
        AppState.setCurrentWord(word);
        AppState.setLoading(true);

        // Update view
        PopupView.render(AppState);
        PopupView.position(targetElement);
        PopupView.show();

        // Load video
        this.loadVideo(word, targetElement);
    },

    /**
     * Hide the popup (respects pinned state)
     */
    hidePopup() {
        PopupView.hide();
    },

    /**
     * Expand popup for a word (click to pin + enlarge)
     */
    expandPopup(targetElement, word) {
        // If already pinned on same word, collapse instead (toggle)
        if (PopupView.isPinned && AppState.currentWord === word) {
            this.collapsePopup();
            return;
        }

        // Update model and load video
        AppState.setCurrentWord(word);
        AppState.setLoading(true);
        PopupView.render(AppState);
        PopupView.show();
        PopupView.expand();
        this.loadVideo(word, targetElement);
    },

    /**
     * Collapse the expanded popup
     */
    collapsePopup() {
        PopupView.collapse();
    },

    /**
     * Load video for current word — checks cache first, fetches as blob on miss.
     * Cache stores all variant blob URLs per word for multi-variant support.
     * Uses nearby highlighted words to disambiguate which variant to show.
     */
    loadVideo(word, targetElement) {
        this._loadingWord = word;

        const entries = VideoData.getAllEntriesForWord(word);

        if (!entries.length) {
            AppState.setCurrentEntry(null);
            AppState.setHasVideo(false);
            PopupView.render(AppState);
            return;
        }

        // Pick the best variant based on surrounding context
        const nearbyWords = this._getNearbyContext(targetElement, word);
        const bestIndex = VideoData.disambiguate(entries, nearbyWords);

        // --- Cache hit: serve from memory ---
        const cached = this.videoCache.get(word);
        if (cached && cached.blobUrls[bestIndex]) {
            cached.currentIndex = bestIndex;
            AppState.setCurrentEntry(cached.entries[bestIndex]);
            AppState.setHasVideo(true);
            PopupView.render(AppState);
            PopupView.loadVideo(
                cached.blobUrls[bestIndex],
                () => {},
                () => {}
            );
            return;
        }

        // --- Cache miss: fetch the best variant's blob first ---
        AppState.setCurrentEntry(entries[bestIndex]);
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

                this.videoCache.put(word, cacheEntry);

                PopupView.loadVideo(
                    blobUrl,
                    () => {
                        AppState.setHasVideo(true);
                        PopupView.render(AppState);
                    },
                    () => {
                        AppState.setHasVideo(false);
                        PopupView.render(AppState);
                    }
                );

                // Fetch remaining variants in background
                if (entries.length > 1) {
                    this._fetchRemainingVariants(entries, cacheEntry, bestIndex);
                }
            })
            .catch(() => {
                if (this._loadingWord !== word) return;
                AppState.setHasVideo(false);
                PopupView.render(AppState);
            });
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
    },

    /**
     * Collect base words from nearby <mark> elements in the same paragraph.
     * Used as context signal for variant disambiguation.
     */
    _getNearbyContext(targetElement, word) {
        const paragraph = targetElement.closest('p') || targetElement.parentElement;
        const marks = paragraph.querySelectorAll('mark');
        const nearbyWords = [];

        for (const mark of marks) {
            const base = VideoData.findBaseWord(mark.textContent);
            if (!base || base === word) continue;  // skip the word we're disambiguating
            nearbyWords.push(base);
        }

        return nearbyWords;
    },

    /**
     * Cycle to next variant for the current word.
     * Only works if the word has multiple entries and the blob is ready.
     */
    nextVariant() {
        const word = AppState.currentWord;
        const cached = this.videoCache.get(word);
        if (!cached || cached.entries.length <= 1) return;

        const nextIndex = (cached.currentIndex + 1) % cached.entries.length;

        // Check if this variant's blob has been fetched yet
        if (!cached.blobUrls[nextIndex]) return;

        cached.currentIndex = nextIndex;
        AppState.setCurrentEntry(cached.entries[nextIndex]);
        PopupView.render(AppState);
        PopupView.loadVideo(
            cached.blobUrls[nextIndex],
            () => {},
            () => {}
        );
    }
};
