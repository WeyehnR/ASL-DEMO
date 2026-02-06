import { CONFIG } from "../config.js";
import { createPopupTemplate } from "./popup-overlay.template.js";

/**
 * PopupOverlayView — A Shadow DOM popup that is invisible to the host page.
 *
 * Behavior only (lifecycle, hover detection, positioning, rendering).
 * Styles live in popup-overlay.styles.js, DOM structure in popup-overlay.template.js.
 * Learning notes & pseudocode saved in notes/popup-overlay-pseudocode.md.
 */

export class PopupOverlayView {
  constructor() {
    this._host = null; // the <div> we attach the shadow to (lives in page DOM)
    this._shadow = null; // the ShadowRoot (invisible to page scripts)
    this._popup = null; // the actual popup container (inside the shadow)
    this._video = null; // the <video> element (inside the shadow)
    this._isPinned = false;
    this._lastWord = ""; // debounce: don't re-render if same word
    this._hideTimeout = null; // for delayed hiding

    this._onHoverWord = null; // callback the presenter sets
    this._onLeaveWord = null; // callback the presenter sets
    this._mouseMoveHandler = null; // stored for removal in stopHoverDetection
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────────────

  /**
   * Create the Shadow DOM host and attach the popup inside it.
   */
  create() {
    this._host = document.createElement("div");
    this._host.id = "asl-video-popup-host";
    this._shadow = this._host.attachShadow({ mode: "open" });
    this._shadow.innerHTML = createPopupTemplate();
    this._popup = this._shadow.querySelector(".asl-popup");
    this._video = this._shadow.querySelector(".asl-popup-video");
    document.body.appendChild(this._host);
  }

  /**
   * Clean up: remove the host element from the page.
   */
  destroy() {
    this._host.remove();
    this._host = null;
    this._shadow = null;
    this._popup = null;
    this._video = null;
  }

  // ─── HOVER DETECTION ───────────────────────────────────────────────

  /**
   * Set up mousemove-based word detection.
   *
   * Uses caretPositionFromPoint/caretRangeFromPoint to detect which
   * word the cursor is over (since CSS Highlight API highlights aren't
   * DOM elements we can attach listeners to).
   *
   * @param {Function} onHoverWord — callback(word, clientX, clientY)
   * @param {Function} onLeaveWord — callback(word)
   */
  startHoverDetection(onHoverWord, onLeaveWord) {
    this._onHoverWord = onHoverWord;
    this._onLeaveWord = onLeaveWord;

    this._mouseMoveHandler = (e) => {
      // Get text node + offset under cursor (browser-compatible)
      let node, offset;

      if (document.caretPositionFromPoint) {
        // Standard API (Firefox, modern Chrome)
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (!pos) return;
        node = pos.offsetNode;
        offset = pos.offset;
      } else if (document.caretRangeFromPoint) {
        // Legacy fallback (older Chrome/Safari)
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range) return;
        node = range.startContainer;
        offset = range.startOffset;
      } else {
        return; // Browser doesn't support either API
      }

      // Only process text nodes
      if (node.nodeType !== Node.TEXT_NODE) {
        if (this._lastWord) {
          this._onLeaveWord?.(this._lastWord);
          this._lastWord = "";
        }
        return;
      }

      // Extract the full word at cursor position
      const text = node.textContent;
      const before = text.slice(0, offset).match(/\w+$/);
      const after = text.slice(offset).match(/^\w+/);
      const word = (before?.[0] || "") + (after?.[0] || "");

      // Only fire callbacks if word changed
      if (word !== this._lastWord) {
        if (this._lastWord) {
          this._onLeaveWord?.(this._lastWord);
        }
        if (word) {
          this._onHoverWord?.(word, e.clientX, e.clientY);
        }
        this._lastWord = word;
      }
    };

    document.addEventListener("mousemove", this._mouseMoveHandler);
  }

  /**
   * Remove the mousemove listener.
   */
  stopHoverDetection() {
    if (this._mouseMoveHandler) {
      document.removeEventListener("mousemove", this._mouseMoveHandler);
      this._mouseMoveHandler = null;
    }
    this._lastWord = "";
  }
  

  // ─── POPUP DISPLAY ─────────────────────────────────────────────────

  /**
   * Show the popup near the cursor position.
   *
   * @param {number} clientX — cursor x position (from mousemove event)
   * @param {number} clientY — cursor y position
   */
  show(clientX, clientY) {
    if (!this._popup) return;

    this._popup.style.display = "block";

    const { width, height, offset } = CONFIG.popup;

    let x = clientX + offset;
    let y = clientY + offset;

    // Prevent overflow off right edge
    if (x + width > window.innerWidth) {
      x = clientX - width - offset;
    }

    // Prevent overflow off bottom edge
    if (y + height > window.innerHeight) {
      y = clientY - height - offset;
    }

    this._popup.style.left = x + "px";
    this._popup.style.top = y + "px";
  }

  /**
   * Hide the popup with a small delay to prevent flickering.
   */
  hide() {
    if (this._isPinned) return;

    clearTimeout(this._hideTimeout);
    this._hideTimeout = setTimeout(() => {
      if (this._popup) {
        this._popup.style.display = "none";
      }
      // Clean up video to free resources
      if (this._video) {
        this._video.pause();
        this._video.removeAttribute("src");
        this._video.load();
      }
    }, CONFIG.timing.hideDelay);
  }

  /**
   * Cancel a pending hide (e.g., when user hovers back quickly).
   */
  cancelHide() {
    clearTimeout(this._hideTimeout);
  }

  /**
   * Load a video into the popup's <video> element.
   *
   * @param {string} blobUrl — the cached blob URL for this word's video
   */
  loadVideo(blobUrl) {
    if (!this._video) return;

    if (!blobUrl) {
      this._video.removeAttribute("src");
      this._video.load();
      return;
    }

    this._video.src = blobUrl;
    this._video.load();
    this._video.play().catch((err) => {
      // AbortError is expected when user moves away quickly - ignore it
      if (err.name !== "AbortError") {
        console.warn("Video play failed:", err);
      }
    });
  }

  /**
   * Update the popup content (word title, definitions, etc.)
   *
   * @param {object} state — { currentWord, currentEntry, isLoading, hasVideo }
   */
  render(state) {
    if (!this._popup) return;

    // Update word display
    const wordEl = this._shadow.querySelector(".asl-popup-word");
    if (wordEl) wordEl.textContent = state.currentWord || "";

    // Update meanings and lexical class
    const meaningsEl = this._shadow.querySelector(".asl-popup-meanings");
    const lexicalEl = this._shadow.querySelector(".asl-popup-lexical-class");
    const personHintEl = this._shadow.querySelector(".asl-popup-person-hint");

    if (state.currentEntry) {
      if (meaningsEl) meaningsEl.textContent = state.currentEntry.meanings || "";
      if (lexicalEl) lexicalEl.textContent = state.currentEntry.lexicalClass || "";
      if (personHintEl) {
        personHintEl.style.display = state.currentEntry.personCombinable
          ? "block"
          : "none";
      }
    } else {
      if (meaningsEl) meaningsEl.textContent = "";
      if (lexicalEl) lexicalEl.textContent = "";
      if (personHintEl) personHintEl.style.display = "none";
    }

    // Update state classes (loading, has-video, no-video)
    this._popup.classList.remove("loading", "has-video", "no-video");

    if (state.isLoading) {
      this._popup.classList.add("loading");
    } else if (state.hasVideo) {
      this._popup.classList.add("has-video");
    } else {
      this._popup.classList.add("no-video");
    }
  }
}
