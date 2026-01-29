/**
 * Popup Presenter
 * Coordinates between PopupView and Models for popup behavior
 */

import { VideoData } from '../model/video-data.js';
import { AppState } from '../model/state.js';
import { PopupView } from '../view/popup-view.js';

export const PopupPresenter = {
    /**
     * Initialize presenter - bind view events
     */
    init() {
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
        this.loadVideo(word);
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
        this.loadVideo(word);
    },

    /**
     * Collapse the expanded popup
     */
    collapsePopup() {
        PopupView.collapse();
    },

    /**
     * Load video for current word
     */
    loadVideo(word) {
        // Get entry with metadata (meanings, lexical class, etc.)
        const entry = VideoData.getRandomEntryForWord(word);
        AppState.setCurrentEntry(entry);

        if (!entry) {
            AppState.setHasVideo(false);
            PopupView.render(AppState);
            console.log(`No entry found for: ${word}`);
            return;
        }

        const videoPath = VideoData.getVideoPath(word);

        PopupView.loadVideo(
            videoPath,
            // On success
            () => {
                AppState.setHasVideo(true);
                PopupView.render(AppState);
                console.log(`Loaded video for: ${word} - ${entry.meanings}`);
            },
            // On error
            () => {
                AppState.setHasVideo(false);
                PopupView.render(AppState);
                console.log(`No video found for: ${word}`);
            }
        );
    }
};
