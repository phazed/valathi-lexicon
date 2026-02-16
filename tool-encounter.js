// tool-encounter.js
// Encounter / Initiative tool for the Vrahune Toolbox.
// Uses window.registerTool (defined in app.js) to plug into the Tools sidebar.

(function () {
  const STORAGE_ENCOUNTER_KEY = "vrahuneEncounterV2";
  const STORAGE_PARTY_KEY = "vrahunePartyV1";

  if (typeof window === "undefined") return;
  if (typeof window.registerTool !== "function") {
    console.warn("[EncounterTool] registerTool not found; tool not registered.");
    return;
  }

  function injectStyles() {
    if (document.getElementById("encounterToolStyles")) return;
    const style = document.createElement("style");
    style.id = "encounterToolStyles";
    style.textContent = `
      /* === Encounter / Initiative tool styles (scoped by layout classes) === */

      .enc-tool {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .enc-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }

      .enc-title-block {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .enc-title {
        font-size: 0.9rem;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent-strong, #f5f5f5);
      }

      .enc-subtitle {
        font-size: 0.78rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-tag-pill {
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border-subtle, #232a33);
        background: #05090f;
        color: var(--accent-soft, #808890);
        white-space: nowrap;
      }

      .enc-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.9fr) minmax(0, 1.3fr);
        gap: 8px;
      }

      @media (max-width: 900px) {
        .enc-layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .enc-box {
        border-radius: 10px;
        border: 1px solid #262c37;
        background: #05070c;
        padding: 8px 9px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .enc-box-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
      }

      .enc-box-title {
        font-size: 0.82rem;
        color: var(--accent-soft, #808890);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .enc-box-title strong {
        font-weight: 500;
        color: var(--accent-strong, #f5f5f5);
      }

      .enc-hint {
        font-size: 0.72rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-controls-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .enc-controls-group {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }

      .enc-round-input {
        width: 60px;
        text-align: center;
      }

      .enc-current-label {
        font-size: 0.78rem;
        color: var(--text-muted, #9ba1aa);
      }

      /* === Card list === */

      .enc-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 260px;
        overflow-y: auto;
        margin-top: 2px;
      }

      .enc-card {
        position: relative;
        border-radius: 12px;
        border: 1px solid #2d3440;
        background: linear-gradient(135deg, #10141f, #070a10);
        padding: 6px 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: move;
      }

      .enc-card.pc-side {
        border-left: 3px solid #5fa8ff;
      }

      .enc-card.enemy-side {
        border-left: 3px solid #ff6b6b;
      }

      .enc-card.other-side {
        border-left: 3px solid #9ba1aa;
      }

      .enc-card.active-turn {
        border-color: #c0c0c0;
        box-shadow: 0 0 0 1px rgba(192,192,192,0.3);
        background: radial-gradient(circle at top left, #243046, #070a10);
      }

      .enc-card.downed {
        opacity: 0.55;
        border-style: dashed;
      }

      .enc-portrait {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 999px;
        border: 1px solid #3a414d;
        background: #05070c center/cover no-repeat;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        color: var(--accent-strong, #f5f5f5);
        overflow: hidden;
      }

      .enc-card-main {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .enc-name-block {
        flex: 1.1;
        min-width: 0;
      }

      .enc-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        justify-content: flex-start;
      }

      .enc-name {
        font-size: 0.85rem;
        font-weight: 500;
        max-width: 130px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .enc-tag {
        font-size: 0.7rem;
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid #3a414d;
        color: var(--accent-soft, #808890);
      }

      .enc-name-sub {
        font-size: 0.72rem;
        color: var(--text-muted, #9ba1aa);
        margin-top: 2px;
      }

      .enc-hp-block {
        flex: 0.9;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }

      .enc-hp-label {
        font-size: 0.78rem;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .enc-hp-inline-input {
        width: 34px;
        font-size: 0.75rem;
        text-align: center;
        padding: 2px 4px;
      }

      .enc-hp-delta-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .enc-hp-delta {
        width: 36px;
        font-size: 0.75rem;
        text-align: center;
        padding: 2px 4px;
      }

      .enc-meta {
        flex: 0.7;
        font-size: 0.75rem;
        text-align: right;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .enc-remove-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        border: none;
        background: transparent;
        color: var(--text-muted, #9ba1aa);
        font-size: 0.8rem;
        cursor: pointer;
      }

      .enc-remove-btn:hover {
        color: var(--danger, #ff5c5c);
      }

      /* === Form & party === */

      .enc-form {
        border-radius: 10px;
        border: 1px solid #262c37;
        background: #05070c;
        padding: 6px 8px;
        margin-top: 4px;
        display: none;
        gap: 6px;
        flex-direction: column;
      }

      .enc-form.visible {
        display: flex;
      }

      .enc-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 4px;
      }

      .enc-party-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 150px;
        overflow-y: auto;
      }

      .enc-party-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        padding: 3px 4px;
        border-radius: 8px;
        background: #05070c;
        border: 1px solid #262c37;
        font-size: 0.78rem;
      }

      .enc-party-name {
        font-weight: 500;
      }

      .enc-party-meta {
        font-size: 0.72rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-divider {
        border: none;
        border-top: 1px solid #1a2028;
        margin: 6px 0;
      }
    `;
    document.head.appendChild(style);
  }

  function uid() {
    return "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function loadEncounter() {
    try {
      const raw = window.localStorage.getItem(STORAGE_ENCOUNTER_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      data.combatants = Array.isArray(data.combatants) ? data.combatants : [];
      data.round = Number.isFinite(data.round) && data.round > 0 ? data.round : 1;
      data.activeIndex = Number.isFinite(data.activeIndex) ? data.activeIndex : 0;
      return data;
    } catch {
      return null;
    }
  }

  function saveEncounter(state) {
    try {
      window.localStorage.setItem(STORAGE_ENCOUNTER_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  function loadParty() {
    try {
      const raw = window.localStorage.getItem(STORAGE_PARTY_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveParty(party) {
    try {
      window.localStorage.setItem(STORAGE_PARTY_KEY, JSON.stringify(party));
    } catch {
      // ignore
    }
  }

  function sideLabel(side) {
    if (side === "pc") return "PC";
    if (side === "enemy") return "Enemy";
    return "Other";
  }

  function sideClass(side) {
    if (side === "pc") return "pc-side";
    if (side === "enemy") return "enemy-side";
    return "other-side";
  }

  window.registerTool({
    id: "encounterInitiative",
    name: "Encounter / Initiative",
    description: "Initiative tracker & simple encounter builder.",
    render: function ({ labelEl, panelEl }) {
      injectStyles();
      if (labelEl) {
        labelEl.textContent = "Encounter / Initiative";
      }
      if (!panelEl) return;

      // === Base structure ===
      panelEl.innerHTML = `
        <div class="enc-tool">
          <div class="enc-header-row">
            <div class="enc-title-block">
              <div class="enc-title">Encounter / Initiative</div>
              <div class="enc-subtitle">
                Track initiative, HP and rounds with draggable cards. Saves to your browser between sessions.
              </div>
            </div>
            <div class="enc-tag-pill">Tool · Local-only</div>
          </div>

          <div class="enc-layout">
            <!-- Left: active encounter -->
            <div class="enc-box">
              <div class="enc-box-header">
                <div class="enc-box-title">
                  <strong>Active encounter</strong>
                </div>
                <div class="enc-hint">Round &amp; turn tracking for the current fight.</div>
              </div>

              <div class="enc-controls-row">
                <div class="enc-controls-group">
                  <span class="enc-current-label">Round</span>
                  <button id="encRoundDown" class="btn-secondary btn-small" type="button">–</button>
                  <input id="encRoundInput" class="enc-round-input" type="number" min="1" value="1">
                  <button id="encRoundUp" class="btn-secondary btn-small" type="button">+</button>
                </div>

                <div class="enc-controls-group">
                  <span class="enc-current-label">Turn</span>
                  <span id="encCurrentTurnLabel" class="enc-current-label">–</span>
                  <button id="encNextTurn" class="btn-primary btn-small" type="button">Next turn</button>
                </div>
              </div>

              <div class="enc-controls-row" style="margin-top:4px;">
                <div class="enc-controls-group">
                  <button id="encAddFormToggle" class="btn-primary btn-small" type="button">
                    Add / Edit combatant
                  </button>
                  <button id="encSortInit" class="btn-secondary btn-small" type="button">
                    Sort by initiative
                  </button>
                  <button id="encClearEncounter" class="btn-secondary btn-small danger" type="button">
                    Clear encounter
                  </button>
                </div>
              </div>

              <div id="encForm" class="enc-form">
                <div class="row">
                  <div class="col">
                    <label for="encNameInput">Name</label>
                    <input id="encNameInput" type="text" placeholder="Character / monster name">
                  </div>
                  <div class="col">
                    <label for="encSideSelect">Side</label>
                    <select id="encSideSelect">
                      <option value="pc">PC / Ally</option>
                      <option value="enemy">Enemy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="col">
                    <label for="encInitInput">Initiative</label>
                    <input id="encInitInput" type="number" placeholder="e.g. 15">
                  </div>
                </div>

                <div class="row">
                  <div class="col">
                    <label for="encHPMaxInput">Max HP</label>
                    <input id="encHPMaxInput" type="number" min="0" placeholder="35">
                  </div>
                  <div class="col">
                    <label for="encHPCurrentInput">Current HP</label>
                    <input id="encHPCurrentInput" type="number" min="0" placeholder="35">
                  </div>
                  <div class="col">
                    <label for="encACInput">AC</label>
                    <input id="encACInput" type="number" min="0" placeholder="16">
                  </div>
                  <div class="col">
                    <label for="encSpeedInput">Speed</label>
                    <input id="encSpeedInput" type="number" min="0" placeholder="30">
                  </div>
                </div>

                <div class="row">
                  <div class="col">
                    <label for="encNotesInput">Notes</label>
                    <input id="encNotesInput" type="text" placeholder="Short notes, conditions, etc.">
                  </div>
                </div>

                <div class="enc-form-actions">
                  <button id="encFormCancel" class="btn-secondary btn-small" type="button">Cancel</button>
                  <button id="encFormSave" class="btn-primary btn-small" type="button">Save combatant</button>
                </div>
              </div>

              <div id="encList" class="enc-list"></div>
            </div>

            <!-- Right: party & library -->
            <div class="enc-box">
              <div class="enc-box-header">
                <div class="enc-box-title">
                  <strong>Saved party</strong>
                </div>
                <div class="enc-hint">Store your core party for quick re-use.</div>
              </div>

              <div class="enc-controls-row">
                <div class="enc-controls-group">
                  <button id="encAddFullParty" class="btn-primary btn-small" type="button">
                    Add full party to encounter
                  </button>
                  <button id="encSaveCurrentAsParty" class="btn-secondary btn-small" type="button">
                    Save current encounter as party
                  </button>
                </div>
              </div>

              <div id="encPartyList" class="enc-party-list"></div>

              <hr class="enc-divider">

              <div class="enc-box-header">
                <div class="enc-box-title">
                  <strong>Encounter library</strong>
                </div>
                <div class="enc-hint">Future feature – prebuild fights here.</div>
              </div>
              <div class="enc-hint">
                For now, use “Download database” in the header to export all your generators & this encounter state.
              </div>
            </div>
          </div>
        </div>
      `;

      // ====== State ======
      let encounter = loadEncounter() || { round: 1, activeIndex: 0, combatants: [] };
      let party = loadParty();
      let editingId = null;
      let dragSourceId = null;

      // ====== DOM refs ======
      const roundInput = panelEl.querySelector("#encRoundInput");
      const roundDownBtn = panelEl.querySelector("#encRoundDown");
      const roundUpBtn = panelEl.querySelector("#encRoundUp");
      const nextTurnBtn = panelEl.querySelector("#encNextTurn");
      const currentTurnLabel = panelEl.querySelector("#encCurrentTurnLabel");

      const formBox = panelEl.querySelector("#encForm");
      const formToggleBtn = panelEl.querySelector("#encAddFormToggle");
      const formSaveBtn = panelEl.querySelector("#encFormSave");
      const formCancelBtn = panelEl.querySelector("#encFormCancel");
      const sortInitBtn = panelEl.querySelector("#encSortInit");
      const clearEncounterBtn = panelEl.querySelector("#encClearEncounter");
      const listEl = panelEl.querySelector("#encList");

      const nameInput = panelEl.querySelector("#encNameInput");
      const sideSelect = panelEl.querySelector("#encSideSelect");
      const initInput = panelEl.querySelector("#encInitInput");
      const hpMaxInput = panelEl.querySelector("#encHPMaxInput");
      const hpCurrentInput = panelEl.querySelector("#encHPCurrentInput");
      const acInput = panelEl.querySelector("#encACInput");
      const speedInput = panelEl.querySelector("#encSpeedInput");
      const notesInput = panelEl.querySelector("#encNotesInput");

      const addFullPartyBtn = panelEl.querySelector("#encAddFullParty");
      const saveCurrentAsPartyBtn = panelEl.querySelector("#encSaveCurrentAsParty");
      const partyListEl = panelEl.querySelector("#encPartyList");

      function refreshRoundControls() {
        if (roundInput) roundInput.value = encounter.round || 1;
        const active = encounter.combatants[encounter.activeIndex] || null;
        if (currentTurnLabel) {
          currentTurnLabel.textContent = active ? active.name || "(unnamed)" : "–";
        }
      }

      function renderParty() {
        partyListEl.innerHTML = "";
        if (!party.length) {
          partyListEl.innerHTML = '<div class="enc-hint">No saved party yet. Click “Save current encounter as party”.</div>';
          return;
        }
        const frag = document.createDocumentFragment();
        party.forEach((p) => {
          const row = document.createElement("div");
          row.className = "enc-party-row";
          row.innerHTML = `
            <div>
              <div class="enc-party-name">${p.name || "(unnamed)"}</div>
              <div class="enc-party-meta">
                ${sideLabel(p.side)} · Init ${p.initiative ?? "–"} · HP ${p.currentHp ?? p.maxHp ?? 0}/${p.maxHp ?? 0}
              </div>
            </div>
            <button class="btn-secondary btn-small enc-party-add-one" type="button">Add</button>
          `;
          row.querySelector(".enc-party-add-one").addEventListener("click", () => {
            const clone = { ...p, id: uid() };
            encounter.combatants.push(clone);
            saveEncounter(encounter);
            renderEncounterList();
          });
          frag.appendChild(row);
        });
        partyListEl.appendChild(frag);
      }

      function buildCardHTML(c, index) {
        const activeClass = index === encounter.activeIndex ? "active-turn" : "";
        const sideCls = sideClass(c.side);
        const downedClass = (c.currentHp || 0) <= 0 ? "downed" : "";
        const initials = (c.name || "?").trim().charAt(0).toUpperCase();

        return `
          <div class="enc-card ${sideCls} ${activeClass} ${downedClass}" draggable="true" data-id="${c.id}">
            <div class="enc-portrait">${initials}</div>
            <div class="enc-card-main">
              <div class="enc-name-block">
                <div class="enc-name-row">
                  <span class="enc-name">${c.name || "(unnamed)"}</span>
                  <span class="enc-tag">${sideLabel(c.side)}</span>
                </div>
                <div class="enc-name-sub">
                  Init ${c.initiative ?? "–"}${c.notes ? " · " + c.notes : ""}
                </div>
              </div>

              <div class="enc-hp-block">
                <div class="enc-hp-label">
                  HP:
                  <input class="enc-hp-inline-input enc-hp-current" type="number" min="0" value="${c.currentHp ?? c.maxHp ?? 0}">
                  /
                  <input class="enc-hp-inline-input enc-hp-max" type="number" min="0" value="${c.maxHp ?? 0}">
                </div>
                <div class="enc-hp-delta-row">
                  <input class="enc-hp-delta" type="number" placeholder="">
                  <button class="btn-small enc-btn-dmg" type="button">Dmg</button>
                  <button class="btn-secondary btn-small enc-btn-heal" type="button">Heal</button>
                </div>
              </div>

              <div class="enc-meta">
                <div>AC ${c.ac ?? "–"}</div>
                <div>Speed ${c.speed ?? "–"}</div>
                <div>#${index + 1}</div>
              </div>
            </div>
            <button class="enc-remove-btn" type="button" title="Remove">✕</button>
          </div>
        `;
      }

      function findIndexById(id) {
        return encounter.combatants.findIndex((c) => c.id === id);
      }

      function attachCardEvents(cardEl, c, index) {
        const id = c.id;

        // Drag
        cardEl.addEventListener("dragstart", (ev) => {
          dragSourceId = id;
          ev.dataTransfer.effectAllowed = "move";
        });
        cardEl.addEventListener("dragover", (ev) => {
          ev.preventDefault();
        });
        cardEl.addEventListener("drop", (ev) => {
          ev.preventDefault();
          if (!dragSourceId) return;
          const fromIdx = findIndexById(dragSourceId);
          const toIdx = findIndexById(id);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
          const [moved] = encounter.combatants.splice(fromIdx, 1);
          encounter.combatants.splice(toIdx, 0, moved);
          encounter.activeIndex = Math.max(0, Math.min(encounter.activeIndex, encounter.combatants.length - 1));
          saveEncounter(encounter);
          renderEncounterList();
        });
        cardEl.addEventListener("dragend", () => {
          dragSourceId = null;
        });

        // Remove
        const removeBtn = cardEl.querySelector(".enc-remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", () => {
            const idx = findIndexById(id);
            if (idx === -1) return;
            encounter.combatants.splice(idx, 1);
            if (encounter.activeIndex >= encounter.combatants.length) {
              encounter.activeIndex = Math.max(0, encounter.combatants.length - 1);
            }
            saveEncounter(encounter);
            renderEncounterList();
          });
        }

        // HP inline edits
        const currentInput = cardEl.querySelector(".enc-hp-current");
        const maxInput = cardEl.querySelector(".enc-hp-max");
        const deltaInput = cardEl.querySelector(".enc-hp-delta");
        const dmgBtn = cardEl.querySelector(".enc-btn-dmg");
        const healBtn = cardEl.querySelector(".enc-btn-heal");

        function syncFromInputs() {
          const idx = findIndexById(id);
          if (idx === -1) return;
          const currVal = parseInt(currentInput.value, 10);
          const maxVal = parseInt(maxInput.value, 10);
          const curr = Number.isFinite(currVal) ? currVal : 0;
          const max = Number.isFinite(maxVal) ? maxVal : 0;
          encounter.combatants[idx].maxHp = max;
          encounter.combatants[idx].currentHp = Math.max(0, Math.min(curr, max || curr));
          saveEncounter(encounter);
          renderEncounterList();
        }

        if (currentInput) {
          currentInput.addEventListener("change", syncFromInputs);
          currentInput.addEventListener("blur", syncFromInputs);
        }
        if (maxInput) {
          maxInput.addEventListener("change", syncFromInputs);
          maxInput.addEventListener("blur", syncFromInputs);
        }

        function applyDelta(sign) {
          if (!deltaInput) return;
          const raw = deltaInput.value.trim();
          if (!raw) return;
          let val = parseInt(raw, 10);
          if (!Number.isFinite(val) || val === 0) return;
          const idx = findIndexById(id);
          if (idx === -1) return;
          const cState = encounter.combatants[idx];
          const max = Number.isFinite(cState.maxHp) ? cState.maxHp : 0;
          let curr = Number.isFinite(cState.currentHp) ? cState.currentHp : max;
          if (sign === -1) curr -= val; else curr += val;
          if (max > 0) curr = Math.min(curr, max);
          curr = Math.max(0, curr);
          cState.currentHp = curr;
          deltaInput.value = "";
          saveEncounter(encounter);
          renderEncounterList();
        }

        if (dmgBtn) {
          dmgBtn.addEventListener("click", () => applyDelta(-1));
        }
        if (healBtn) {
          healBtn.addEventListener("click", () => applyDelta(1));
        }

        // Double-click card to load into form for editing
        cardEl.addEventListener("dblclick", () => {
          const idx = findIndexById(id);
          if (idx === -1) return;
          const cState = encounter.combatants[idx];
          editingId = id;
          if (nameInput) nameInput.value = cState.name || "";
          if (sideSelect) sideSelect.value = cState.side || "other";
          if (initInput) initInput.value = cState.initiative ?? "";
          if (hpMaxInput) hpMaxInput.value = cState.maxHp ?? "";
          if (hpCurrentInput) hpCurrentInput.value = cState.currentHp ?? "";
          if (acInput) acInput.value = cState.ac ?? "";
          if (speedInput) speedInput.value = cState.speed ?? "";
          if (notesInput) notesInput.value = cState.notes ?? "";
          formBox.classList.add("visible");
        });
      }

      function renderEncounterList() {
        listEl.innerHTML = "";
        if (!encounter.combatants.length) {
          listEl.innerHTML = '<div class="enc-hint">No combatants yet. Click “Add / Edit combatant”.</div>';
          refreshRoundControls();
          return;
        }
        const frag = document.createDocumentFragment();
        encounter.combatants.forEach((c, index) => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = buildCardHTML(c, index);
          const card = wrapper.firstElementChild;
          if (!card) return;
          frag.appendChild(card);
          attachCardEvents(card, c, index);
        });
        listEl.appendChild(frag);
        refreshRoundControls();
      }

      // ====== Controls wiring ======

      if (roundDownBtn) {
        roundDownBtn.addEventListener("click", () => {
          encounter.round = Math.max(1, (encounter.round || 1) - 1);
          saveEncounter(encounter);
          refreshRoundControls();
        });
      }
      if (roundUpBtn) {
        roundUpBtn.addEventListener("click", () => {
          encounter.round = (encounter.round || 1) + 1;
          saveEncounter(encounter);
          refreshRoundControls();
        });
      }
      if (roundInput) {
        roundInput.addEventListener("change", () => {
          const val = parseInt(roundInput.value, 10);
          encounter.round = Number.isFinite(val) && val > 0 ? val : 1;
          saveEncounter(encounter);
          refreshRoundControls();
        });
      }
      if (nextTurnBtn) {
        nextTurnBtn.addEventListener("click", () => {
          if (!encounter.combatants.length) return;
          encounter.activeIndex = (encounter.activeIndex + 1) % encounter.combatants.length;
          if (encounter.activeIndex === 0) {
            encounter.round = (encounter.round || 1) + 1;
          }
          saveEncounter(encounter);
          renderEncounterList();
        });
      }

      if (formToggleBtn) {
        formToggleBtn.addEventListener("click", () => {
          if (formBox.classList.contains("visible")) {
            formBox.classList.remove("visible");
            editingId = null;
          } else {
            formBox.classList.add("visible");
          }
        });
      }

      if (formCancelBtn) {
        formCancelBtn.addEventListener("click", () => {
          formBox.classList.remove("visible");
          editingId = null;
        });
      }

      if (formSaveBtn) {
        formSaveBtn.addEventListener("click", () => {
          const name = (nameInput.value || "").trim();
          const side = sideSelect.value || "other";
          const initVal = parseInt(initInput.value, 10);
          const maxVal = parseInt(hpMaxInput.value, 10);
          const currVal = parseInt(hpCurrentInput.value, 10);
          const acVal = parseInt(acInput.value, 10);
          const speedVal = parseInt(speedInput.value, 10);
          const notes = (notesInput.value || "").trim();

          const cData = {
            name: name || "(unnamed)",
            side,
            initiative: Number.isFinite(initVal) ? initVal : null,
            maxHp: Number.isFinite(maxVal) ? maxVal : 0,
            currentHp: Number.isFinite(currVal) ? currVal : (Number.isFinite(maxVal) ? maxVal : 0),
            ac: Number.isFinite(acVal) ? acVal : null,
            speed: Number.isFinite(speedVal) ? speedVal : null,
            notes
          };

          if (editingId) {
            const idx = findIndexById(editingId);
            if (idx !== -1) {
              encounter.combatants[idx] = { ...encounter.combatants[idx], ...cData };
            }
          } else {
            cData.id = uid();
            encounter.combatants.push(cData);
          }

          editingId = null;
          saveEncounter(encounter);
          renderEncounterList();
          formBox.classList.remove("visible");
          nameInput.value = "";
          initInput.value = "";
          hpMaxInput.value = "";
          hpCurrentInput.value = "";
          acInput.value = "";
          speedInput.value = "";
          notesInput.value = "";
        });
      }

      if (sortInitBtn) {
        sortInitBtn.addEventListener("click", () => {
          encounter.combatants.sort((a, b) => {
            const ai = Number.isFinite(a.initiative) ? a.initiative : -9999;
            const bi = Number.isFinite(b.initiative) ? b.initiative : -9999;
            return bi - ai;
          });
          encounter.activeIndex = 0;
          saveEncounter(encounter);
          renderEncounterList();
        });
      }

      if (clearEncounterBtn) {
        clearEncounterBtn.addEventListener("click", () => {
          if (!window.confirm("Clear all combatants from the active encounter?")) return;
          encounter = { round: 1, activeIndex: 0, combatants: [] };
          saveEncounter(encounter);
          renderEncounterList();
        });
      }

      if (saveCurrentAsPartyBtn) {
        saveCurrentAsPartyBtn.addEventListener("click", () => {
          if (!encounter.combatants.length) {
            window.alert("No combatants in the encounter to save as a party.");
            return;
          }
          party = encounter.combatants.map((c) => ({
            name: c.name,
            side: c.side,
            initiative: c.initiative,
            maxHp: c.maxHp,
            currentHp: c.currentHp,
            ac: c.ac,
            speed: c.speed,
            notes: c.notes
          }));
          saveParty(party);
          renderParty();
        });
      }

      if (addFullPartyBtn) {
        addFullPartyBtn.addEventListener("click", () => {
          if (!party.length) {
            window.alert("No saved party yet. Use “Save current encounter as party” first.");
            return;
          }
          party.forEach((p) => {
            encounter.combatants.push({
              id: uid(),
              name: p.name,
              side: p.side,
              initiative: p.initiative,
              maxHp: p.maxHp,
              currentHp: p.currentHp,
              ac: p.ac,
              speed: p.speed,
              notes: p.notes
            });
          });
          saveEncounter(encounter);
          renderEncounterList();
        });
      }

      // Initial paint
      refreshRoundControls();
      renderEncounterList();
      renderParty();
    }
  });
})();
