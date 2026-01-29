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
                <button class="asl-popup-fullscreen" title="Fullscreen">\u26F6</button>
                <div class="asl-popup-loading">Loading...</div>
                <div class="asl-popup-no-video">No video available</div>
            </div>
            <div class="asl-popup-word"></div>
            <div class="asl-popup-meanings"></div>
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

        if (state.currentEntry) {
            meaningsEl.textContent = state.currentEntry.meanings || '';
            lexicalEl.textContent = state.currentEntry.lexicalClass || '';
        } else {
            meaningsEl.textContent = '';
            lexicalEl.textContent = '';
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

        this.hideTimeout = setTimeout(() => {
            if (this.element) {
                this.element.style.display = 'none';
                this.videoElement.pause();
                this.videoElement.src = '';
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
        this.videoElement.pause();
        this.videoElement.src = '';
    },

    /**
     * Enter fullscreen on the video element
     */
    enterFullscreen() {
        if (!this.videoElement) return;

        if (this.videoElement.requestFullscreen) {
            this.videoElement.requestFullscreen();
        } else if (this.videoElement.webkitRequestFullscreen) {
            this.videoElement.webkitRequestFullscreen();
        }
    },

    /**
     * Load video source
     */
    loadVideo(src, onSuccess, onError) {
        this.videoElement.src = src || '';

        this.videoElement.oncanplay = () => {
            this.videoElement.play();
            if (onSuccess) onSuccess();
        };

        this.videoElement.onerror = () => {
            if (onError) onError();
        };
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
