/**
 * popup-overlay.styles.js — CSS for the Shadow DOM popup.
 *
 * WHY THIS IS A JS MODULE (not a .css file):
 *   Shadow DOM blocks external stylesheets from cascading in.
 *   The styles MUST live inside the shadow root. Exporting the CSS
 *   as a string lets us inject it synchronously (no flash of unstyled
 *   content) and keeps it portable across test and extension contexts.
 *
 * WHAT LIVES HERE:
 *   - Design tokens (spacing, colors, typography) scoped to :host
 *   - All .asl-popup-* component styles
 *   - State-driven rules (loading, has-video, expanded)
 */

export const POPUP_STYLES = /* css */ `
  /* CSS Custom Properties (must be defined in shadow DOM) */
  :host {
    --space-xs: 2px;
    --space-sm: 4px;
    --space-md: 8px;
    --space-lg: 12px;
    --space-xl: 15px;
    --space-2xl: 20px;

    --radius-sm: 2px;
    --radius-md: 4px;
    --radius-lg: 8px;
    --radius-xl: 12px;

    --font-sans: Arial, sans-serif;
    --text-xs: 10px;
    --text-sm: 11px;
    --text-base: 12px;
    --text-md: 13px;
    --text-lg: 14px;
    --text-xl: 16px;

    --neutral-400: #888;
    --neutral-800: #333;
    --neutral-850: #2a2a2a;
    --neutral-900: #1a1a1a;
    --neutral-950: #000;

    --color-primary: #4CAF50;

    --popup-bg: var(--neutral-900);
    --popup-header-bg: var(--neutral-850);
    --popup-border: var(--neutral-800);
    --popup-text: #fff;
    --popup-muted: var(--neutral-400);
    --popup-video-bg: var(--neutral-950);
    --popup-width: 240px;
    --popup-video-height: 180px;
    --popup-z: 10000;
  }

  .asl-popup {
    display: none;
    position: fixed;
    z-index: var(--popup-z);
    background: var(--popup-bg);
    border-radius: var(--radius-xl);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    width: var(--popup-width);
    overflow: hidden;
    font-family: var(--font-sans);
  }

  .asl-popup.loading .asl-popup-loading {
    display: block;
  }

  .asl-popup.no-video .asl-popup-no-video {
    display: block;
  }

  .asl-popup.has-video .asl-popup-video {
    display: block;
  }

  .asl-popup-header {
    display: flex;
    align-items: center;
    background: var(--popup-header-bg);
    padding: var(--space-md) var(--space-lg);
  }

  .asl-popup-title {
    color: var(--popup-text);
    font-size: var(--text-base);
    font-weight: 500;
  }

  .asl-popup-video-container {
    position: relative;
    width: 100%;
    height: var(--popup-video-height);
    background: var(--popup-header-bg);
  }

  .asl-popup-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: none;
  }

  .asl-popup-loading,
  .asl-popup-no-video {
    position: absolute;
    inset: 0;
    display: none;
    place-content: center;
    color: var(--popup-muted);
    font-size: var(--text-lg);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .asl-popup-word {
    padding: var(--space-md) var(--space-lg) var(--space-sm);
    color: var(--popup-text);
    font-size: var(--text-xl);
    font-weight: 600;
    text-align: center;
    background: var(--popup-header-bg);
  }

  .asl-popup-meanings {
    padding: var(--space-sm) var(--space-lg) var(--space-md);
    color: var(--popup-muted);
    font-size: var(--text-base);
    text-align: center;
    background: var(--popup-header-bg);
    font-style: italic;
  }

  .asl-popup-person-hint {
    display: none;
    padding: var(--space-xs) var(--space-lg);
    color: var(--color-primary);
    font-size: var(--text-sm);
    text-align: center;
    background: var(--popup-header-bg);
  }

  .asl-popup-lexical-class {
    color: var(--popup-muted);
    font-size: var(--text-xs);
    font-weight: normal;
    margin-inline-start: var(--space-md);
    padding: var(--space-xs) 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
  }

  .asl-popup-close {
    display: none;
    margin-inline-start: auto;
    background: none;
    border: none;
    color: var(--popup-muted);
    font-size: var(--text-xl);
    cursor: pointer;
    padding: 0 var(--space-sm);
    line-height: 1;
  }

  .asl-popup-close:hover {
    color: var(--popup-text);
  }

  /* Expanded State */
  .asl-popup.expanded {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 480px;
  }

  .asl-popup.expanded .asl-popup-close {
    display: block;
  }

  .asl-popup.expanded .asl-popup-video-container {
    height: 360px;
  }

  .asl-popup.expanded .asl-popup-word {
    font-size: var(--text-xl);
  }

  .asl-popup.expanded .asl-popup-meanings {
    font-size: var(--text-lg);
  }
`;
