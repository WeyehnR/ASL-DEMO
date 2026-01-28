/**
 * Hashmap Builder Utility
 * Pure function to convert WLASL array to hashmap
 * Shared between VideoData and build script
 */

export function buildHashmap(wlaslArray) {
  const hashmap = {};

  for (let i = 0; i < wlaslArray.length; i++) {
    const word = wlaslArray[i].gloss;
    const instances = wlaslArray[i].instances;
    hashmap[word] = [];

    for (let j = 0; j < instances.length; j++) {
      hashmap[word].push(instances[j].video_id);
    }
  }

  return hashmap;
}
