/**
 * Popup Overlay Presenter
 *
 * Uses PopupOverlayView (Shadow DOM) for ASL sign popups on hover.
 *   - Uses mousemove + caretPositionFromPoint for hover detection
 *   - Receives word + coordinates instead of element
 *   - Checks with HighlightOverlayPresenter if word is highlighted
 *   - Uses paragraph context for Lesk-style video disambiguation
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
    // Prefer phrase match — cursor inside a highlighted phrase range.
    // If hovering over "school" in highlighted "high school", single-word
    // lookup returns "school" but range lookup returns "high_school".
    let baseWord = HighlightOverlayPresenter.findMatchAtPoint(clientX, clientY);

    // Fall back to single-word lookup
    if (!baseWord) {
      baseWord = HighlightOverlayPresenter.isWordHighlighted(word);
    }

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

    // Load video (pass coordinates for disambiguation context)
    this.loadVideo(baseWord, clientX, clientY);
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
    this.loadVideo(baseWord, clientX, clientY);
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
   * Load video for current word.
   *
   * For multi-variant words, extracts paragraph context via
   * HighlightOverlayPresenter and runs Lesk-style disambiguation.
   * If a confident pick is found, loops that single variant.
   * If no signal, falls back to cycling all variants.
   *
   * @param {string} word — base word to load
   * @param {number} clientX — mouse x (for locating paragraph context)
   * @param {number} clientY — mouse y
   */
  loadVideo(word, clientX, clientY) {
    const entries = VideoData.getAllEntriesForWord(word);

    if (!entries.length) {
      AppState.setCurrentEntry(null);
      AppState.setHasVideo(false);
      AppState.setLoading(false);
      this.view.render(AppState);
      return;
    }

    // Multiple variants — try context-based disambiguation
    if (entries.length > 1) {
      const { nearbyBaseWords, contextWords } =
        HighlightOverlayPresenter.getContextForWord(clientX, clientY, word);

      const bestIndex = VideoData.disambiguate(
        entries, nearbyBaseWords, contextWords, word
      );

      if (bestIndex >= 0) {
        // Confident pick — play this single variant on loop
        AppState.setCurrentEntry(entries[bestIndex]);
        this.view.render(AppState);

        VideoService.getVideo(word, bestIndex, entries, {
          onReady: (blobUrl, entry) => {
            AppState.setCurrentEntry(entry);
            AppState.setHasVideo(true);
            AppState.setLoading(false);
            this.view.render(AppState);
            this.view._video.loop = true;
            this.view.loadVideo(blobUrl);
          },
          onError: () => {
            AppState.setHasVideo(false);
            AppState.setLoading(false);
            this.view.render(AppState);
          }
        });
        return;
      }

      // No signal — fall back to cycling all variants
      this._loadAllVariants(word, entries);
      return;
    }

    // Single variant — play with loop
    AppState.setCurrentEntry(entries[0]);
    this.view.render(AppState);

    VideoService.getVideo(word, 0, entries, {
      onReady: (blobUrl, entry) => {
        AppState.setCurrentEntry(entry);
        AppState.setHasVideo(true);
        AppState.setLoading(false);
        this.view.render(AppState);
        this.view._video.loop = true;
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
   * Load all variants in sequence when a word has multiple signs.
   * Plays variant 0, then on 'ended' advances to 1, 2, etc., then loops back to 0.
   */
  _loadAllVariants(word, entries) {
    let currentIndex = 0;
    const video = this.view._video;

    AppState.setCurrentEntry(entries[0]);
    AppState.setLoading(true);
    this.view.render(AppState);

    // Don't loop individual videos — we loop across variants instead
    video.loop = false;

    const playVariant = (index) => {
      // Clean up previous ended listener
      if (video._onEndedHandler) {
        video.removeEventListener("ended", video._onEndedHandler);
        delete video._onEndedHandler;
      }

      VideoService.getVideo(word, index, entries, {
        onReady: (blobUrl, entry) => {
          // Bail if user moved to a different word
          if (AppState.currentWord !== word) return;

          AppState.setCurrentEntry(entry);
          AppState.setHasVideo(true);
          AppState.setLoading(false);
          this.view.render(AppState);
          this.view.loadVideo(blobUrl);

          // When this variant ends, advance to the next one
          const onEnded = () => {
            video.removeEventListener("ended", onEnded);
            delete video._onEndedHandler;
            currentIndex = (currentIndex + 1) % entries.length;
            playVariant(currentIndex);
          };
          video._onEndedHandler = onEnded;
          video.addEventListener("ended", onEnded);
        },
        onError: () => {
          // Skip to next variant on error
          currentIndex = (currentIndex + 1) % entries.length;
          playVariant(currentIndex);
        },
      });
    };

    playVariant(0);
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
