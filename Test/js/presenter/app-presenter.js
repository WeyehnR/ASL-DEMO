/**
 * App Presenter
 * Main application coordinator - handles page setup and top-level events
 */

import { VideoData } from "../model/video-data.js";
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

                // Highlight all glossary words first, then build chips from actual DOM matches
                HighlightPresenter.highlightAllGlossaryWords();
                this.populateWordChipsFromDOM(container);
            })
            .catch(err => {
                document.getElementById('article-container').innerHTML =
                    '<p style="color:red;">Error loading article.</p>';
                console.error(err);
            });
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
        WordChipsView.render(words, (word) => {
            HighlightPresenter.highlightWord(word);
        });
    },

    /**
     * Bind UI event handlers
     */
    bindEvents() {
        const clearBtn = document.getElementById('clear-btn');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClear());
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
});
