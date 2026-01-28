/**
 * App Presenter
 * Main application coordinator - handles page setup and top-level events
 */

import { VideoData } from "../model/video-data.js";
import { HighlightPresenter } from "./highlight-presenter.js";
import { PopupPresenter } from "./popup-presenter.js";
import { HighlightView } from "../view/highlight-view.js";

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
    loadArticle() {
        fetch('asl_article.html')
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Remove embedded videos/audio to prevent console errors
                doc.querySelectorAll('video, audio, source').forEach(el => el.remove());

                const container = document.getElementById('article-container');
                container.innerHTML = doc.body.innerHTML;

                // Set container for highlighting
                HighlightView.setContainer(container);
            })
            .catch(err => {
                document.getElementById('article-container').innerHTML =
                    '<p style="color:red;">Error loading article.</p>';
                console.error(err);
            });
    },

    /**
     * Bind UI event handlers
     */
    bindEvents() {
        const highlightBtn = document.getElementById('highlight-btn');
        const clearBtn = document.getElementById('clear-btn');
        const input = document.getElementById('word-input');

        if (highlightBtn) {
            highlightBtn.addEventListener('click', () => this.handleHighlight());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClear());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleHighlight();
            });
        }
    },

    /**
     * Handle highlight action
     */
    handleHighlight() {
        const word = document.getElementById('word-input').value;
        if (word) {
            HighlightPresenter.highlightWord(word);
        }
    },

    /**
     * Handle clear action
     */
    handleClear() {
        HighlightPresenter.clearHighlights();
    }
};

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await VideoData.init();
    AppPresenter.init();
    HighlightPresenter.highlightAllGlossaryWords();
});
