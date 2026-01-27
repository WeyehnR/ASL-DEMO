/**
 * Highlight Presenter
 * Coordinates between HighlightView and Models for highlighting behavior
 */

const HighlightPresenter = {
    /**
     * Highlight a word and set up hover handlers
     */
    highlightWord(word) {
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
            // When all highlighting is done
            (count) => {
                AppState.setMatchCount(count);
                ResultView.showCount(count);
                console.log(`Highlighted ${count} matches for "${word}"`);
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
