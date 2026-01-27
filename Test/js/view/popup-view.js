/**
 * Popup View
 * Handles all popup DOM operations - passive, controlled by Presenter
 */

const PopupView = {
    element: null,
    videoElement: null,
    hideTimeout: null,

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
            </div>
            <div class="asl-popup-video-container">
                <video class="asl-popup-video" autoplay loop muted playsinline>
                    <source src="" type="video/mp4">
                </video>
                <div class="asl-popup-loading">Loading...</div>
                <div class="asl-popup-no-video">No video available</div>
            </div>
            <div class="asl-popup-word"></div>
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
     * Hide the popup with delay
     */
    hide() {
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
     * Load video source
     */
    loadVideo(src, onSuccess, onError) {
        const source = this.videoElement.querySelector('source');
        source.src = src;
        this.videoElement.load();

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
