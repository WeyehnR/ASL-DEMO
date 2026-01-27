/**
 * Highlight View
 * Handles text highlighting DOM operations - wraps mark.js
 */

const HighlightView = {
    markInstance: null,
    container: null,

    /**
     * Set the container to highlight within
     */
    setContainer(element) {
        this.container = element;
    },

    /**
     * Highlight a word and call back for each match
     */
    highlight(word, onEachMatch, onComplete) {
        if (!this.container) {
            this.container = document.getElementById('article-container') || document.body;
        }

        this.markInstance = new Mark(this.container);

        // Clear previous highlights first
        this.markInstance.unmark({
            done: () => {
                this.markInstance.mark(word, {
                    accuracy: 'partially',
                    caseSensitive: false,
                    separateWordSearch: false,

                    each: (element) => {
                        element.style.cursor = 'pointer';
                        if (onEachMatch) onEachMatch(element);
                    },

                    done: (count) => {
                        if (onComplete) onComplete(count);
                    }
                });
            }
        });
    },

    /**
     * Clear all highlights
     */
    clear(onComplete) {
        if (this.markInstance) {
            this.markInstance.unmark({
                done: onComplete
            });
        } else if (onComplete) {
            onComplete();
        }
    }
};
