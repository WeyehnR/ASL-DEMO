/**
 * App Overlay Presenter
 *
 * Main application coordinator.
 *   - Uses HighlightOverlayPresenter (CSS Highlight API, no <mark> elements)
 *   - Uses PopupOverlayPresenter (Shadow DOM, mousemove hover detection)
 *   - Populates word chips from matched base words
 */

import { VideoData } from "../model/video-data.js";
import { AppState } from "../model/state.js";
import { HighlightOverlayPresenter } from "./highlight-overlay-presenter.js";
import { PopupOverlayPresenter } from "./popup-overlay-presenter.js";
import { WordChipsView } from "../view/word-chips-view.js";

const AppOverlayPresenter = {
  // Reference to the article container
  container: null,

  /**
   * Initialize the application
   */
  init() {
    // Initialize presenters
    HighlightOverlayPresenter.init();
    PopupOverlayPresenter.init();

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
      const response = await fetch("asl_article.html");
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Remove embedded videos/audio to prevent console errors
      doc.querySelectorAll("video, audio, source").forEach((el) => el.remove());

      this.container = document.getElementById("article-container");
      this.container.innerHTML = doc.body.innerHTML;

      // Highlight all glossary words and get matched base words
      const matchedWords = HighlightOverlayPresenter.highlightAllGlossaryWords(
        this.container
      );

      // Populate word chips from matched base words
      this.populateWordChips(matchedWords);
      this.updateToggleButton();
    } catch (err) {
      document.getElementById("article-container").innerHTML =
        '<p style="color:red;">Error loading article.</p>';
      console.error(err);
    }
  },

  /**
   * Populate word chips from matched base words.
   *
   * Unlike app-presenter.js which queries <mark> elements,
   * we use the Set returned by highlightAllGlossaryWords().
   *
   * @param {Set<string>} matchedWords - Set of base words that were matched
   */
  populateWordChips(matchedWords) {
    const words = [...matchedWords].sort();

    WordChipsView.setContainer(document.getElementById("word-chips"));
    WordChipsView.render(words, (word) => {
      // Highlight just this word (and its inflections)
      HighlightOverlayPresenter.highlightWord(this.container, word);
      this.updateToggleButton();
    });
  },

  /**
   * Bind UI event handlers
   */
  bindEvents() {
    const clearBtn = document.getElementById("clear-btn");

    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.handleToggle());
    }
  },

  /**
   * Toggle between highlight-all and cleared states.
   */
  handleToggle() {
    if (AppState.highlightMode === "all") {
      HighlightOverlayPresenter.clearHighlights();
    } else {
      const matchedWords = HighlightOverlayPresenter.highlightAllGlossaryWords(
        this.container
      );
      // Refresh word chips in case they were cleared
      this.populateWordChips(matchedWords);
    }
    this.updateToggleButton();
  },

  /**
   * Update the toggle button text and style based on current highlight mode
   */
  updateToggleButton() {
    const btn = document.getElementById("clear-btn");
    if (!btn) return;

    if (AppState.highlightMode === "all") {
      btn.textContent = "Clear All Highlights";
      btn.classList.add("clear");
    } else {
      btn.textContent = "Show All Highlights";
      btn.classList.remove("clear");
    }
  }
};

// Start app when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  await VideoData.init();
  AppOverlayPresenter.init();

  // Expose for DevTools console access
  window.highlightPresenter = HighlightOverlayPresenter;
});

export { AppOverlayPresenter };
