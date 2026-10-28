# Castle CLI Web

A browser-based companion/partial port of [castle-xyz/castle-cli](https://github.com/castle-xyz/castle-cli), built with plain HTML, CSS, and JavaScript. No Node.js or build step is required.

## Run

Open `index.html` through a static web server, or deploy this repository with GitHub Pages. For direct local folder access, use a recent Chromium-based browser and a secure context (HTTPS or localhost).

## Current features

- Create a basic local Castle deck folder with `deck.json`, a starter card, scene YAML files, and `scripts/main.lua`.
- Open an existing project folder and edit card titles and Lua scripts.
- Add and remove cards.
- Download the current `deck.json` or an individual Lua script.
- Import a `deck.json` for metadata inspection.
- Open an already-running `castle serve` preview in a separate browser tab by pasting its printed URL.

## Important differences from the Node CLI

This is not a one-to-one replacement for the original CLI. A web page cannot run Node.js APIs, spawn the local Castle player server, watch files in the background, or access arbitrary local files without browser permission. The web app can open the URL from an already-running `castle serve` process in a separate tab, but it does not start the Node.js server itself. The live engine preview still depends on the original CLI and its player/WASM bundle; screenshot/log IPC, full scene editing/materialization, Castle login, and remote `get-deck`/`save-deck` flows are not implemented here yet.

The project creator writes a lightweight starter structure; it does not bundle Castle's player/WASM engine or the original CLI's generated blueprint assets. Use the original CLI when you need a fully initialized, engine-ready deck or live preview.

## License

This web port is an independent companion to the original project. See the upstream repository for its license and terms.
