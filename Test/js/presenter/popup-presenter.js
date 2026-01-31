/**
 * Popup Presenter
 * Coordinates between PopupView, VideoService, and HighlightPresenter.
 * Delegates video caching/fetching to VideoService and
 * disambiguation context to HighlightPresenter.
 */

import { VideoData } from "../model/video-data.js";
import { AppState } from "../model/state.js";
import { PopupView } from "../view/popup-view.js";
import { VideoService } from "../model/video-service.js";
import { HighlightPresenter } from "./highlight-presenter.js";

export const PopupPresenter = {
  /**
   * Initialize presenter - bind view events
   */
  init() {
    VideoService.init();
    PopupView.create();

    // Keep popup visible when hovering over it
    PopupView.onMouseEnter(() => {
      PopupView.cancelHide();
    });

    PopupView.onMouseLeave(() => {
      this.hidePopup();
    });

    // Close button collapses the expanded popup
    const closeBtn = PopupView.element.querySelector(".asl-popup-close");
    closeBtn.addEventListener("click", () => {
      this.collapsePopup();
    });

    // Esc key collapses the expanded popup
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && PopupView.isPinned) {
        this.collapsePopup();
      }
    });
  },

  /**
   * Show popup for a word at target element (hover)
   */
  showPopup(targetElement, word) {
    // Don't update popup while it's pinned/expanded
    if (PopupView.isPinned) return;

    // Same word already loaded — just reposition and show (avoids video decode flicker)
    if (AppState.currentWord === word && AppState.hasVideo) {
      PopupView.position(targetElement);
      PopupView.show();

    }

    // Update model
    AppState.setCurrentWord(word);
    AppState.setLoading(true);

    // Update view
    PopupView.render(AppState);
    PopupView.position(targetElement);
    PopupView.show();

    // Load video
    this.loadVideo(word, targetElement);
  },

  /**
   * Hide the popup (respects pinned state)
   */
  hidePopup() {
    PopupView.hide();
  },

  /**
   * Expand popup for a word (click to pin + enlarge)
   */
  expandPopup(targetElement, word) {
    // If already pinned on same word, collapse instead (toggle)
    if (PopupView.isPinned && AppState.currentWord === word) {
      this.collapsePopup();
      return;
    }

    // Update model and load video
    AppState.setCurrentWord(word);
    AppState.setLoading(true);
    PopupView.render(AppState);
    PopupView.show();
    PopupView.expand();
    this.loadVideo(word, targetElement);
  },

  /**
   * Collapse the expanded popup
   */
  collapsePopup() {
    PopupView.collapse();
  },

  /**
   * Load video for current word — delegates to VideoService for caching/fetching
   * and HighlightPresenter for disambiguation context.
   */
  loadVideo(word, targetElement) {
    const entries = VideoData.getAllEntriesForWord(word);

    if (!entries.length) {
      AppState.setCurrentEntry(null);
      AppState.setHasVideo(false);
      PopupView.render(AppState);
      return;
    }

    // Pick the best variant based on surrounding context
    const nearbyWords = HighlightPresenter.getNearbyContext(
      targetElement,
      word,
    );
    const bestIndex = VideoData.disambiguate(entries, nearbyWords);

    // Set entry immediately so popup shows word info while loading
    AppState.setCurrentEntry(entries[bestIndex]);

    VideoService.getVideo(word, bestIndex, entries, {
      onReady: (blobUrl, entry) => {
        AppState.setCurrentEntry(entry);
        AppState.setHasVideo(true);
        PopupView.render(AppState);
        PopupView.loadVideo(
          blobUrl,
          () => {},
          () => {},
        );
      },
      onError: () => {
        AppState.setHasVideo(false);
        PopupView.render(AppState);
      },
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
    PopupView.render(AppState);
    PopupView.loadVideo(
      result.blobUrl,
      () => {},
      () => {},
    );
  },
};
