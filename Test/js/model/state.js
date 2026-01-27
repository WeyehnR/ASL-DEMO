/**
 * Application State Model
 * Holds all application state - no DOM knowledge
 */

const AppState = {
    currentWord: '',
    isLoading: false,
    hasVideo: false,
    matchCount: 0,

    /**
     * Set the current word being looked up
     */
    setCurrentWord(word) {
        this.currentWord = word;
    },

    /**
     * Set loading state
     */
    setLoading(loading) {
        this.isLoading = loading;
        if (loading) {
            this.hasVideo = false;
        }
    },

    /**
     * Set video availability
     */
    setHasVideo(hasVideo) {
        this.hasVideo = hasVideo;
        this.isLoading = false;
    },

    /**
     * Set match count from highlighting
     */
    setMatchCount(count) {
        this.matchCount = count;
    },

    /**
     * Reset state
     */
    reset() {
        this.currentWord = '';
        this.isLoading = false;
        this.hasVideo = false;
        this.matchCount = 0;
    }
};
