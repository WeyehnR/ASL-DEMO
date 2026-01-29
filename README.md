# ASL Demo Extension

A browser extension that highlights words on web pages and shows ASL (American Sign Language) video translations with definitions.

## Setup

### 1. Clone ASL-LEX Dataset

Clone the ASL-LEX repository:

```bash
git clone https://github.com/ASL-LEX/asl-lex.git
```

### 2. Download Videos

Requires [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed.

```bash
node scripts/download-asl-lex-videos.js
```

### 3. Build Glossary

```bash
node scripts/build-asl-lex-glossary.js
```

### 4. Download mark.js

Download mark.js to the lib folder:

```bash
curl -o Test/lib/mark.min.js https://cdnjs.cloudflare.com/ajax/libs/mark.js/8.11.1/mark.min.js
```

### 5. Run the Test Page

Start a local server (e.g., Live Server in VS Code) and open:

```
http://localhost:[whatever your port number are]/Test/mvp_test.html
```

## Architecture (MVP- not Minimum Viable Product, Modal View Presenter - keeping it lightweight for a test webpage)

- `Test/js/model/` - Data models (VideoData, AppState)
- `Test/js/view/` - DOM rendering (HighlightView, PopupView, WordChipsView, ResultView)
- `Test/js/presenter/` - Business logic (AppPresenter, HighlightPresenter, PopupPresenter)
- `Test/js/tests/` - Unit tests
- `Test/css/styles.css` - Styles
- `scripts/` - Build glossary and download scripts

## Lessons Learned

- **Never loop mark.js over a large glossary.** Calling `markRegExp()` individually for each of 2000+ words causes separate DOM traversals per word, freezing the browser. Instead, combine all words into a single regex using alternation (`word1|word2|...`) and run mark.js once. One DOM pass vs 2000+.
I initially use the older highlighter logic for a small sample of words but I note it here since i realized that I need to refactored it over 2000+ words highlighted at the same time. 
