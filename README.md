# ASL Demo Extension

A browser extension that highlights words on web pages and shows ASL (American Sign Language) video translations.

## Setup

### 1. Download WLASL Dataset

Download the WLASL dataset from Kaggle and extract it to an `archive/` folder in the project root:

https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed

The folder should contain:
- `videos/` folder with MP4 files
- `nslt_100.json`, `nslt_300.json`, `nslt_1000.json`, `nslt_2000.json`
- `wlasl_class_list.txt`

### 2. Download mark.js

Download mark.js to the lib folder:

```bash
curl -o Test/lib/mark.min.js https://cdnjs.cloudflare.com/ajax/libs/mark.js/8.11.1/mark.min.js
```

Or download manually from: https://cdnjs.cloudflare.com/ajax/libs/mark.js/8.11.1/mark.min.js

### 3. Run the Test Page

Start a local server (e.g., Live Server in VS Code) and open:

```
http://localhost:5500/Test/markjs_test.html
```

## Files

- `Test/markjs_demo.js` - Main demo using mark.js library
- `Test/markjs_test.html` - Test page for the mark.js demo
- `Test/word_highlight.js` - Custom highlighter implementation (learning exercise)
- `Test/word_highlight.test.js` - Unit tests for custom highlighter
