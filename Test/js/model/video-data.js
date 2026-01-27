/**
 * Video Data Model
 * Handles WLASL dataset lookup - no DOM knowledge
 */

const VideoData = {
    /**
     * Get video path for a word
     * TODO: Implement actual WLASL dataset lookup
     * 1. Load wlasl_class_list.txt to map words to class IDs
     * 2. Load nslt_2000.json to get video filenames for each class
     * 3. Return correct video path
     */
    getVideoPath(word) {
        // For now, try direct path
        return `${CONFIG.video.basePath}${word.toLowerCase()}.mp4`;
    },

    /**
     * Check if a word exists in the ASL vocabulary
     * TODO: Implement when dataset is connected
     */
    hasWord(word) {
        // Placeholder - will check against wlasl_class_list.txt
        return true;
    }
};
