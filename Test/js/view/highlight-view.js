/**
 * Highlight View
 * Handles text highlighting DOM operations - wraps mark.js
 */

export const HighlightView = {
    markInstance: null,
    container: null,

    /**
     * Set the container to highlight within
     */
    setContainer(element) {
        this.container = element;
    },

    /**
     * Highlight all glossary words in a single DOM pass using one combined regex.
     * mark.js mark(array) loops internally per word, so we must use markRegExp
     * with a single regex to avoid 2000+ separate DOM traversals.
     * @param {string[]} words - All words to highlight
     * @param {Function} onEachMatch - Callback for each highlighted element
     * @returns {Promise<number>} Resolves with the match count when done
     */
    highlightAll(words, onEachMatch) {
        if (!this.container) {
            this.container = document.getElementById('article-container') || document.body;
        }

        this.markInstance = new Mark(this.container);

        return new Promise((resolve) => {
            // Clear previous highlights first (handles word → all transitions)
            this.markInstance.unmark({
                done: () => {
                    // Escape each word for regex, sort longest first for correct alternation
                    const escaped = words
                        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .sort((a, b) => b.length - a.length);

                    const regex = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');

                    this.markInstance.markRegExp(regex, {
                        each: (element) => {
                            element.style.cursor = 'pointer';
                            if (onEachMatch) onEachMatch(element);
                        },
                        done: (count) => resolve(count)
                    });
                }
            });
        });
    },

    /**
     * Highlight all forms of a word, call back for each match.
     * @param {string[]} allForms - All forms to highlight (base + inflections)
     * @param {Function} onEachMatch - Callback for each highlighted element
     * @returns {Promise<number>} Resolves with the match count when done
     */
    highlight(allForms, onEachMatch) {
        if (!this.container) {
            this.container = document.getElementById('article-container') || document.body;
        }

        this.markInstance = new Mark(this.container);

        return new Promise((resolve) => {
            // Clear previous highlights first
            this.markInstance.unmark({
                done: () => {
                    const escaped = allForms
                        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .sort((a, b) => b.length - a.length);

                    const regex = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');

                    this.markInstance.markRegExp(regex, {
                        each: (element) => {
                            element.style.cursor = 'pointer';
                            if (onEachMatch) onEachMatch(element);
                        },
                        done: (count) => resolve(count)
                    });
                }
            });
        });
    },

    /**
     * Clear all highlights
     * @returns {Promise<void>} Resolves when unmark is complete
     */
    clear() {
        return new Promise((resolve) => {
            if (this.markInstance) {
                this.markInstance.unmark({ done: resolve });
            } else {
                resolve();
            }
        });
    }
};
