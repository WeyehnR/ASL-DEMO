/**
 * ASL Highlighter
 * Uses mark.js to highlight words and attach hover handlers
 */

let markInstance = null;

/**
 * Highlight a word and attach hover handlers for ASL video popup
 */
function highlightWord(word) {
    const container = document.getElementById('article-container') || document.body;

    // Create mark.js instance
    markInstance = new Mark(container);

    // Clear previous highlights first
    markInstance.unmark({
        done: () => {
            // Now highlight the new word
            markInstance.mark(word, {
                accuracy: 'partially',
                caseSensitive: false,
                separateWordSearch: false,

                // Called for EACH match found
                each: (element) => {
                    element.style.cursor = 'pointer';

                    // Show popup on hover
                    element.addEventListener('mouseenter', () => {
                        showVideoPopup(element, element.textContent);
                    });

                    element.addEventListener('mouseleave', () => {
                        hideVideoPopup();
                    });
                },

                // Called when all marking is done
                done: (count) => {
                    const result = document.getElementById('result');
                    if (result) {
                        result.textContent = `Found: ${count} matches (hover to see ASL)`;
                    }
                    console.log(`Highlighted ${count} matches for "${word}"`);
                }
            });
        }
    });
}

/**
 * Clear all highlights
 */
function clearHighlights() {
    if (markInstance) {
        markInstance.unmark();
    }
    const result = document.getElementById('result');
    if (result) result.textContent = 'Cleared';
}
