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
     */
    highlightAll(words, onEachMatch, onComplete) {
        if (!this.container) {
            this.container = document.getElementById('article-container') || document.body;
        }

        this.markInstance = new Mark(this.container);

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
            done: (count) => {
                if (onComplete) onComplete(count);
            }
        });
    },

    /**
     * Highlight all forms of a word, call back for each match.
     * @param {string[]} allForms - All forms to highlight (base + inflections)
     * @param {Function} onEachMatch - Callback for each highlighted element
     * @param {Function} onComplete - Callback when done, receives match count
     */
    highlight(allForms, onEachMatch, onComplete) {
        if (!this.container) {
            this.container = document.getElementById('article-container') || document.body;
        }

        this.markInstance = new Mark(this.container);

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
