/**
 * ASL Extension Configuration
 * Centralized settings for easy adjustment
 */

export const CONFIG = {
    // Popup positioning
    popup: {
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
        basePath: '../archive/videos/',
        extension:".mp4"

    }
};
