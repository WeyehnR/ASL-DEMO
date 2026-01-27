/**
 * Main Entry Point
 * Page setup and event handlers
 */

/**
 * Highlight word from input
 */
function handleHighlight() {
    const word = document.getElementById('word-input').value;
    if (word) {
        highlightWord(word);
    }
}

/**
 * Page initialization
 */
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

    // Button event listeners
    const highlightBtn = document.getElementById('highlight-btn');
    const clearBtn = document.getElementById('clear-btn');
    const input = document.getElementById('word-input');

    if (highlightBtn) {
        highlightBtn.addEventListener('click', handleHighlight);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearHighlights);
    }

    // Enter key triggers highlight
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleHighlight();
        });
    }
});
