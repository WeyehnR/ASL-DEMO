/**
 * Build Glossary Script
 * Converts WLASL_v0.3.json to a lightweight hashmap glossary. It is a one time build
 *
 * Run with: node scripts/build-glossary.js
 */

import fs from "fs";
import { buildHashmap } from "../Test/js/utils/hashmap-builder.js";

const INPUT_PATH = "./archive/WLASL_v0.3.json";
const OUTPUT_PATH = "./archive/glossary.json";

// Read the WLASL JSON file
function readWlaslFile() {
  try {
    const data = fs.readFileSync(INPUT_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading from file: ",error)
  }
}

// Write the glossary to a new JSON file
//assume the hashmap is already built
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
    const hashmap = buildHashmap(wlaslArray)
    writeGlossary(hashmap)
}

main();
