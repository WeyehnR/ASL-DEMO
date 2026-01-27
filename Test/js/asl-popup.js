/**
 * ASL Video Popup UI
 * Handles creating, showing, hiding, and positioning the popup
 */

let videoPopup = null;
let hideTimeout = null;

/**
 * Create the video popup DOM element
 */
function createVideoPopup() {
    if (videoPopup) return videoPopup;

    videoPopup = document.createElement('div');
    videoPopup.id = 'asl-video-popup';
    videoPopup.innerHTML = `
        <div class="asl-popup-header">
            <span class="asl-popup-title"></span>
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

    document.body.appendChild(videoPopup);

    // Keep popup visible when hovering over it
    videoPopup.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
    });

    videoPopup.addEventListener('mouseleave', () => {
        hideVideoPopup();
    });

    return videoPopup;
}

/**
 * Show the video popup near an element
 */
function showVideoPopup(element, word) {
    const popup = createVideoPopup();
    clearTimeout(hideTimeout);

    // Update content
    popup.querySelector('.asl-popup-title').textContent = 'ASL Sign';
    popup.querySelector('.asl-popup-word').textContent = word;

    // Show loading state
    popup.classList.remove('has-video', 'no-video');
    popup.classList.add('loading');

    // Position popup near the element
    positionPopup(popup, element);

    // Load video
    loadASLVideo(word);
}

/**
 * Position the popup near the target element
 */
function positionPopup(popup, element) {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    popup.style.display = 'block';

    // Position above or below based on available space
    const popupHeight = 280;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= popupHeight || spaceBelow > spaceAbove) {
        popup.style.top = (rect.bottom + scrollTop + 8) + 'px';
    } else {
        popup.style.top = (rect.top + scrollTop - popupHeight - 8) + 'px';
    }

    popup.style.left = Math.max(10, rect.left + scrollLeft - 50) + 'px';
}

/**
 * Hide the video popup with a small delay
 */
function hideVideoPopup() {
    hideTimeout = setTimeout(() => {
        if (videoPopup) {
            videoPopup.style.display = 'none';
            const video = videoPopup.querySelector('.asl-popup-video');
            video.pause();
            video.src = '';
        }
    }, 200);
}

/**
 * Get the popup element (for video loader to update)
 */
function getVideoPopup() {
    return videoPopup;
}
