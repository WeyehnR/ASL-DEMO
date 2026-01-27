/**
 * Result View
 * Handles the result display DOM operations
 */

const ResultView = {
    element: null,

    /**
     * Set the result element
     */
    setElement(element) {
        this.element = element;
    },

    /**
     * Display match count
     */
    showCount(count) {
        if (!this.element) {
            this.element = document.getElementById('result');
        }
        if (this.element) {
            this.element.textContent = `Found: ${count} matches (hover to see ASL)`;
        }
    },

    /**
     * Display cleared state
     */
    showCleared() {
        if (!this.element) {
            this.element = document.getElementById('result');
        }
        if (this.element) {
            this.element.textContent = 'Cleared';
        }
    },

    /**
     * Clear the result display
     */
    clear() {
        if (this.element) {
            this.element.textContent = '';
        }
    }
};
