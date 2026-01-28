/**
 * Build Glossary Script
 * Converts WLASL_v0.3.json to a lightweight hashmap glossary. It is a one time build
 * Only includes video IDs that exist locally
 *
 * Run with: node scripts/build-glossary.js
 */

import fs from "fs";
import path from "path";
import { buildHashmap } from "../Test/js/utils/hashmap-builder.js";

const INPUT_PATH = "./archive/WLASL_v0.3.json";
const OUTPUT_PATH = "./archive/glossary.json";
const VIDEOS_PATH = "./archive/videos";

// Read the WLASL JSON file
function readWlaslFile() {
  try {
    const data = fs.readFileSync(INPUT_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading from file: ",error)
  }
}

// Get list of available video IDs (without extension)
function getAvailableVideoIds() {
    try {
        const files = fs.readdirSync(VIDEOS_PATH);
        return new Set(files.map(f => path.basename(f, '.mp4')));
    } catch (error) {
        console.error("Error reading videos folder:", error);
        return new Set();
    }
}

// Filter hashmap to only include existing videos
function filterByAvailableVideos(hashmap, availableIds) {
    const filtered = {};
    let totalWords = 0;
    let keptWords = 0;

    for (const [word, videoIds] of Object.entries(hashmap)) {
        totalWords++;
        const validIds = videoIds.filter(id => availableIds.has(id));
        if (validIds.length > 0) {
            filtered[word] = validIds;
            keptWords++;
        }
    }

    console.log(`Filtered: ${keptWords}/${totalWords} words have available videos`);
    return filtered;
}

// Write the glossary to a new JSON file
function writeGlossary(hashmap) {
    try {
        fs.writeFileSync(OUTPUT_PATH,JSON.stringify(hashmap),'utf-8')
    } catch (error) {
        console.error("Error writing to file: ",error)
    }
}

// Main function
function main() {
    const wlaslArray = readWlaslFile();
    const hashmap = buildHashmap(wlaslArray);
    const availableIds = getAvailableVideoIds();
    console.log(`Found ${availableIds.size} video files`);
    const filteredHashmap = filterByAvailableVideos(hashmap, availableIds);
    writeGlossary(filteredHashmap);
    console.log("Glossary built successfully!");
}

main();
