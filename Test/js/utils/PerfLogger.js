/**
 * PerfLogger — Lightweight performance logger for measuring highlight pipeline
 * and mousemove handler costs.
 *
 * Usage:
 *   import { PerfLogger } from '../utils/PerfLogger.js';
 *
 *   // Time a block:
 *   PerfLogger.time("prefilterWords");
 *   // ... work ...
 *   PerfLogger.timeEnd("prefilterWords", { words: 500 });
 *
 *   // Track mousemove (called on every move, logged in batches):
 *   PerfLogger.trackMouseMove(0.3);
 *
 *   // Save to file (triggers browser download):
 *   PerfLogger.save();
 *
 *   // Also exposed on window so you can call from DevTools console:
 *   window.__perf.save()
 *   window.__perf.print()
 */

export const PerfLogger = {
  _entries: [],
  _timers: {},

  // Mousemove is high-frequency — accumulate stats, flush periodically
  _mouse: { count: 0, totalMs: 0, maxMs: 0 },
  _mouseIntervalId: null,

  // ─── TIMING ────────────────────────────────────────────────────────

  /**
   * Start a named timer.
   */
  time(label) {
    this._timers[label] = performance.now();
  },

  /**
   * End a named timer and log the duration.
   * @param {string} label - Must match a previous time() call
   * @param {object} meta  - Extra data to attach (e.g. { words: 500 })
   */
  timeEnd(label, meta = {}) {
    const start = this._timers[label];
    if (start === undefined) {
      console.warn(`[PerfLogger] No timer named "${label}"`);
      return 0;
    }
    const ms = performance.now() - start;
    delete this._timers[label];

    this._entries.push({
      timestamp: new Date().toISOString(),
      label,
      ms: +ms.toFixed(2),
      ...meta,
    });

    return ms;
  },

  // ─── MOUSEMOVE TRACKING ────────────────────────────────────────────

  /**
   * Record a single mousemove handler execution time.
   * Call this inside the handler; stats are flushed every 5 seconds.
   */
  trackMouseMove(durationMs) {
    this._mouse.count++;
    this._mouse.totalMs += durationMs;
    if (durationMs > this._mouse.maxMs) this._mouse.maxMs = durationMs;
  },

  /**
   * Start periodic flushing of mousemove stats (every 5s).
   * Call once during init.
   */
  startMouseMoveTracking() {
    if (this._mouseIntervalId) return;
    this._mouseIntervalId = setInterval(() => {
      const s = this._mouse;
      if (s.count === 0) return;

      this._entries.push({
        timestamp: new Date().toISOString(),
        label: "mousemove (5s window)",
        ms: +s.totalMs.toFixed(2),
        calls: s.count,
        avgMs: +(s.totalMs / s.count).toFixed(3),
        maxMs: +s.maxMs.toFixed(3),
      });

      // Reset for next window
      this._mouse = { count: 0, totalMs: 0, maxMs: 0 };
    }, 5000);
  },

  // ─── OUTPUT ────────────────────────────────────────────────────────

  /**
   * Print entries to console as a table.
   */
  print() {
    if (this._entries.length === 0) {
      console.log("[PerfLogger] No entries recorded yet.");
      return;
    }
    console.table(this._entries);
  },

  /**
   * Download entries as a text file.
   * Save it into the project directory so it can be read by tools.
   */
  save(filename = "perf-log.txt") {
    if (this._entries.length === 0) {
      console.log("[PerfLogger] Nothing to save.");
      return;
    }

    const lines = this._entries.map((e) => {
      let line = `[${e.timestamp}] ${e.label}: ${e.ms}ms`;
      if (e.calls !== undefined)   line += ` | calls: ${e.calls}`;
      if (e.avgMs !== undefined)   line += ` | avg: ${e.avgMs}ms`;
      if (e.maxMs !== undefined)   line += ` | max: ${e.maxMs}ms`;
      if (e.words !== undefined)   line += ` | words: ${e.words}`;
      if (e.matches !== undefined) line += ` | matches: ${e.matches}`;
      if (e.ranges !== undefined)  line += ` | ranges: ${e.ranges}`;
      if (e.textNodes !== undefined) line += ` | textNodes: ${e.textNodes}`;
      return line;
    });

    const text = lines.join("\n") + "\n";

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Clear all recorded entries.
   */
  clear() {
    this._entries = [];
    this._mouse = { count: 0, totalMs: 0, maxMs: 0 };
  },
};

// Expose globally so you can call from DevTools console:
//   __perf.print()   — view in console
//   __perf.save()    — download file
//   __perf.clear()   — reset
if (typeof window !== "undefined") {
  window.__perf = PerfLogger;
}
