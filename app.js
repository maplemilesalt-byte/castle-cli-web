(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STARTER_LUA = 'function onCreate()\n  print("ready")\nend\n\nfunction onDraw()\n  castle.draw.setColor(0.25, 0.9, 0.62, 1)\n  castle.draw.circle("fill", 0, 0, 0.28)\nend\n';
  const state = { dir: null, deck: null, selectedId: null, dirty: false, script: STARTER_LUA, toastTimer: null };
  const supportsFolderAccess = typeof window.showDirectoryPicker === "function";

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function safeId() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
    return Array.from(bytes, b => alphabet[b & 63]).join("");
  }
  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-deck";
  }
  function setStatus(text) { $("project-status").textContent = text; }
  function setDirty(value) {
    state.dirty = value;
    $("save-state").textContent = value ? "Unsaved changes" : "Saved";
    $("save-state").classList.toggle("dirty", value);
  }
  function selectedCard() {
    return state.deck?.cards?.find(card => card.cardId === state.selectedId) || null;
  }
  async function readJson(dir, name) {
    const file = await (await dir.getFileHandle(name)).getFile();
    return JSON.parse(await file.text());
  }
  async function writeText(dir, name, content) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }
  async function ensureDir(parent, name) {
    return parent.getDirectoryHandle(name, { create: true });
  }
  async function writeJson(dir, name, value) {
    await writeText(dir, name, JSON.stringify(value, null, 2) + "\n");
  }
  async function cardDir(card, create = false) {
    const cardsDir = await state.dir.getDirectoryHandle("cards");
    return cardsDir.getDirectoryHandle(card.cardId, { create });
  }
  async function loadCardScript(card) {
    try {
      const folder = await cardDir(card);
      const scripts = await folder.getDirectoryHandle("scripts");
      const file = await (await scripts.getFileHandle("main.lua")).getFile();
      return await file.text();
    } catch { return STARTER_LUA; }
  }
  async function openProject(dir) {
    const deck = await readJson(dir, "deck.json");
    if (!deck || typeof deck !== "object") throw new Error("deck.json is not a valid project file.");
    if (!Array.isArray(deck.cards)) deck.cards = deck.initialCard ? [deck.initialCard] : [];
    state.dir = dir; state.deck = deck; state.selectedId = deck.initialCard?.cardId || deck.cards[0]?.cardId || null;
    $("save-card").disabled = false; $("remove-card").disabled = false;
    $("workspace").classList.remove("hidden");
    $("project-name").textContent = deck.title || dir.name;
    $("project-status").textContent = dir.name;
    $("project-name").title = dir.name;
    renderCards();
    if (state.selectedId) await selectCard(state.selectedId);
    else showEmpty();
    setDirty(false);
    $("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderCards() {
    const nav = $("card-list"); nav.replaceChildren();
    $("project-name").textContent = state.deck?.title || state.dir?.name || "Untitled";
    (state.deck?.cards || []).forEach((card, index) => {
      const btn = document.createElement("button");
      btn.className = "card-item" + (card.cardId === state.selectedId ? " active" : "");
      btn.textContent = card.title || "Card " + (index + 1);
      btn.title = btn.textContent;
      btn.addEventListener("click", async () => {
        if (state.dirty && !confirm("Discard unsaved edits and switch cards?")) return;
        await selectCard(card.cardId);
      });
      nav.append(btn);
    });
  }
  function showEmpty() {
    $("empty-state").classList.remove("hidden");
    $("card-editor").classList.add("hidden");
    $("editor-title").textContent = "Choose a card";
  }
  async function selectCard(id) {
    const card = state.deck.cards.find(item => item.cardId === id);
    if (!card) return;
    state.selectedId = id;
    state.script = await loadCardScript(card);
    $("card-title").value = card.title || "";
    $("card-id").value = card.cardId || "";
    $("lua-editor").value = state.script;
    $("editor-title").textContent = card.title || "Untitled card";
    $("empty-state").classList.add("hidden");
    $("card-editor").classList.remove("hidden");
    renderCards(); setDirty(false);
  }
  async function saveCard() {
    if (!state.dir || !state.deck) return;
    const card = selectedCard();
    if (!card) return;
    const title = $("card-title").value.trim() || "Untitled card";
    card.title = title;
    if (state.deck.initialCard?.cardId === card.cardId) state.deck.initialCard.title = title;
    state.script = $("lua-editor").value;
    const folder = await cardDir(card, true);
    const scripts = await ensureDir(folder, "scripts");
    await writeText(scripts, "main.lua", state.script);
    await writeJson(state.dir, "deck.json", state.deck);
    const cardJson = { ...card, sceneProperties: { backgroundColor: { r: 0.03529, g: 0.06275, b: 0.10196, a: 1 }, coordinateSystemVersion: 2, clock: { tempo: 120, beatsPerBar: 4, stepsPerBeat: 4 } }, actorBlueprintInherit: true, linkTargetDeckIds: [] };
    await writeJson(folder, "card.json", cardJson);
    $("editor-title").textContent = title;
    renderCards(); setDirty(false); toast("Card saved to project folder.");
  }
  async function createProject(title) {
    if (!supportsFolderAccess) throw new Error("Your browser does not support folder access. Open this page in a recent Chromium browser over HTTPS or localhost.");
    const dir = await window.showDirectoryPicker({ mode: "readwrite" });
    const existing = [];
    for await (const entry of dir.values()) existing.push(entry.name);
    if (existing.length && !confirm("This folder is not empty. Create the project files here anyway? Existing files with matching names may be replaced.")) return;
    const id = safeId();
    const card = { cardId: id, title: title, backgroundColor: "#09101a" };
    const deck = { title, visibility: "unlisted", variables: [], initialCard: card, cards: [card] };
    const cardsDir = await ensureDir(dir, "cards");
    const folder = await ensureDir(cardsDir, id);
    const scene = await ensureDir(folder, "scene");
    await ensureDir(scene, "blueprints");
    const scripts = await ensureDir(folder, "scripts");
    await writeJson(dir, "deck.json", deck);
    await writeJson(folder, "card.json", { ...card, sceneProperties: { backgroundColor: { r: 0.03529, g: 0.06275, b: 0.10196, a: 1 }, coordinateSystemVersion: 2, clock: { tempo: 120, beatsPerBar: 4, stepsPerBeat: 4 } }, actorBlueprintInherit: true, linkTargetDeckIds: [] });
    await writeText(scene, "actors.yaml", "{}\n");
    await writeText(scene, "variables.yaml", "[]\n");
    await writeText(scripts, "main.lua", STARTER_LUA);
    await openProject(dir);
    toast("Project created. You can now edit its card script.");
  }
  async function addCard() {
    if (!state.dir) return;
    const title = prompt("New card title:", "Card " + ((state.deck.cards?.length || 0) + 1));
    if (title === null) return;
    const card = { cardId: safeId(), title: title.trim() || "Untitled card", backgroundColor: "#09101a" };
    state.deck.cards = state.deck.cards || [];
    state.deck.cards.push(card);
    const cardsDir = await ensureDir(state.dir, "cards");
    const folder = await ensureDir(cardsDir, card.cardId);
    const scene = await ensureDir(folder, "scene");
    await ensureDir(scene, "blueprints");
    const scripts = await ensureDir(folder, "scripts");
    await writeJson(folder, "card.json", { ...card, sceneProperties: { backgroundColor: { r: 0.03529, g: 0.06275, b: 0.10196, a: 1 }, coordinateSystemVersion: 2, clock: { tempo: 120, beatsPerBar: 4, stepsPerBeat: 4 } }, actorBlueprintInherit: true, linkTargetDeckIds: [] });
    await writeText(scene, "actors.yaml", "{}\n");
    await writeText(scene, "variables.yaml", "[]\n");
    await writeText(scripts, "main.lua", STARTER_LUA);
    await writeJson(state.dir, "deck.json", state.deck);
    await selectCard(card.cardId); toast("Card added.");
  }
  async function removeCard() {
    const card = selectedCard();
    if (!card || state.deck.cards.length <= 1) { toast("A deck must keep at least one card."); return; }
    if (!confirm('Remove "' + (card.title || card.cardId) + '"? This deletes its local card folder.')) return;
    state.deck.cards = state.deck.cards.filter(item => item.cardId !== card.cardId);
    if (state.deck.initialCard?.cardId === card.cardId) state.deck.initialCard = state.deck.cards[0];
    try {
      const cardsDir = await state.dir.getDirectoryHandle("cards");
      await cardsDir.removeEntry(card.cardId, { recursive: true });
    } catch (err) { console.warn("Could not delete card folder", err); }
    await writeJson(state.dir, "deck.json", state.deck);
    await selectCard(state.deck.cards[0].cardId);
    toast("Card removed.");
  }
  function download(name, content, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function closeProject() {
    if (state.dirty && !confirm("Close without saving your current editor changes?")) return;
    state.dir = null; state.deck = null; state.selectedId = null; state.dirty = false;
    $("workspace").classList.add("hidden"); setStatus("No project open"); showEmpty();
  }
  $("open-folder").addEventListener("click", async () => {
    try {
      if (!supportsFolderAccess) throw new Error("Folder access isn't supported by this browser. Try a recent Chrome/Edge browser over HTTPS or localhost.");
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      await openProject(dir);
      toast("Project opened.");
    } catch (e) { if (e.name !== "AbortError") toast(e.message || String(e)); }
  });
  $("new-project").addEventListener("click", () => {
    $("open-preview").addEventListener("click", () => {
    const raw = $("serve-url").value.trim();
    let previewUrl;
    try {
      previewUrl = new URL(raw);
    } catch {
      toast("Enter the full URL printed by castle serve, including http:// or https://.");
      return;
    }
    if (!["http:", "https:"].includes(previewUrl.protocol)) {
      toast("The preview URL must use HTTP or HTTPS.");
      return;
    }
    const opened = window.open(previewUrl.href, "_blank", "noopener,noreferrer");
    if (opened) {
      toast("Opening Castle serve preview in a new tab.");
    } else {
      toast("The browser blocked the new tab. Allow pop-ups and try again.");
    }
  });
  $("serve-url").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("open-preview").click();
  });

  if (!supportsFolderAccess) { toast("Folder access needs a recent Chromium browser over HTTPS or localhost."); return; }
    $("create-dialog").showModal(); $("new-title").focus();
  });
  $("cancel-create").addEventListener("click", () => $("create-dialog").close());
  $("create-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const title = $("new-title").value.trim() || "My Castle Deck"; $("create-dialog").close();
    try { await createProject(title); } catch (err) { if (err.name !== "AbortError") toast(err.message || String(err)); }
  });
  $("add-card").addEventListener("click", () => addCard().catch(err => toast(err.message || String(err))));
  $("save-card").addEventListener("click", () => saveCard().catch(err => toast("Save failed: " + (err.message || String(err)))));
  $("remove-card").addEventListener("click", () => removeCard().catch(err => toast(err.message || String(err))));
  $("card-title").addEventListener("input", () => { $("editor-title").textContent = $("card-title").value || "Untitled card"; setDirty(true); });
  $("lua-editor").addEventListener("input", () => setDirty(true));
  $("download-script").addEventListener("click", () => download(slugify($("card-title").value || "main") + ".lua", $("lua-editor").value));
  $("download-project").addEventListener("click", () => {
    if (!state.deck) return;
    download("deck.json", JSON.stringify(state.deck, null, 2) + "\n", "application/json;charset=utf-8");
  });
  $("refresh-project").addEventListener("click", async () => {
    if (!state.dir) return;
    try { await openProject(state.dir); toast("Project refreshed from disk."); } catch (e) { toast(e.message || String(e)); }
  });
  $("close-project").addEventListener("click", closeProject);
  $("import-deck").addEventListener("change", async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const deck = JSON.parse(await file.text());
      if (!Array.isArray(deck.cards)) deck.cards = deck.initialCard ? [deck.initialCard] : [];
      state.dir = null; state.deck = deck; state.selectedId = deck.initialCard?.cardId || deck.cards[0]?.cardId || null;
      $("workspace").classList.remove("hidden"); $("project-name").textContent = deck.title || file.name;
      setStatus("Imported deck.json (read-only until a folder is opened)");
      renderCards();
      const card = selectedCard();
      if (card) {
        $("empty-state").classList.add("hidden"); $("card-editor").classList.remove("hidden");
        $("editor-title").textContent = card.title || "Untitled card"; $("card-title").value = card.title || "";
        $("card-id").value = card.cardId || ""; $("lua-editor").value = STARTER_LUA;
        $("save-card").disabled = true; $("remove-card").disabled = true;
        toast("Metadata imported. Open the project folder to edit and save scripts.");
      } else showEmpty();
    } catch (err) { toast("Could not import deck.json: " + (err.message || String(err))); }
    e.target.value = "";
  });
  if (!supportsFolderAccess) {
    $("open-folder").title = "Requires File System Access API";
    $("new-project").title = "Requires File System Access API";
  }
})();