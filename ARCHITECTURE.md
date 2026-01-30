# ASL Demo - Architecture & Flow Diagrams

## Architecture Overview (MVP Pattern)

```mermaid
graph TB
    subgraph Models["Model Layer"]
        AppState["AppState<br/>currentWord, entry, loading,<br/>hasVideo, matchCount"]
        VideoData["VideoData<br/>glossary lookup, stemming,<br/>word matching"]
    end

    subgraph Presenters["Presenter Layer"]
        AppP["AppPresenter<br/>Main coordinator"]
        HighP["HighlightPresenter<br/>Highlighting + navigation"]
        PopupP["PopupPresenter<br/>Popup + video loading"]
    end

    subgraph Views["View Layer"]
        HView["HighlightView<br/>mark.js wrapper"]
        PView["PopupView<br/>Video popup DOM"]
        RView["ResultView<br/>Match count + nav"]
        WView["WordChipsView<br/>Sidebar word selector"]
    end

    subgraph External["External"]
        MarkJS["mark.js"]
        Glossary["asl-lex-glossary.json"]
        Videos["ASL Video Files (MP4)"]
    end

    AppP --> HighP
    AppP --> PopupP
    AppP --> WView
    HighP --> HView
    HighP --> RView
    HighP --> PopupP
    PopupP --> PView
    HighP --> AppState
    PopupP --> AppState
    PopupP --> VideoData
    HighP --> VideoData
    HView --> MarkJS
    VideoData --> Glossary
    PView --> Videos
```

## Application Startup Flow

```mermaid
sequenceDiagram
    participant Browser
    participant HTML as mvp_test.html
    participant VP as AppPresenter
    participant VD as VideoData
    participant HP as HighlightPresenter
    participant HV as HighlightView
    participant PP as PopupPresenter
    participant WC as WordChipsView

    Browser->>HTML: Load page
    HTML->>HTML: Load mark.js
    HTML->>VP: Load app-presenter.js (ES module)
    VP->>VP: DOMContentLoaded

    VP->>VD: await init()
    VD->>VD: Fetch asl-lex-glossary.json
    VD-->>VP: ~2000 words loaded

    VP->>PP: init()
    PP->>PP: Create popup DOM + bind events

    VP->>VP: loadArticle()
    VP->>VP: Fetch asl_article.html → inject into DOM

    VP->>HP: highlightAllGlossaryWords()
    HP->>VD: getAllWords() → ~2000 words
    HP->>HV: highlightAll(words)
    HV->>HV: Build single regex: \b(word1|word2|...)\b
    HV->>HV: mark.js ONE DOM pass
    HV-->>HP: Each match → attach hover/click handlers

    VP->>VP: populateWordChipsFromDOM()
    VP->>WC: build(uniqueWords, onChipClick)
    WC->>WC: Group alphabetically, render chips
```

## Hover Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant Mark as <mark> element
    participant PP as PopupPresenter
    participant VD as VideoData
    participant AS as AppState
    participant PV as PopupView

    User->>Mark: mouseenter "conflicting"
    Mark->>PP: showPopup(element, "conflicting")
    PP->>AS: setCurrentWord("conflicting")
    PP->>AS: setLoading(true)
    PP->>PV: render(state) → show loading spinner
    PP->>PV: position(element) → place near word
    PP->>PV: show()

    PP->>VD: findBaseWord("conflicting")
    VD-->>PP: "conflict"
    PP->>VD: getRandomEntryForWord("conflict")
    VD-->>PP: {entryId, meanings, lexicalClass, videoFile}

    PP->>AS: setCurrentEntry(entry)
    PP->>PV: loadVideo(videoPath)
    PV->>PV: Set <video> src
    PV-->>PP: canplay event
    PP->>AS: setHasVideo(true)
    PP->>PV: render(state) → show video + meanings

    User->>Mark: mouseleave
    Mark->>PP: hidePopup() (200ms delay)
    PP->>PV: hide()
```

## Click to Pin / Word Chip Flow

```mermaid
sequenceDiagram
    participant User
    participant WC as WordChipsView
    participant HP as HighlightPresenter
    participant HV as HighlightView
    participant RV as ResultView
    participant PP as PopupPresenter
    participant PV as PopupView

    alt Click Word Chip
        User->>WC: Click "conflict" chip
        WC->>HP: highlightWord("conflict")
        HP->>HV: highlight("conflict")
        HV->>HV: Regex: \bconflict(s|ed|ing|tion|...)?\b
        HV->>HV: mark.js DOM pass
        HV-->>HP: matches[] populated
        HP->>HP: goToMatch(0)
        HP->>HP: Scroll to first match
        HP->>RV: showCount(N, presenter)
        RV->>RV: Display "◀ 1 of N ▶"
    end

    alt Click Highlighted Word (Pin Popup)
        User->>HP: Click on <mark> element
        HP->>PP: expandPopup(element, word)
        PP->>PV: expand()
        PV->>PV: Fixed center, 480px, close button visible
        Note over PV: Popup stays open (pinned)
    end

    alt Click Same Pinned Word (Toggle)
        User->>HP: Click same <mark> element
        HP->>PP: expandPopup(element, sameWord)
        PP->>PV: collapse()
        PV->>PV: Hide popup, unpin
    end
```

## Match Navigation

```mermaid
graph LR
    A["◀ Prev"] -->|prevMatch| B["goToMatch(i-1)"]
    C["▶ Next"] -->|nextMatch| B2["goToMatch(i+1)"]

    B --> D["Remove 'current-match' from old"]
    B2 --> D
    D --> E["Add 'current-match' to new"]
    E --> F["Smooth scroll to match"]
    F --> G["Update ResultView: '2 of 5'"]
    G -->|wraps around| B
```

## Data Pipeline (Build Phase)

```mermaid
flowchart LR
    A["ASL-LEX CSV<br/>signdata-11-5-20.csv"] -->|build-asl-lex-glossary.js| B["asl-lex-glossary.json<br/>~2000 words"]
    A -->|download-asl-lex-videos.js| C["MP4 video files<br/>via yt-dlp"]
    B --> D["VideoData.init()"]
    C --> E["PopupView.loadVideo()"]
    D --> F["Runtime App"]
    E --> F
```

## Key Design Decisions

- **Single DOM pass**: All ~2000 glossary words are combined into one regex and matched in a single `mark.js` traversal, avoiding per-word loops that would freeze the page.
- **Smart stemming**: Suffix stripping (ing, ed, tion, ly, etc.) with doubled-consonant handling maps inflected forms back to base glossary words.
- **Short word protection**: Words 1-3 characters long match exactly only, preventing false positives like "on" matching "only".
- **Pinned popup state**: Click pins the popup open so users can read definitions while scrolling; hover alone is transient with a 200ms hide delay.
