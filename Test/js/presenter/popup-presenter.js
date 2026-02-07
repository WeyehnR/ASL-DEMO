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
      return;
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
   *
   * Ensure model knows there is no video available after hiding, otherwise
   * showPopup's early-return may re-show a popup with an emptied <video>.
   */
  hidePopup() {
    // Mark model as no longer having a live video because hide()/collapse()
    // will remove the element's src and unload the decoder.
    AppState.setHasVideo(false);
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
    // When collapsing we also remove the video src in the view, so reflect that
    // in the model to avoid the stale early-return branch.
    AppState.setHasVideo(false);
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

    // No context signal + multiple variants → loop through all variants
    if (bestIndex === -1 && entries.length > 1) {
      this._loadAllVariants(word, entries);
      return;
    }

    // Context gave a confident pick (or single variant)
    const index = bestIndex === -1 ? 0 : bestIndex;
    AppState.setCurrentEntry(entries[index]);

    VideoService.getVideo(word, index, entries, {
      onReady: (blobUrl, entry) => {
        AppState.setCurrentEntry(entry);
        AppState.setHasVideo(true);
        PopupView.render(AppState);
        // Loop the single chosen variant
        PopupView.videoElement.loop = true;
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
   * Load all variants in sequence when disambiguate has no context signal.
   * Plays variant 0, then on 'ended' advances to 1, 2, etc., then loops back to 0.
   */
  _loadAllVariants(word, entries) {
    let currentIndex = 0;

    AppState.setCurrentEntry(entries[0]);
    AppState.setLoading(true);
    PopupView.render(AppState);

    // Don't loop individual videos — we loop across variants instead
    PopupView.videoElement.loop = false;

    const playVariant = (index) => {
      // Clean up previous ended listener
      const video = PopupView.videoElement;
      if (video._onEndedHandler) {
        video.removeEventListener("ended", video._onEndedHandler);
        delete video._onEndedHandler;
      }

      VideoService.getVideo(word, index, entries, {
        onReady: (blobUrl, entry) => {
          if (AppState.currentWord !== word) return;

          AppState.setCurrentEntry(entry);
          AppState.setHasVideo(true);
          PopupView.render(AppState);
          PopupView.loadVideo(
            blobUrl,
            () => {
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
            () => {},
          );
        },
        onError: () => {
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
    PopupView.render(AppState);
    PopupView.loadVideo(
      result.blobUrl,
      () => {},
      () => {},
    );
  },
};