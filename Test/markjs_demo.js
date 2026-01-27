/**
 * mark.js Demo for ASL Extension
 *
 * mark.js handles edge cases automatically:
 * - Multiple occurrences per text node
 * - Case insensitivity
 * - Diacritics (café vs cafe)
 * - Words spanning elements
 */

let markInstance = null;

/**
 * Highlight a word and attach click handlers for ASL video lookup
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
                // Options
                accuracy: 'partially',      // 'partially', 'complementary', 'exactly'
                caseSensitive: false,
                separateWordSearch: false,  // Search for exact phrase

                // Called for EACH match found
                each: (element) => {
                    // Add click handler for ASL video popup
                    element.style.cursor = 'pointer';
                    element.addEventListener('click', () => {
                        showASLVideo(element.textContent);
                    });
                },

                // Called when all marking is done
                done: (count) => {
                    const result = document.getElementById('result');
                    if (result) {
                        result.textContent = `Found: ${count} matches (click to see ASL)`;
                    }
                    console.log(`Highlighted ${count} matches for "${word}"`);
                }
            });
        }
    });
}

/**
 * Placeholder for ASL video popup
 * TODO: Connect to WLASL dataset
 */
function showASLVideo(word) {
    console.log(`Show ASL video for: ${word}`);

    // For now, just show an alert
    // Later: Look up word in WLASL dataset and show video
    alert(`ASL video for: "${word}"\n\n(TODO: Connect to WLASL dataset)`);
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

/**
 * Test function called by button
 */
function testHighlight() {
    const word = document.getElementById('word-input').value;
    if (word) {
        highlightWord(word);
    }
}

// ============================================
// PAGE SETUP
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Load Wikipedia article for testing
    fetch('asl_article.html')
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            document.getElementById('article-container').innerHTML = doc.body.innerHTML;
        })
        .catch(err => {
            document.getElementById('article-container').innerHTML =
                '<p style="color:red;">Error loading article.</p>';
            console.error(err);
        });

    // Enter key triggers highlight
    const input = document.getElementById('word-input');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') testHighlight();
        });
    }
});
