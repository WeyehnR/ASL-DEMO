/**
 * Highlight Overlay Presenter
 *
 * Uses HighlightOverlayView (CSS Custom Highlight API) instead of mark.js.
 *
 * KEY DIFFERENCE FROM highlight-presenter.js:
 *   - No <mark> elements to attach event listeners to
 *   - Tracks matches via onEachMatch callback (stores ranges, not elements)
 *   - Navigation scrolls to range positions instead of element.scrollIntoView()
 *   - Hover detection is handled by PopupOverlayPresenter (via mousemove)
 */

import { VideoData } from "../model/video-data.js";
import { wordResolver } from "../model/word-resolver.js";
import { AppState } from "../model/state.js";
import { HighlightOverlayView } from "../view/highlight-overlay-view.js";
import { ResultView } from "../view/result-view.js";

export const HighlightOverlayPresenter = {
  // The view instance
  view: null,

  // Track matches for navigation (stores {word, range} objects)
  matches: [],
  currentMatchIndex: -1,

  // Track which base words were found (for word chips)
  matchedBaseWords: new Set(),

  /**
   * Initialize the presenter
   */
  init() {
    this.view = new HighlightOverlayView();
  },

  /**
   * Highlight all words from the glossary in a single pass.
   *
   * @param {HTMLElement} container - The element to highlight within
   * @returns {Set<string>} - Set of base words that were matched
   */
  highlightAllGlossaryWords(container) {
    this.matches = [];
    this.currentMatchIndex = -1;
    this.matchedBaseWords.clear();
    AppState.setHighlightMode("all");

    const baseWords = Object.keys(VideoData.wordToVideos);
    const inflectedForms = Object.keys(wordResolver.inflectionMap);
    const allWords = baseWords.concat(inflectedForms);

    // Guard against empty words array (causes infinite loop)
    if (allWords.length === 0) {
      ResultView.clear();
      return this.matchedBaseWords;
    }

    this.view.highlightAll(container, allWords, (matchedText, textNode, offset) => {
      // Find the base word for this match
      const baseWord = wordResolver.findBaseWord(matchedText) || matchedText.toLowerCase();
      this.matchedBaseWords.add(baseWord);

      // Store the range for potential navigation
      const range = this.view._ranges[this.view._ranges.length - 1];
      this.matches.push({ word: matchedText, baseWord, range, textNode, offset });
    });

    ResultView.clear();
    return this.matchedBaseWords;
  },

  /**
   * Highlight a specific word and its inflections.
   *
   * @param {HTMLElement} container - The element to highlight within
   * @param {string} word - The word to highlight
   */
  highlightWord(container, word) {
    this.matches = [];
    this.currentMatchIndex = -1;
    this.matchedBaseWords.clear();
    AppState.setHighlightMode("word");

    const allForms = wordResolver.getAllForms(word);

    // Guard against empty words array
    if (allForms.length === 0) {
      AppState.setMatchCount(0);
      ResultView.showCount(0, this);
      return;
    }

    this.view.highlightAll(container, allForms, (matchedText, textNode, offset) => {
      const baseWord = wordResolver.findBaseWord(matchedText) || matchedText.toLowerCase();
      this.matchedBaseWords.add(baseWord);

      const range = this.view._ranges[this.view._ranges.length - 1];
      this.matches.push({ word: matchedText, baseWord, range, textNode, offset });
    });

    const count = this.matches.length;
    AppState.setMatchCount(count);
    ResultView.showCount(count, this);

    // Navigate to first match
    if (this.matches.length > 0) {
      this.goToMatch(0);
    }
  },

  /**
   * Navigate to a specific match by index.
   *
   * Since we don't have <mark> elements, we scroll the range into view
   * by creating a temporary element or using range.getBoundingClientRect().
   */
  goToMatch(index) {
    if (this.matches.length === 0) return;

    // Update index (wrap around)
    this.currentMatchIndex = index;
    if (this.currentMatchIndex < 0) {
      this.currentMatchIndex = this.matches.length - 1;
    } else if (this.currentMatchIndex >= this.matches.length) {
      this.currentMatchIndex = 0;
    }

    // Get the range for this match
    const match = this.matches[this.currentMatchIndex];
    const range = match.range;

    // Scroll range into view
    // Note: Range doesn't have scrollIntoView, so we use getBoundingClientRect
    const rect = range.getBoundingClientRect();
    const scrollY = window.scrollY + rect.top - window.innerHeight / 2;
    window.scrollTo({ top: scrollY, behavior: "smooth" });

    // Update result view with current position
    ResultView.updatePosition(this.currentMatchIndex + 1, this.matches.length);
  },

  /**
   * Go to next match
   */
  nextMatch() {
    this.goToMatch(this.currentMatchIndex + 1);
  },

  /**
   * Go to previous match
   */
  prevMatch() {
    this.goToMatch(this.currentMatchIndex - 1);
  },

  /**
   * Check if a word (from hover detection) is currently highlighted.
   * Returns the base word if highlighted, null otherwise.
   *
   * @param {string} word - The word to check
   * @returns {string|null} - The base word if highlighted, null otherwise
   */
  isWordHighlighted(word) {
    const baseWord = wordResolver.findBaseWord(word);
    if (baseWord && this.matchedBaseWords.has(baseWord)) {
      return baseWord;
    }
    // Also check if the word itself is in the set (for base words)
    if (this.matchedBaseWords.has(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return null;
  },

  /**
   * Check if a point is over a highlight for a SPECIFIC word.
   * Much faster than checking all ranges - only checks ranges for the given word.
   *
   * @param {number} clientX - Mouse x position
   * @param {number} clientY - Mouse y position
   * @param {string} baseWord - The base word to check ranges for
   * @returns {boolean} - True if point is over a highlight of this word
   */
  isPointOverWordHighlight(clientX, clientY, baseWord) {
    for (const match of this.matches) {
      // Only check ranges for this specific word
      if (match.baseWord !== baseWord) continue;

      const rects = match.range.getClientRects();
      for (const rect of rects) {
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Clear all highlights
   */
  clearHighlights() {
    this.matches = [];
    this.currentMatchIndex = -1;
    this.matchedBaseWords.clear();
    this.view.clear();
    AppState.reset();
    ResultView.showCleared();
  },

  /**
   * Get the set of matched base words (for word chips)
   */
  getMatchedBaseWords() {
    return this.matchedBaseWords;
  }
};
