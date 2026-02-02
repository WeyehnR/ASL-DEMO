# Project Rules

## Developer Context
- The developer is a recent CS graduate with a bachelor's degree
- No NLP coursework — explain NLP concepts (stemming, tokenization, context-aware parsing, etc.) in plain language when they come up
- Prefer learning-by-doing: provide boilerplate with TODOs over fully generated implementations
- Explain the "why" behind architectural decisions, not just the "what"

## Architecture Principles
- Favor clarity over brevity — each file should have one clear responsibility, even if the code is small
- New contributors should be able to understand what a file does from its name and location alone
- When a module has two distinct responsibilities, split them into separate files (e.g. glossary lookup vs word resolution)
