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
    /**
     * Highlight all words from the glossary
     */
    highlightAllGlossaryWords() {
        const words = Object.keys(VideoData.wordToVideos);
        let totalCount = 0;

        words.forEach(word => {
            HighlightView.highlight(
                word,
                // For each match found
                (element) => {
                    element.addEventListener('mouseenter', () => {
                        PopupPresenter.showPopup(element, element.textContent);
                    });

                    element.addEventListener('mouseleave', () => {
                        PopupPresenter.hidePopup();
                    });
                },
                // When highlighting for this word is done
                (count) => {
                    totalCount += count;
                }
            );
        });

        console.log(`Highlighted ${totalCount} total matches for ${words.length} glossary words`);
    },

    /**
     * Highlight a word and set up hover handlers
     */
    highlightWord(word) {
        let firstMatch = null;

        HighlightView.highlight(
            word,
            // For each match found
            (element) => {
                // Capture first match for scrolling
                if (!firstMatch) {
                    firstMatch = element;
                }

                element.addEventListener('mouseenter', () => {
                    PopupPresenter.showPopup(element, element.textContent);
                });

                element.addEventListener('mouseleave', () => {
                    PopupPresenter.hidePopup();
                });
            },
            // When all highlighting is done
            (count) => {
                AppState.setMatchCount(count);
                ResultView.showCount(count);
                console.log(`Highlighted ${count} matches for "${word}"`);

                // Scroll to first match
                if (firstMatch) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        );
    },

    /**
     * Clear all highlights
     */
    clearHighlights() {
        HighlightView.clear(() => {
            AppState.reset();
            ResultView.showCleared();
        });
    }
};
