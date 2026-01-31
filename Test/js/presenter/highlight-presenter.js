/**
 * Highlight Presenter
 * Coordinates between HighlightView and Models for highlighting behavior
 */

import { VideoData } from '../model/video-data.js';
import { AppState } from '../model/state.js';
import { HighlightView } from '../view/highlight-view.js';
import { ResultView } from '../view/result-view.js';
import { PopupPresenter } from './popup-presenter.js';

export const HighlightPresenter = {
    // Track matches for navigation
    matches: [],
    currentMatchIndex: -1,

    /**
     * Highlight all words from the glossary in a single pass
     * Includes base words + all inflected forms from the inflection map
     */
    highlightAllGlossaryWords() {
        const baseWords = Object.keys(VideoData.wordToVideos);
        const inflectedForms = Object.keys(VideoData.inflectionMap);
        const allWords = baseWords.concat(inflectedForms);

        HighlightView.highlightAll(
            allWords,
            (element) => {
                const baseWord = VideoData.findBaseWord(element.textContent) || element.textContent;

                element.addEventListener('mouseenter', () => {
                    PopupPresenter.showPopup(element, baseWord);
                });

                element.addEventListener('mouseleave', () => {
                    PopupPresenter.hidePopup();
                });

                element.addEventListener('click', () => {
                    PopupPresenter.expandPopup(element, baseWord);
                });
            }
        );
    },

    /**
     * Highlight a word and set up hover handlers
     */
    highlightWord(word) {
        // Reset match tracking
        this.matches = [];
        this.currentMatchIndex = -1;

        const allForms = VideoData.getAllForms(word);

        HighlightView.highlight(
            allForms,
            // For each match found
            (element) => {
                // Store all matches for navigation
                this.matches.push(element);

                const baseWord = VideoData.findBaseWord(element.textContent) || element.textContent;

                element.addEventListener('mouseenter', () => {
                    PopupPresenter.showPopup(element, baseWord);
                });

                element.addEventListener('mouseleave', () => {
                    PopupPresenter.hidePopup();
                });

                element.addEventListener('click', () => {
                    PopupPresenter.expandPopup(element, baseWord);
                });
            },
            // When all highlighting is done
            (count) => {
                AppState.setMatchCount(count);
                ResultView.showCount(count, this);
                console.log(`Highlighted ${count} matches for "${word}"`);

                // Navigate to first match
                if (this.matches.length > 0) {
                    this.goToMatch(0);
                }
            }
        );
    },

    /**
     * Navigate to a specific match by index
     */
    goToMatch(index) {
        if (this.matches.length === 0) return;

        // Remove highlight from current match
        if (this.currentMatchIndex >= 0 && this.matches[this.currentMatchIndex]) {
            this.matches[this.currentMatchIndex].classList.remove('current-match');
        }

        // Update index (wrap around)
        this.currentMatchIndex = index;
        if (this.currentMatchIndex < 0) {
            this.currentMatchIndex = this.matches.length - 1;
        } else if (this.currentMatchIndex >= this.matches.length) {
            this.currentMatchIndex = 0;
        }

        // Highlight and scroll to new match
        const match = this.matches[this.currentMatchIndex];
        match.classList.add('current-match');
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update result view with current position
        ResultView.updatePosition(this.currentMatchIndex + 1, this.matches.length);
    },

    /**
     * Go to next match
     */
    nextMatch() {
        this.goToMatch(this.currentMatchIndex + 1);
    },

    /**
     * Go to previous match
     */
    prevMatch() {
        this.goToMatch(this.currentMatchIndex - 1);
    },

    /**
     * Clear all highlights
     */
    clearHighlights() {
        this.matches = [];
        this.currentMatchIndex = -1;
        HighlightView.clear(() => {
            AppState.reset();
            ResultView.showCleared();
        });
    }
};
