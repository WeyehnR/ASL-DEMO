/**
 * Popup Overlay Presenter
 *
 * Uses PopupOverlayView (Shadow DOM) instead of PopupView.
 *
 * KEY DIFFERENCE FROM popup-presenter.js:
 *   - Uses mousemove + caretPositionFromPoint for hover detection
 *     (no <mark> elements to attach mouseenter/mouseleave to)
 *   - Receives word + coordinates instead of element
 *   - Checks with HighlightOverlayPresenter if word is highlighted
 *   - No targetElement for video disambiguation (uses word only)
 */

import { VideoData } from "../model/video-data.js";
import { AppState } from "../model/state.js";
import { PopupOverlayView } from "../view/popup-overlay-view.js";
import { VideoService } from "../model/video-service.js";
import { HighlightOverlayPresenter } from "./highlight-overlay-presenter.js";

export const PopupOverlayPresenter = {
  // The view instance
  view: null,

  /**
   * Initialize presenter - create view and set up hover detection
   */
  init() {
    VideoService.init();

    this.view = new PopupOverlayView();
    this.view.create();

    // Set up hover detection
    this.view.startHoverDetection(
      // onHoverWord callback
      (word, clientX, clientY) => this.handleHoverWord(word, clientX, clientY),
      // onLeaveWord callback
      (word) => this.handleLeaveWord(word)
    );

    // Close button
    const closeBtn = this.view._shadow.querySelector(".asl-popup-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.collapsePopup();
      });
    }

    // Esc key collapses the expanded popup
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.view._isPinned) {
        this.collapsePopup();
      }
    });
  },

  /**
   * Handle hovering over a word.
   *
   * caretPositionFromPoint already tells us the word under the cursor.
   * We just check if it's in our glossary (fast Set lookup).
   *
   * NOTE: This may trigger on words NEAR highlights when cursor is in
   * whitespace, but caretPositionFromPoint is reasonably accurate.
   * The trade-off is better responsiveness vs. perfect precision.
   */
  handleHoverWord(word, clientX, clientY) {
    // Check if this word is in our glossary
    const baseWord = HighlightOverlayPresenter.isWordHighlighted(word);
    if (!baseWord) {
      return;
    }

    // Don't update popup while it's pinned/expanded
    if (this.view._isPinned) return;

    // Cancel any pending hide
    this.view.cancelHide();

    // Same word already loaded — just reposition and show
    if (AppState.currentWord === baseWord && AppState.hasVideo) {
      this.view.show(clientX, clientY);
      return;
    }

    // Update model
    AppState.setCurrentWord(baseWord);
    AppState.setLoading(true);

    // Update view
    this.view.render(AppState);
    this.view.show(clientX, clientY);

    // Load video
    this.loadVideo(baseWord);
  },

  /**
   * Handle leaving a word (mouse moved away).
   */
  handleLeaveWord(_word) {
    this.hidePopup();
  },

  /**
   * Hide the popup
   */
  hidePopup() {
    AppState.setHasVideo(false);
    this.view.hide();
  },

  /**
   * Expand popup (pin + enlarge) - called on click
   *
   * Note: With CSS Highlight API, we don't have click events on highlights.
   * This method is available if you want to add click detection separately.
   */
  expandPopup(word, clientX, clientY) {
    // Check if this word is highlighted
    const baseWord = HighlightOverlayPresenter.isWordHighlighted(word);
    if (!baseWord) return;

    // If already pinned on same word, collapse instead (toggle)
    if (this.view._isPinned && AppState.currentWord === baseWord) {
      this.collapsePopup();
      return;
    }

    // Update model and load video
    AppState.setCurrentWord(baseWord);
    AppState.setLoading(true);
    this.view.render(AppState);
    this.view.show(clientX, clientY);
    this.view._isPinned = true;
    this.loadVideo(baseWord);
  },

  /**
   * Collapse the expanded popup
   */
  collapsePopup() {
    AppState.setHasVideo(false);
    this.view._isPinned = false;
    this.view.hide();
  },

  /**
   * Load video for current word
   *
   * Note: Without targetElement, we can't get nearby context for disambiguation.
   * For now, we just use the first variant. In a more advanced implementation,
   * you could track which range the cursor is near and get context from there.
   */
  loadVideo(word) {
    const entries = VideoData.getAllEntriesForWord(word);

    if (!entries.length) {
      AppState.setCurrentEntry(null);
      AppState.setHasVideo(false);
      AppState.setLoading(false);
      this.view.render(AppState);
      return;
    }

    // For now, use first variant (no context-based disambiguation)
    // TODO: Could improve by getting nearby highlighted words
    const bestIndex = 0;

    // Set entry immediately so popup shows word info while loading
    AppState.setCurrentEntry(entries[bestIndex]);
    this.view.render(AppState);

    VideoService.getVideo(word, bestIndex, entries, {
      onReady: (blobUrl, entry) => {
        AppState.setCurrentEntry(entry);
        AppState.setHasVideo(true);
        AppState.setLoading(false);
        this.view.render(AppState);
        this.view.loadVideo(blobUrl);
      },
      onError: () => {
        AppState.setHasVideo(false);
        AppState.setLoading(false);
        this.view.render(AppState);
      }
    });
  },

  /**
   * Cycle to next variant for the current word.
   */
  nextVariant() {
    const word = AppState.currentWord;
    const result = VideoService.nextVariant(word);
    if (!result) return;

    AppState.setCurrentEntry(result.entry);
    this.view.render(AppState);
    this.view.loadVideo(result.blobUrl);
  },

  /**
   * Stop hover detection (cleanup)
   */
  destroy() {
    this.view.stopHoverDetection();
    this.view.destroy();
  }
};
