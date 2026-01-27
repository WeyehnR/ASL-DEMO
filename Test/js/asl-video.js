/**
 * ASL Video Loader
 * Handles loading videos from the WLASL dataset
 */

/**
 * Load ASL video for a word
 * TODO: Connect to WLASL dataset JSON files
 */
function loadASLVideo(word) {
    const popup = getVideoPopup();
    if (!popup) return;

    const video = popup.querySelector('.asl-popup-video');
    const source = video.querySelector('source');

    // TODO: Look up word in WLASL dataset
    // 1. Load wlasl_class_list.txt to map words to class IDs
    // 2. Load nslt_2000.json to get video filenames for each class
    // 3. Build path to video file

    // For now, try direct path
    const videoPath = `../archive/videos/${word.toLowerCase()}.mp4`;

    source.src = videoPath;
    video.load();

    video.oncanplay = () => {
        popup.classList.remove('loading', 'no-video');
        popup.classList.add('has-video');
        video.play();
    };

    video.onerror = () => {
        popup.classList.remove('loading', 'has-video');
        popup.classList.add('no-video');
        console.log(`No video found for: ${word}`);
    };
}
