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
    },

    /**
     * Show popup for a word at target element
     */
    showPopup(targetElement, word) {
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
     * Hide the popup
     */
    hidePopup() {
        PopupView.hide();
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
