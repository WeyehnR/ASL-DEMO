/**
 * App Presenter
 * Main application coordinator - handles page setup and top-level events
 */

import { VideoData } from "../model/video-data.js";
import { AppState } from "../model/state.js";
import { HighlightPresenter } from "./highlight-presenter.js";
import { PopupPresenter } from "./popup-presenter.js";
import { HighlightView } from "../view/highlight-view.js";
import { WordChipsView } from "../view/word-chips-view.js";

const AppPresenter = {
    /**
     * Initialize the application
     */
    init() {
        // Initialize child presenters
        PopupPresenter.init();

        // Load article content
        this.loadArticle();

        // Bind UI events
        this.bindEvents();
    },

    /**
     * Load the test article
     */
    async loadArticle() {
        try {
            const response = await fetch('asl_article.html');
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Remove embedded videos/audio to prevent console errors
            doc.querySelectorAll('video, audio, source').forEach(el => el.remove());

            const container = document.getElementById('article-container');
            container.innerHTML = doc.body.innerHTML;

            // Set container for highlighting
            HighlightView.setContainer(container);

            // Highlight all glossary words first, then build chips from actual DOM matches
            await HighlightPresenter.highlightAllGlossaryWords();
            this.populateWordChipsFromDOM(container);
            this.updateToggleButton();
        } catch (err) {
            document.getElementById('article-container').innerHTML =
                '<p style="color:red;">Error loading article.</p>';
            console.error(err);
        }
    },

    /**
     * Populate word chips from actual highlighted <mark> elements in the DOM
     * This ensures only words with real matches appear as chips
     */
    populateWordChipsFromDOM(container) {
        const marks = container.querySelectorAll('mark');
        const matchedWords = new Set();

        marks.forEach(mark => {
            const baseWord = VideoData.findBaseWord(mark.textContent);
            if (baseWord) {
                matchedWords.add(baseWord);
            }
        });

        const words = [...matchedWords].sort();

        WordChipsView.setContainer(document.getElementById('word-chips'));
        WordChipsView.render(words, async (word) => {
            await HighlightPresenter.highlightWord(word);
            this.updateToggleButton();
        });
    },

    /**
     * Bind UI event handlers
     */
    bindEvents() {
        const clearBtn = document.getElementById('clear-btn');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleToggle());
        }
    },

    /**
     * Toggle between highlight-all and cleared states.
     * In 'all' mode: clears everything.
     * In 'word' or 'none' mode: restores all highlights.
     */
    async handleToggle() {
        if (AppState.highlightMode === 'all') {
            await HighlightPresenter.clearHighlights();
        } else {
            await HighlightPresenter.highlightAllGlossaryWords();
        }
        this.updateToggleButton();
    },

    /**
     * Update the toggle button text and style based on current highlight mode
     */
    updateToggleButton() {
        const btn = document.getElementById('clear-btn');
        if (!btn) return;

        if (AppState.highlightMode === 'all') {
            btn.textContent = 'Clear All Highlights';
            btn.classList.add('clear');
        } else {
            btn.textContent = 'Show All Highlights';
            btn.classList.remove('clear');
        }
    }
};

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await VideoData.init();
    AppPresenter.init();
});
