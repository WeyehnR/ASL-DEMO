/**
 * Popup View
 * Handles all popup DOM operations - passive, controlled by Presenter
 */

import { CONFIG } from '../config.js';

export const PopupView = {
    element: null,
    videoElement: null,
    hideTimeout: null,
    isPinned: false,

    /**
     * Create the popup DOM element (called once)
     */
    create() {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.id = 'asl-video-popup';
        this.element.innerHTML = `
            <div class="asl-popup-header">
                <span class="asl-popup-title">ASL Sign</span>
                <span class="asl-popup-lexical-class"></span>
                <button class="asl-popup-close" title="Close">\u00D7</button>
            </div>
            <div class="asl-popup-video-container">
                <video class="asl-popup-video" autoplay loop muted playsinline></video>
                <div class="asl-popup-loading">Loading...</div>
                <div class="asl-popup-no-video">No video available</div>
            </div>
            <div class="asl-popup-word"></div>
            <div class="asl-popup-meanings"></div>
            <div class="asl-popup-person-hint">Can combine with PERSON sign</div>
        `;

        document.body.appendChild(this.element);
        this.videoElement = this.element.querySelector('.asl-popup-video');
    },

    /**
     * Render popup state based on model data
     */
    render(state) {
        if (!this.element) this.create();

        // Update word display
        this.element.querySelector('.asl-popup-word').textContent = state.currentWord;

        // Update meanings and lexical class from entry
        const meaningsEl = this.element.querySelector('.asl-popup-meanings');
        const lexicalEl = this.element.querySelector('.asl-popup-lexical-class');

        const personHintEl = this.element.querySelector('.asl-popup-person-hint');

        if (state.currentEntry) {
            meaningsEl.textContent = state.currentEntry.meanings || '';
            lexicalEl.textContent = state.currentEntry.lexicalClass || '';
            personHintEl.style.display = state.currentEntry.personCombinable ? 'block' : 'none';
        } else {
            meaningsEl.textContent = '';
            lexicalEl.textContent = '';
            personHintEl.style.display = 'none';
        }

        // Update state classes
        this.element.classList.remove('loading', 'has-video', 'no-video');

        if (state.isLoading) {
            this.element.classList.add('loading');
        } else if (state.hasVideo) {
            this.element.classList.add('has-video');
        } else {
            this.element.classList.add('no-video');
        }
    },

    /**
     * Position popup near an element
     */
    position(targetElement) {
        if (!this.element) return;

        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

        const { height, offset, minLeft, leftAdjust } = CONFIG.popup;
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        if (spaceBelow >= height || spaceBelow > spaceAbove) {
            this.element.style.top = (rect.bottom + scrollTop + offset) + 'px';
        } else {
            this.element.style.top = (rect.top + scrollTop - height - offset) + 'px';
        }

        this.element.style.left = Math.max(minLeft, rect.left + scrollLeft - leftAdjust) + 'px';
    },

    /**
     * Show the popup
     */
    show() {
        if (!this.element) this.create();
        clearTimeout(this.hideTimeout);
        this.element.style.display = 'block';
    },

    /**
     * Hide the popup with delay (skips if pinned)
     */
    hide() {
        if (this.isPinned) return;

        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            if (this.element) {
                this.element.style.display = 'none';
                if (this.videoElement) {
                    try {
                        // Pause and reset playback so next hover is clean
                        this.videoElement.pause();
                        try { this.videoElement.currentTime = 0; } catch (e) { /* ignore if not allowed */ }

                        // Remove src and unload to free decoder and avoid stale canplay events
                        this.videoElement.removeAttribute('src');
                        this.videoElement.load();
                    } catch (e) {
                        console.warn('Error resetting video on hide:', e);
                    }
                }
            }
        }, CONFIG.timing.hideDelay);
    },

    /**
     * Cancel pending hide
     */
    cancelHide() {
        clearTimeout(this.hideTimeout);
    },

    /**
     * Expand the popup (pin + enlarge + center on screen)
     */
    expand() {
        if (!this.element) return;
        this.isPinned = true;
        this.element.classList.add('expanded');
        // Clear absolute positioning so fixed centering takes over
        this.element.style.top = '';
        this.element.style.left = '';
    },

    /**
     * Collapse the popup (unpin + shrink + hide)
     */
    collapse() {
        if (!this.element) return;
        this.isPinned = false;
        this.element.classList.remove('expanded');
        this.element.style.display = 'none';
        if (this.videoElement) {
            try {
                this.videoElement.pause();
                try { this.videoElement.currentTime = 0; } catch (e) {}
                this.videoElement.removeAttribute('src');
                this.videoElement.load();
            } catch (e) {
                console.warn('Error resetting video on collapse:', e);
            }
        }
    },

    /**
     * Load video source
     *
     * Robust behavior:
     * - stops current playback and clears prior handlers
     * - sets src + load(), resets currentTime when possible
     * - calls play() and catches promise rejections
     * - calls onSuccess/onError appropriately
     */
    loadVideo(src, onSuccess, onError) {
        const video = this.videoElement;
        if (!video) {
            if (onError) onError(new Error('No video element'));
            return;
        }

        // Stop any current playback and remove previous handlers
        video.pause();
        // remove any attached handlers we used earlier
        if (video._onCanPlayHandler) {
            video.removeEventListener('canplay', video._onCanPlayHandler);
            delete video._onCanPlayHandler;
        }
        if (video._onErrorHandler) {
            video.removeEventListener('error', video._onErrorHandler);
            delete video._onErrorHandler;
        }

        if (!src) {
            // ensure clean state
            video.removeAttribute('src');
            try { video.load(); } catch (e) {}
            if (onError) onError(new Error('No src'));
            return;
        }

        // Handler functions
        const onCanPlay = () => {
            // ensure starting at 0
            try { video.currentTime = 0; } catch (e) { /* ignore */ }

            // Attempt to play and handle promise
            const playPromise = video.play();
            if (playPromise && playPromise.catch) {
                playPromise.then(() => {
                    if (onSuccess) onSuccess();
                }).catch((err) => {
                    console.warn('video.play() failed:', err);
                    if (onError) onError(err);
                });
            } else {
                if (onSuccess) onSuccess();
            }

            // cleanup
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onErrorHandler);
            delete video._onCanPlayHandler;
            delete video._onErrorHandler;
        };

        const onErrorHandler = (ev) => {
            console.warn('video element error', ev);
            if (onError) onError(ev);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onErrorHandler);
            delete video._onCanPlayHandler;
            delete video._onErrorHandler;
        };

        // store refs for later removal
        video._onCanPlayHandler = onCanPlay;
        video._onErrorHandler = onErrorHandler;
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onErrorHandler);

        // Set src and load; use try/catch for older browsers
        try {
            video.src = src;
            // call load to force the browser to reset internal decoder state
            video.load();
        } catch (e) {
            console.warn('Error setting video src:', e);
            // cleanup handlers
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onErrorHandler);
            delete video._onCanPlayHandler;
            delete video._onErrorHandler;
            if (onError) onError(e);
        }
    },

    /**
     * Bind mouse events (called by Presenter)
     */
    onMouseEnter(callback) {
        if (!this.element) this.create();
        this.element.addEventListener('mouseenter', callback);
    },

    onMouseLeave(callback) {
        if (!this.element) this.create();
        this.element.addEventListener('mouseleave', callback);
    }
};