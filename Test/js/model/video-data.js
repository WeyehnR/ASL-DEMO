/**
 * Video Data Model
 * Handles WLASL dataset lookup
 */

const VideoData = {
  wordToVideos: {},
  isLoaded: false,

  // Implement VideoData.init() - load and parse WLASL JSON
  async init() {
    try {
      const response = await fetch("../archive/WLASL_v0.3.json");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const jsonData = await response.json();
      this.buildHashmap(jsonData);
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to fetch data: ", error);
    }
  },

  // Implement VideoData.buildHashmap() - convert array to hashmap
  /**
  * WLASL_v0.3.json structure:
 [
    {
        "gloss": "...",
        "instances": [
      { "video_id": "..." },
      { "video_id": "..." }
      ]
      },
      ...
      ]
      
      */
  buildHashmap(wlaslArray) {
    for (let i = 0; i < wlaslArray.length; i++) {
      const word = wlaslArray[i].gloss;
      const instances = wlaslArray[i].instances;
      this.wordToVideos[word] = [];
      for (let j = 0; j < instances.length; j++) {
        this.wordToVideos[word].push(instances[j].video_id);
      }
    }
    console.log(this.wordToVideos);
  },

  /**
     * jsonData = [
    { gloss: "book", instances: [{ video_id: "00001" }, { video_id: "00002" }] },
    { gloss: "hello", instances: [{ video_id: "00003" }] },
    // ... more entries
  ];
  */

  // Implement VideoData.getVideoPath() - lookup word in hashmap
  getVideoPath(word) {
    try {
        if(this.hasWord(word))
        {
            this.wordToVideos[word]
        }
    } catch (error) {}
  },

  getRandomVideoForWord(word) {},
  // Implement VideoData.hasWord() - check if word exists
  hasWord(word) {
    return this.wordToVideos[word] === word ? true : false
  },

  getWordList() {},
};
