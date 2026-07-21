# MD Reader

[![Build](https://github.com/5uw1/md-reader/actions/workflows/build.yml/badge.svg)](https://github.com/5uw1/md-reader/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/5uw1/md-reader?label=latest%20release)](https://github.com/5uw1/md-reader/releases/latest)

A desktop Markdown reader and editor, built with Electron, React, and TypeScript. Drag in a single `.md` file or a whole folder and read it as a formatted document — with GitHub-flavored markdown, math, diagrams, an editor with live preview, and export to PDF.

## Download

[**⬇ Download the latest portable build**](https://github.com/5uw1/md-reader/releases/latest) — a single `.exe`, no installer, no admin rights needed. Just download and run it. It's unsigned, so Windows SmartScreen may warn on first launch ("More info" → "Run anyway").

## Features

- **Drag & drop** a `.md` file or a folder anywhere onto the window (or use File → Open File… / Open Folder…)
- **Folder navigation** — dropping a folder builds a sidebar file tree of every markdown file inside it, nested subfolders included
- **GitHub-flavored markdown** — tables, task lists, strikethrough, autolinks
- **Code syntax highlighting** in rendered code blocks
- **Math** via KaTeX (`$inline$` and `$$block$$`)
- **Mermaid diagrams** (` ```mermaid ` code blocks)
- **PlantUML diagrams** (` ```plantuml `/` ```puml ` code blocks), rendered via [Kroki.io](https://kroki.io)
- **Table of contents** — auto-generated from headings, toggleable, click an entry to jump to it
- **Edit mode** — Preview / Edit / Split view, with a CodeMirror-based editor (markdown syntax highlighting, plus per-language highlighting inside fenced code blocks) and a live-updating preview; scroll position stays in sync between the two panes in Split view
- **Save** back to disk (`Ctrl+S`), with an unsaved-changes indicator and a confirmation prompt before discarding edits
- **Export as PDF** (`Ctrl+P`) — exports the rendered document regardless of which view mode is on screen
- **Light / Dark / System theme**, toggleable from the View menu
- **Recently opened files and folders**, listed under File → Open Recent

## Getting Started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

This launches the app in development mode with hot reload.

## Usage

- **Open something**: drag a `.md` file or a folder onto the window, or use `Ctrl+O` (Open File…) / `Ctrl+Shift+O` (Open Folder…). Previously opened items are listed under File → Open Recent.
- **Navigate a folder**: click any file in the left sidebar to open it.
- **Switch views**: use the Preview / Edit / Split buttons in the toolbar (or View → View Mode) to read, edit the raw markdown, or see both side by side.
- **Edit & save**: type in Edit or Split mode; a dot next to the filename means there are unsaved changes. Save with the toolbar button or `Ctrl+S`.
- **Table of contents**: click "Contents" in the toolbar to show or hide the outline (only appears when the document has headings).
- **Export**: File → Export as PDF… or `Ctrl+P`.
- **Theme**: View → Theme → Match System / Light / Dark.

## Building

```bash
npm run typecheck   # type-check the whole project
npm run build        # production build
npm run build:win    # build + package a portable Windows .exe (electron-builder)
```

## Releasing

Pushing a tag matching `v*` builds the portable Windows `.exe` and publishes it to the [Releases page](https://github.com/5uw1/md-reader/releases) automatically:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Pre-release tags work the same way — anything with a `-` suffix (`v0.2.0-rc1`, `v0.2.0-pre0`, etc.) is published too, but marked as a **prerelease** on GitHub instead of a full release.

Every other push to `main` (i.e. without a tag), and every manual run from the Actions tab, builds a uniquely-numbered dev build instead — version `<current>-dev.<run number>` (e.g. `0.1.1-dev.42`), auto-incrementing on every run. These are **not** published to the Releases page; they're only available as a downloadable workflow artifact from that run, for testing.

## Tech Stack

Electron · React · TypeScript · electron-vite · react-markdown (remark-gfm, remark-math, rehype-katex, rehype-highlight, rehype-slug) · Mermaid · Kroki · CodeMirror 6
