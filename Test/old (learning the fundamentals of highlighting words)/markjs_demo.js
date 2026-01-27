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
let videoPopup = null;
let hideTimeout = null;

/**
 * Create the video popup element
 */
function createVideoPopup() {
    if (videoPopup) return videoPopup;

    videoPopup = document.createElement('div');
    videoPopup.id = 'asl-video-popup';
    videoPopup.innerHTML = `
        <div class="asl-popup-header">
            <span class="asl-popup-title"></span>
        </div>
        <div class="asl-popup-video-container">
            <video class="asl-popup-video" autoplay loop muted playsinline>
                <source src="" type="video/mp4">
            </video>
            <div class="asl-popup-loading">Loading...</div>
            <div class="asl-popup-no-video">No video available</div>
        </div>
        <div class="asl-popup-word"></div>
    `;

    document.body.appendChild(videoPopup);

    // Keep popup visible when hovering over it
    videoPopup.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
    });

    videoPopup.addEventListener('mouseleave', () => {
        hideVideoPopup();
    });

    return videoPopup;
}

/**
 * Show the video popup near an element
 */
function showVideoPopup(element, word) {
    const popup = createVideoPopup();
    clearTimeout(hideTimeout);

    // Update content
    popup.querySelector('.asl-popup-title').textContent = 'ASL Sign';
    popup.querySelector('.asl-popup-word').textContent = word;

    // Show loading state
    popup.classList.remove('has-video', 'no-video');
    popup.classList.add('loading');

    // Position popup near the element
    const rect = element.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    popup.style.display = 'block';

    // Position above or below based on space
    const popupHeight = 280;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= popupHeight || spaceBelow > spaceAbove) {
        popup.style.top = (rect.bottom + scrollTop + 8) + 'px';
    } else {
        popup.style.top = (rect.top + scrollTop - popupHeight - 8) + 'px';
    }

    popup.style.left = Math.max(10, rect.left + scrollLeft - 50) + 'px';

    // Load video (TODO: connect to WLASL dataset)
    loadASLVideo(word);
}

/**
 * Hide the video popup
 */
function hideVideoPopup() {
    hideTimeout = setTimeout(() => {
        if (videoPopup) {
            videoPopup.style.display = 'none';
            const video = videoPopup.querySelector('.asl-popup-video');
            video.pause();
            video.src = '';
        }
    }, 200);
}

/**
 * Load ASL video for a word
 * TODO: Connect to WLASL dataset
 */
function loadASLVideo(word) {
    const popup = videoPopup;
    const video = popup.querySelector('.asl-popup-video');
    const source = video.querySelector('source');

    // TODO: Look up word in WLASL dataset
    // For now, simulate with placeholder
    const videoPath = `../archive/videos/${word.toLowerCase()}.mp4`;

    source.src = videoPath;
    video.load();

    video.oncanplay = () => {
        popup.classList.remove('loading', 'no-video');
        popup.classList.add('has-video');
        video.play();
    };

    video.onerror = () => {
        popup.classList.remove('loading', 'has-video');
        popup.classList.add('no-video');
        console.log(`No video found for: ${word}`);
    };
}

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
                // Options
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
