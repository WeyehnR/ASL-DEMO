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
     * Highlight all glossary words in a single pass using one combined regex
     */
    highlightAll(words, onEachMatch, onComplete) {
        if (!this.container) {
            this.container = document.getElementById('article-container') || document.body;
        }

        this.markInstance = new Mark(this.container);

        // Separate words into long (4+ chars, suffix matching) and short (exact only)
        const longWords = [];
        const shortWords = [];

        for (const word of words) {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (word.length >= 4) {
                longWords.push(escaped);
            } else {
                shortWords.push(escaped);
            }
        }

        // Sort longest first so longer words match before shorter ones
        longWords.sort((a, b) => b.length - a.length);
        shortWords.sort((a, b) => b.length - a.length);

        // Build combined regex parts
        const parts = [];
        if (longWords.length > 0) {
            parts.push(`(?:${longWords.join('|')})(?:s|es|ed|ing|tion|ly|ment|ness)?`);
        }
        if (shortWords.length > 0) {
            parts.push(`(?:${shortWords.join('|')})`);
        }

        const regex = new RegExp(`\\b(?:${parts.join('|')})\\b`, 'gi');

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
                // Match word + common English suffixes for longer words (4+ chars)
                // Short words (1-3 chars) get exact match only to avoid false positives
                // e.g., "conflict" matches "conflicting" but "on" does NOT match "only"
                const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const suffixPattern = word.length >= 4 ? '(s|es|ed|ing|tion|ly|ment|ness)?' : '';
                const regex = new RegExp(`\\b${escapedWord}${suffixPattern}\\b`, 'gi');

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
