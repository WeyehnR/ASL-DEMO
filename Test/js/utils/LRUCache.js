import { Node } from "./Node.js";

export class LRUCache {
  constructor(capacity, onEvict) {
    this.capacity = capacity;
    this.onEvict = onEvict || null;
    this.map = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key) {
    if (!this.map.has(key)) return null;
    const node = this.map.get(key); // O(1) lookup
    this.moveToHead(node); // mark as recently used
    return node.value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      const node = this.map.get(key);
      node.value = value;
      this.moveToHead(node);
    } else {
      const node = new Node(key, value);
      this.map.set(key, node);
      this.addToHead(node);
      if (this.map.size > this.capacity) {
        // evict least recently used (tail)
        const evict = this.tail;
        this.removeNode(evict);
        this.map.delete(evict.key);
        if (this.onEvict) this.onEvict(evict.key, evict.value);
      }
    }
  }
  //helper methods
  addToHead(node) {
    if (this.head !== null) {
      node.next = this.head;
      this.head.prev = node;
    }

    if (this.tail == null) {
      this.tail = node;
    }

    this.head = node;
  }

  moveToHead(node) {
    this.removeNode(node);
    this.addToHead(node);
  }

  removeNode(node) {
    if (node == null) {
      return;
    }

    const prev_item = node.prev;
    const next_item = node.next;

    // unlink the item node:
    // link prev and next items
    // removing referenced to the current item node
    if (prev_item !== null) {
      prev_item.next = next_item;
    }

    if (next_item !== null) {
      next_item.prev = prev_item;
    }

    if (this.head == node) {
      //item was the first element in the list
      this.head = next_item;
    }

    if (this.tail == node) {
      // item was the last element in the list
      this.tail = prev_item;
    }
    //make sure that the item itself doesn't have references to other nodes
    node.prev = null;
    node.next = null;
  }
}
