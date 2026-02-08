/**
 * ASL Extension Configuration
 * Centralized settings for easy adjustment
 */

export const CONFIG = {
    // Popup positioning
    popup: {
        width: 300,            // Estimated popup width for positioning
        height: 280,           // Estimated popup height for positioning
        offset: 8,             // Gap between element and popup
        minLeft: 10,           // Minimum distance from left edge
        leftAdjust: 50         // Horizontal offset from element
    },

    // Timing (milliseconds)
    timing: {
        hideDelay: 200         // Delay before hiding popup on mouseleave
    },

    // Video paths
    video: {
        basePath: '../archive/asl_lex_videos/',
        glossaryPath: '../archive/asl-lex-glossary.json'
    },

    // Highlight appearance
    highlight: {
        color: "yellow",       // Active color (set via setHighlightColor)
        presets: {
            yellow:   "rgba(255, 255, 0, 0.4)",
            green:    "rgba(0, 255, 127, 0.4)",
            cyan:     "rgba(0, 230, 255, 0.4)",
            pink:     "rgba(255, 105, 180, 0.35)",
            orange:   "rgba(255, 165, 0, 0.4)",
            purple:   "rgba(180, 130, 255, 0.4)",
        }
    }
};
