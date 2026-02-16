// tool-encounter.js
// Encounter / Initiative tool for Vrahune Toolbox.
(function () {
  if (window.__vrahuneEncounterToolLoaded) return;
  window.__vrahuneEncounterToolLoaded = true;

  const TOOL_ID = "encounterTool";
  const TOOL_NAME = "Encounter / Initiative";
  const STORAGE_KEY = "vrahuneEncounterToolStateV2";

  const DEFAULT_STATE = {
    round: 3,
    turnId: "c1",
    nextId: 20,
    activeEncounter: [
      {
        id: "c1",
        name: "Vesper",
        type: "PC",
        ac: 16,
        speed: 30,
        hpCurrent: 27,
        hpMax: 35,
        portrait: "V"
      },
      {
        id: "c2",
        name: "Frostclaw Wolf",
        type: "Enemy",
        ac: 13,
        speed: 40,
        hpCurrent: 55,
        hpMax: 55,
        portrait: "W"
      },
      {
        id: "c3",
        name: "Bandit Captain",
        type: "Enemy",
        ac: 15,
        speed: 30,
        hpCurrent: 0,
        hpMax: 65,
        portrait: "B"
      }
    ],
    savedParty: {
      name: "Frostclaw Cell",
      members: [
        { name: "Vesper", type: "PC", ac: 16, speed: 30, hpCurrent: 27, hpMax: 35, portrait: "V" },
        { name: "Arelix", type: "PC", ac: 15, speed: 30, hpCurrent: 31, hpMax: 31, portrait: "A" },
        { name: "Lirael", type: "PC", ac: 14, speed: 30, hpCurrent: 24, hpMax: 24, portrait: "L" },
        { name: "Thamar", type: "PC", ac: 17, speed: 25, hpCurrent: 38, hpMax: 38, portrait: "T" }
      ]
    },
    library: [
      {
        id: "e1",
        name: "Bandits on the Old Road",
        tags: "3x Bandit · 1x Bandit Captain · CR ~3",
        location: "Verdant Veil · Old trade route",
        combatants: [
          { name: "Bandit", type: "Enemy", ac: 12, speed: 30, hpCurrent: 11, hpMax: 11, portrait: "B" },
          { name: "Bandit", type: "Enemy", ac: 12, speed: 30, hpCurrent: 11, hpMax: 11, portrait: "B" },
          { name: "Bandit", type: "Enemy", ac: 12, speed: 30, hpCurrent: 11, hpMax: 11, portrait: "B" },
          { name: "Bandit Captain", type: "Enemy", ac: 15, speed: 30, hpCurrent: 65, hpMax: 65, portrait: "B" }
        ]
      },
      {
        id: "e2",
        name: "Frostclaw Gulf Patrol",
        tags: "2x Frostclaw Wolf · 1x Clan Hunter",
        location: "Frostclaw Wilds · Coastal ice",
        combatants: [
          { name: "Frostclaw Wolf", type: "Enemy", ac: 13, speed: 40, hpCurrent: 55, hpMax: 55, portrait: "W" },
          { name: "Frostclaw Wolf", type: "Enemy", ac: 13, speed: 40, hpCurrent: 55, hpMax: 55, portrait: "W" },
          { name: "Clan Hunter", type: "NPC", ac: 14, speed: 30, hpCurrent: 22, hpMax: 22, portrait: "C" }
        ]
      }
    ]
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clampInt(value, min, max) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function asInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeType(type) {
    const t = String(type || "").toLowerCase();
    if (t === "pc") return "PC";
    if (t === "npc") return "NPC";
    return "Enemy";
  }

  function toPortrait(name, fallback) {
    const n = (name || "").trim();
    if (n) return n[0].toUpperCase();
    if (fallback) return String(fallback).trim().slice(0, 1).toUpperCase() || "?";
    return "?";
  }

  function normalizeCombatant(c, stateForId) {
    const id = c && c.id ? String(c.id) : nextId(stateForId, "c");
    const type = normalizeType(c && c.type);
    let hpMax = Math.max(0, asInt(c && c.hpMax, 1));
    let hpCurrent = Math.max(0, asInt(c && c.hpCurrent, hpMax));
    if (hpCurrent > hpMax) hpCurrent = hpMax;

    const name = String((c && c.name) || "Combatant").trim() || "Combatant";
    return {
      id,
      name,
      type,
      ac: Math.max(0, asInt(c && c.ac, 10)),
      speed: Math.max(0, asInt(c && c.speed, 30)),
      hpCurrent,
      hpMax,
      portrait: toPortrait(name, c && c.portrait)
    };
  }

  function normalizeState(raw) {
    const base = deepClone(DEFAULT_STATE);
    const merged = raw && typeof raw === "object" ? Object.assign(base, raw) : base;

    merged.round = Math.max(1, asInt(merged.round, 1));
    merged.nextId = Math.max(1, asInt(merged.nextId, 1));

    if (!merged.savedParty || typeof merged.savedParty !== "object") {
      merged.savedParty = deepClone(DEFAULT_STATE.savedParty);
    }
    merged.savedParty.name = String(merged.savedParty.name || "Saved Party").trim() || "Saved Party";
    if (!Array.isArray(merged.savedParty.members)) merged.savedParty.members = [];

    merged.savedParty.members = merged.savedParty.members.map((m) => {
      const temp = normalizeCombatant(
        {
          id: m && m.id,
          name: m && m.name,
          type: m && m.type,
          ac: m && m.ac,
          speed: m && m.speed,
          hpCurrent: m && m.hpCurrent,
          hpMax: m && m.hpMax,
          portrait: m && m.portrait
        },
        merged
      );
      delete temp.id;
      return temp;
    });

    if (!Array.isArray(merged.activeEncounter)) merged.activeEncounter = [];
    merged.activeEncounter = merged.activeEncounter.map((c) => normalizeCombatant(c, merged));

    if (!Array.isArray(merged.library)) merged.library = [];
    merged.library = merged.library.map((entry) => {
      const e = Object.assign({}, entry || {});
      e.id = e.id ? String(e.id) : nextId(merged, "e");
      e.name = String(e.name || "Untitled Encounter").trim() || "Untitled Encounter";
      e.tags = String(e.tags || "").trim();
      e.location = String(e.location || "").trim();
      if (!Array.isArray(e.combatants)) e.combatants = [];
      e.combatants = e.combatants.map((c) => {
        const combatant = normalizeCombatant(c, merged);
        delete combatant.id;
        return combatant;
      });
      return e;
    });

    if (!merged.turnId || !merged.activeEncounter.some((c) => c.id === merged.turnId)) {
      merged.turnId = merged.activeEncounter.length ? merged.activeEncounter[0].id : null;
    }

    return merged;
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeState(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (err) {
      console.warn("Encounter tool: failed to load state, using defaults.", err);
      return normalizeState(DEFAULT_STATE);
    }
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Encounter tool: failed to save state.", err);
    }
  }

  function nextId(state, prefix) {
    const id = `${prefix}${state.nextId}`;
    state.nextId += 1;
    return id;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function typeClass(type) {
    const t = normalizeType(type);
    if (t === "PC") return "pc-card";
    if (t === "NPC") return "npc-card";
    return "enemy-card";
  }

  function getCurrentTurn(state) {
    if (!state.turnId) return null;
    return state.activeEncounter.find((c) => c.id === state.turnId) || null;
  }

  function getCurrentTurnIndex(state) {
    if (!state.turnId) return -1;
    return state.activeEncounter.findIndex((c) => c.id === state.turnId);
  }

  function ensureTurnId(state) {
    if (!state.activeEncounter.length) {
      state.turnId = null;
      return;
    }
    if (!state.turnId || !state.activeEncounter.some((c) => c.id === state.turnId)) {
      state.turnId = state.activeEncounter[0].id;
    }
  }

  function copyPartyMemberToCombatant(member, state) {
    return normalizeCombatant(
      {
        id: nextId(state, "c"),
        name: member.name,
        type: member.type,
        ac: member.ac,
        speed: member.speed,
        hpCurrent: member.hpCurrent,
        hpMax: member.hpMax,
        portrait: member.portrait
      },
      state
    );
  }

  function defaultNameForType(type, state) {
    const normalized = normalizeType(type);
    const base = normalized === "PC" ? "PC" : normalized === "NPC" ? "NPC" : "Enemy";
    const same = state.activeEncounter.filter((c) => normalizeType(c.type) === normalized).length;
    return `${base} ${same + 1}`;
  }

  function injectPanelOverrideCss() {
    const id = "encounter-tool-panel-overrides";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #generatorPanel.encounter-tool-panel {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        overflow: hidden !important;
        display: block !important;
      }

      #generatorPanel.encounter-tool-panel > .encounter-host {
        width: 100%;
        height: 100%;
        min-height: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function registerEncounterTool() {
    const def = {
      id: TOOL_ID,
      name: TOOL_NAME,
      description: "Quick initiative tracker & encounter builder."
    };

    if (typeof window.registerTool === "function") {
      window.registerTool({
        ...def,
        render: renderEncounterTool
      });
      return;
    }

    window.toolsConfig = window.toolsConfig || [];
    const exists = window.toolsConfig.some((t) => t.id === TOOL_ID);
    if (!exists) window.toolsConfig.push(def);
  }

  function renderEncounterTool() {
    const label = document.getElementById("activeGeneratorLabel");
    const panel = document.getElementById("generatorPanel");
    if (!panel) return;

    if (label) label.textContent = TOOL_NAME;

    panel.innerHTML = "";
    panel.classList.add("encounter-tool-panel");

    const host = document.createElement("div");
    host.className = "encounter-host";
    panel.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          --bg-main: #050608;
          --bg-panel: #0b0f14;
          --border-subtle: #232a33;
          --accent: #c0c0c0;
          --accent-soft: #808890;
          --accent-strong: #f5f5f5;
          --danger: #ff5c5c;
          --text-main: #e6e6e6;
          --text-muted: #9ba1aa;
          --hover: #151a22;
          --radius-lg: 14px;
          --radius-md: 10px;
          --radius-sm: 6px;
          display: block;
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        .encounter-body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          min-height: 0;
          color: var(--text-main);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
          display: block;
        }

        .preview-shell {
          width: 100%;
          min-height: 100%;
          background: var(--bg-panel);
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          padding: 10px 12px;
          box-shadow: 0 0 24px rgba(0,0,0,0.45);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .header-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
        }

        .title {
          font-size: 1rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }

        .subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .label-pill {
          font-size: 0.76rem;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          background: #05070c;
          color: var(--accent-soft);
          white-space: nowrap;
        }

        .tabs-row {
          display: inline-flex;
          border-radius: 999px;
          border: 1px solid #303641;
          overflow: hidden;
          background: #05070c;
          font-size: 0.78rem;
        }

        .tab {
          padding: 4px 12px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
        }

        .tab.active {
          background: #181f2b;
          color: var(--accent-strong);
        }

        .panel-inner {
          border-radius: var(--radius-md);
          border: 1px solid #222832;
          background: radial-gradient(circle at top left, #10151f, #05070c 70%);
          padding: 8px 10px;
          font-size: 0.82rem;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
        }

        .row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-end;
        }

        .col {
          flex: 1;
          min-width: 120px;
        }

        label {
          font-size: 0.76rem;
          color: var(--text-muted);
          display: block;
          margin-bottom: 3px;
        }

        input[type="text"],
        input[type="number"],
        select {
          width: 100%;
          font-family: inherit;
          font-size: 0.8rem;
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-subtle);
          background: #05070c;
          color: var(--text-main);
        }

        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type=number] {
          -moz-appearance: textfield;
        }

        input:focus,
        select:focus {
          outline: none;
          border-color: #9aa2af;
          box-shadow: 0 0 0 1px rgba(192,192,192,0.4);
        }

        .btn {
          font-family: inherit;
          font-size: 0.78rem;
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 5px 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: #181f2b;
          color: var(--accent-strong);
          transition: transform 0.06s ease-out, background 0.16s ease;
        }

        .btn:hover {
          background: #232c3c;
        }

        .btn:active {
          transform: translateY(1px);
        }

        .btn-secondary {
          background: #080b11;
          border-color: #303641;
          color: var(--text-muted);
        }

        .btn-secondary:hover {
          background: #0f141d;
          color: var(--accent-strong);
        }

        .btn-xs {
          font-size: 0.72rem;
          padding: 3px 8px;
        }

        .btn-icon {
          border-radius: 999px;
          border: none;
          background: transparent;
          color: var(--accent-soft);
          padding: 0 4px;
          font-size: 0.95rem;
          cursor: pointer;
        }

        .btn-icon:hover {
          color: #ff9999;
        }

        .section-divider {
          border: none;
          border-top: 1px solid #1a2028;
          margin: 4px 0;
        }

        .section-heading-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
        }

        .section-title {
          font-size: 0.82rem;
          color: var(--accent-soft);
        }

        .hint-text {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .boxed-subsection,
        .initiative-box,
        .party-strip {
          border-radius: 10px;
          border: 1px solid #262c37;
          background: rgba(5, 7, 12, 0.85);
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .boxed-subsection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }

        .boxed-subsection-title {
          font-size: 0.8rem;
          color: var(--accent-soft);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chevron {
          font-size: 0.9rem;
          color: var(--accent-soft);
        }

        .initiative-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 56px;
        }

        .initiative-empty {
          border: 1px dashed #303641;
          border-radius: 8px;
          padding: 10px;
          color: var(--text-muted);
          font-size: 0.76rem;
          text-align: center;
        }

        .card {
          border-radius: 10px;
          border: 1px solid #222832;
          padding: 4px 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: grab;
        }

        .card:active {
          cursor: grabbing;
        }

        .card.dragging {
          opacity: 0.4;
          border-style: dashed;
        }

        .pc-card {
          background: linear-gradient(120deg, #0b101c, #05070c);
          border-color: #2e3b57;
        }

        .enemy-card {
          background: linear-gradient(120deg, #16090d, #05070c);
          border-color: #4a2028;
        }

        .npc-card {
          background: linear-gradient(120deg, #101010, #05070c);
          border-color: #33363f;
        }

        .card-main {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-portrait {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid #323949;
          background: radial-gradient(circle at top left, #2a3244, #05070c);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-strong);
          font-weight: 600;
          font-size: 0.9rem;
          user-select: none;
        }

        .enemy-card .card-portrait {
          background: radial-gradient(circle at top left, #3a2025, #05070c);
        }

        .card-content {
          flex: 1;
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) auto minmax(0, 1.2fr);
          align-items: center;
          column-gap: 8px;
        }

        .name-block {
          min-width: 0;
        }

        .name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .card-name {
          font-weight: 600;
          font-size: 1.0rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-tag {
          font-size: 0.72rem;
          padding: 1px 6px;
          border-radius: 999px;
          border: 1px solid #303641;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .pc-card .card-tag {
          border-color: #3b5678;
          color: #b8c8ff;
        }

        .enemy-card .card-tag {
          border-color: #6b2c38;
          color: #ffb8c0;
        }

        .hp-block {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          justify-self: center;
          min-width: 0;
        }

        .hp-label {
          font-size: 1.0rem;
          font-weight: 600;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          text-align: center;
        }

        .hp-inline {
          width: 44px !important;
          min-width: 44px;
          padding: 2px 3px !important;
          font-size: 0.88rem !important;
          text-align: center;
          font-weight: 600;
        }

        .hp-divider {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .hp-amount-input {
          flex: 0 0 38px;
          width: 38px !important;
          min-width: 0;
          padding: 0;
          font-size: 0.65rem;
          line-height: 1;
          text-align: center;
        }

        .hp-buttons {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: 4px;
          white-space: nowrap;
        }

        .card-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          font-size: 0.82rem;
          white-space: nowrap;
          font-weight: 500;
          justify-self: end;
        }

        .card-meta-top {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .meta-inline {
          width: 36px !important;
          min-width: 36px;
          padding: 2px 3px !important;
          font-size: 0.76rem !important;
          text-align: center;
          font-weight: 600;
        }

        .card.active-turn {
          border-color: #c0c0c0;
          box-shadow: 0 0 0 1px rgba(192,192,192,0.25);
          background: radial-gradient(circle at top left, #243046, #070a10);
        }

        .card.downed {
          border-color: var(--danger);
          background: #1a0506;
          opacity: 0.9;
        }

        .encounter-list {
          border-radius: 8px;
          border: 1px solid #222832;
          background: #05070c;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .encounter-row {
          border-radius: 8px;
          border: 1px solid #262c37;
          background: #080b11;
          padding: 4px 6px;
          font-size: 0.8rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .encounter-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }

        .encounter-name {
          font-weight: 500;
        }

        .encounter-tags {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .encounter-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 2px;
        }

        .party-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
        }

        .party-name {
          font-size: 0.78rem;
          color: var(--accent-soft);
          font-weight: 500;
          margin-right: 4px;
        }

        .party-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.76rem;
          border-radius: 999px;
          border: 1px solid #303641;
          padding: 2px 6px;
          background: #080b11;
          color: #e6e6e6;
        }

        .party-chip button {
          border: none;
          background: transparent;
          color: var(--accent-soft);
          font-size: 0.78rem;
          cursor: pointer;
          padding: 0 2px;
        }

        .party-chip button:hover {
          color: var(--accent-strong);
        }

        code {
          font-family: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.74rem;
          background: rgba(255,255,255,0.04);
          padding: 0 3px;
          border-radius: 4px;
        }

        .hidden {
          display: none !important;
        }

        @media (max-width: 920px) {
          .card-content {
            grid-template-columns: 1fr;
            row-gap: 6px;
          }

          .card-meta,
          .hp-block {
            justify-self: start;
            align-items: flex-start;
          }

          .card-meta {
            align-items: flex-start;
          }
        }
      </style>
      <div class="encounter-body">
        <div class="preview-shell">
          <div class="header-line">
            <div>
              <div class="title">Encounter / Initiative</div>
              <div class="subtitle">
                Quick initiative tracker & encounter builder – designed to live on the right side of your toolbox.
              </div>
            </div>
            <div class="label-pill">Tool · Right Panel</div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div class="tabs-row" role="tablist" aria-label="Encounter tabs">
              <button id="tabActive" class="tab active" data-action="tab-active" type="button">Active Encounter</button>
              <button id="tabLibrary" class="tab" data-action="tab-library" type="button">Encounter Library</button>
            </div>
            <div class="hint-text">
              Use this even outside combat (stealth runs, chases, social scenes with “turns”).
            </div>
          </div>

          <div class="panel-inner">
            <div id="activeTabContent">
              <div class="section-heading-row">
                <div class="section-title">Active Encounter</div>
                <div class="hint-text">Round & turn tracking with compact, draggable cards.</div>
              </div>

              <div class="row">
                <div class="col" style="max-width:80px;">
                  <label for="roundInput">Round</label>
                  <input id="roundInput" type="number" value="1" min="1">
                </div>
                <div class="col">
                  <label for="currentTurnInput">Current turn</label>
                  <input id="currentTurnInput" type="text" value="" readonly>
                </div>
                <div class="col" style="display:flex; gap:4px; justify-content:flex-end;">
                  <button class="btn btn-xs" data-action="next-turn" type="button">Next turn</button>
                  <button class="btn btn-secondary btn-xs" data-action="next-round" type="button">Next round</button>
                </div>
              </div>

              <div class="party-strip">
                <div class="party-row">
                  <span id="savedPartyName" class="party-name">Saved party:</span>
                  <span class="hint-text">Click + to add a member, or add all at once.</span>
                </div>
                <div id="partyChipRow" class="party-row"></div>
              </div>

              <div class="boxed-subsection">
                <div class="boxed-subsection-header">
                  <div class="boxed-subsection-title">
                    <span class="chevron">▾</span>
                    Add / edit combatants
                  </div>
                  <span class="hint-text">Preload monsters or drop in ad-hoc PCs/NPCs.</span>
                </div>
                <div class="row">
                  <div class="col">
                    <label for="addName">Name</label>
                    <input id="addName" type="text" placeholder="Vesper, Goblin Scout, Frostclaw Wolf">
                  </div>
                  <div class="col" style="max-width:80px;">
                    <label for="addAc">AC</label>
                    <input id="addAc" type="number" value="15" min="0">
                  </div>
                  <div class="col" style="max-width:100px;">
                    <label for="addSpeed">Speed (ft)</label>
                    <input id="addSpeed" type="number" value="30" min="0">
                  </div>
                  <div class="col" style="max-width:170px;">
                    <label>HP (current / max)</label>
                    <div style="display:flex; gap:4px;">
                      <input id="addHpCur" type="number" value="27" min="0">
                      <input id="addHpMax" type="number" value="35" min="0">
                    </div>
                  </div>
                  <div class="col" style="max-width:110px;">
                    <label for="addType">Type</label>
                    <select id="addType">
                      <option>PC</option>
                      <option>NPC</option>
                      <option>Enemy</option>
                    </select>
                  </div>
                  <div class="col" style="max-width:90px;">
                    <label>&nbsp;</label>
                    <button class="btn btn-xs" data-action="add-combatant" type="button">Add</button>
                  </div>
                </div>
              </div>

              <div class="initiative-box">
                <div class="section-heading-row">
                  <div class="section-title">Turn order</div>
                  <div class="hint-text">Drag cards up/down to set initiative. Top goes first.</div>
                </div>

                <div id="initiativeList" class="initiative-list"></div>
              </div>
            </div>

            <div id="libraryTabContent" class="hidden">
              <div class="section-heading-row">
                <div class="section-title">Encounter Library</div>
                <div class="hint-text">Prebuild fights, then load them into the Active view with a single click.</div>
              </div>

              <div id="encounterList" class="encounter-list"></div>

              <div class="hint-text">
                State is saved to <code>localStorage</code> automatically for this browser.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const state = loadState();

    const refs = {
      roundInput: shadow.getElementById("roundInput"),
      currentTurnInput: shadow.getElementById("currentTurnInput"),
      savedPartyName: shadow.getElementById("savedPartyName"),
      partyChipRow: shadow.getElementById("partyChipRow"),
      addName: shadow.getElementById("addName"),
      addAc: shadow.getElementById("addAc"),
      addSpeed: shadow.getElementById("addSpeed"),
      addHpCur: shadow.getElementById("addHpCur"),
      addHpMax: shadow.getElementById("addHpMax"),
      addType: shadow.getElementById("addType"),
      initiativeList: shadow.getElementById("initiativeList"),
      encounterList: shadow.getElementById("encounterList"),
      tabActive: shadow.getElementById("tabActive"),
      tabLibrary: shadow.getElementById("tabLibrary"),
      activeTabContent: shadow.getElementById("activeTabContent"),
      libraryTabContent: shadow.getElementById("libraryTabContent")
    };

    let currentTab = "active";

    function persist() {
      saveState(state);
    }

    function renderRoundAndTurn() {
      ensureTurnId(state);
      refs.roundInput.value = String(state.round);
      const current = getCurrentTurn(state);
      refs.currentTurnInput.value = current ? current.name : "—";
    }

    function renderParty() {
      refs.savedPartyName.textContent = `Saved party: ${state.savedParty.name}`;

      const chips = state.savedParty.members
        .map((member, idx) => {
          return `<div class="party-chip">${escapeHtml(member.name)} <button data-action="add-party-member" data-party-index="${idx}" title="Add to encounter" type="button">+</button></div>`;
        })
        .join("");

      refs.partyChipRow.innerHTML = `
        ${chips}
        <button class="btn btn-xs" data-action="add-full-party" type="button">Add full party</button>
        <button class="btn btn-xs" data-action="manage-party" type="button">Manage parties</button>
      `;
    }

    function renderCards() {
      ensureTurnId(state);

      if (!state.activeEncounter.length) {
        refs.initiativeList.innerHTML = `<div class="initiative-empty">No combatants yet. Add one above or load an encounter from the library.</div>`;
        renderRoundAndTurn();
        return;
      }

      refs.initiativeList.innerHTML = state.activeEncounter
        .map((c) => {
          const isActive = c.id === state.turnId;
          const downed = c.hpCurrent <= 0;

          return `
            <div class="card ${typeClass(c.type)} ${isActive ? "active-turn" : ""} ${downed ? "downed" : ""}" draggable="true" data-id="${escapeHtml(c.id)}">
              <div class="card-main">
                <div class="card-portrait" title="Portrait">${escapeHtml(c.portrait || toPortrait(c.name))}</div>
                <div class="card-content">
                  <div class="name-block">
                    <div class="name-row">
                      <span class="card-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
                      <span class="card-tag">${escapeHtml(normalizeType(c.type))}</span>
                    </div>
                  </div>

                  <div class="hp-block">
                    <span class="hp-label">HP:
                      <input class="hp-inline" data-field="hpCurrent" type="number" min="0" value="${c.hpCurrent}" />
                      <span class="hp-divider">/</span>
                      <input class="hp-inline" data-field="hpMax" type="number" min="0" value="${c.hpMax}" />
                    </span>
                    <input class="hp-amount-input" data-role="hp-amount" type="number" min="1" placeholder="1" />
                    <div class="hp-buttons">
                      <button class="btn btn-xs" data-action="damage" type="button">Damage</button>
                      <button class="btn btn-secondary btn-xs" data-action="heal" type="button">Heal</button>
                    </div>
                  </div>

                  <div class="card-meta">
                    <div class="card-meta-top">
                      <span>AC: <input class="meta-inline" data-field="ac" type="number" min="0" value="${c.ac}" /></span>
                      <span>Spd: <input class="meta-inline" data-field="speed" type="number" min="0" value="${c.speed}" /> ft</span>
                      <button class="btn-icon" data-action="remove-combatant" title="Remove" type="button">×</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      renderRoundAndTurn();
      wireDragAndDrop();
    }

    function renderLibrary() {
      if (!state.library.length) {
        refs.encounterList.innerHTML = `<div class="initiative-empty">No saved encounters yet.</div>`;
        return;
      }

      refs.encounterList.innerHTML = state.library
        .map((entry) => {
          return `
            <div class="encounter-row" data-encounter-id="${escapeHtml(entry.id)}">
              <div class="encounter-row-header">
                <div>
                  <div class="encounter-name">${escapeHtml(entry.name)}</div>
                  <div class="encounter-tags">${escapeHtml(entry.tags || "No tags")}</div>
                </div>
                <span class="hint-text">${escapeHtml(entry.location || "—")}</span>
              </div>
              <div class="encounter-actions">
                <button class="btn btn-xs" data-action="load-encounter" type="button">Load as active</button>
                <button class="btn btn-secondary btn-xs" data-action="append-encounter" type="button">Append to active</button>
                <button class="btn btn-secondary btn-xs" data-action="edit-encounter" type="button">Edit</button>
                <button class="btn btn-secondary btn-xs" data-action="duplicate-encounter" type="button">Duplicate</button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    function setTab(tabName) {
      currentTab = tabName === "library" ? "library" : "active";
      const active = currentTab === "active";

      refs.tabActive.classList.toggle("active", active);
      refs.tabLibrary.classList.toggle("active", !active);

      refs.activeTabContent.classList.toggle("hidden", !active);
      refs.libraryTabContent.classList.toggle("hidden", active);
    }

    function addCombatantFromInputs() {
      let hpMax = Math.max(0, asInt(refs.addHpMax.value, 1));
      let hpCurrent = Math.max(0, asInt(refs.addHpCur.value, hpMax));
      if (hpCurrent > hpMax) hpCurrent = hpMax;

      const type = normalizeType(refs.addType.value);
      const name = (refs.addName.value || "").trim() || defaultNameForType(type, state);

      const combatant = normalizeCombatant(
        {
          id: nextId(state, "c"),
          name,
          type,
          ac: Math.max(0, asInt(refs.addAc.value, 10)),
          speed: Math.max(0, asInt(refs.addSpeed.value, 30)),
          hpCurrent,
          hpMax
        },
        state
      );

      state.activeEncounter.push(combatant);
      ensureTurnId(state);
      persist();
      renderCards();

      refs.addName.value = "";
    }

    function addPartyMember(index) {
      const member = state.savedParty.members[index];
      if (!member) return;
      state.activeEncounter.push(copyPartyMemberToCombatant(member, state));
      ensureTurnId(state);
      persist();
      renderCards();
    }

    function addFullParty() {
      state.savedParty.members.forEach((member) => {
        state.activeEncounter.push(copyPartyMemberToCombatant(member, state));
      });
      ensureTurnId(state);
      persist();
      renderCards();
    }

    function manageParty() {
      const currentName = state.savedParty.name;
      const newName = window.prompt("Party name:", currentName);
      if (newName !== null) {
        const trimmed = newName.trim();
        if (trimmed) state.savedParty.name = trimmed;
      }

      const currentMembers = state.savedParty.members.map((m) => m.name).join(", ");
      const namesPrompt = window.prompt(
        "Party member names (comma separated):",
        currentMembers
      );

      if (namesPrompt !== null) {
        const names = namesPrompt
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (names.length) {
          state.savedParty.members = names.map((name, idx) => {
            const existing = state.savedParty.members[idx] || {};
            return {
              name,
              type: normalizeType(existing.type || "PC"),
              ac: Math.max(0, asInt(existing.ac, 15)),
              speed: Math.max(0, asInt(existing.speed, 30)),
              hpCurrent: Math.max(0, asInt(existing.hpCurrent, 20)),
              hpMax: Math.max(0, asInt(existing.hpMax, 20)),
              portrait: toPortrait(name, existing.portrait)
            };
          });
        }
      }

      persist();
      renderParty();
    }

    function stepTurn() {
      if (!state.activeEncounter.length) return;
      ensureTurnId(state);

      const idx = getCurrentTurnIndex(state);
      const nextIdx = idx < 0 ? 0 : (idx + 1) % state.activeEncounter.length;
      if (idx >= 0 && nextIdx === 0) state.round += 1;
      state.turnId = state.activeEncounter[nextIdx].id;

      persist();
      renderCards();
    }

    function stepRound() {
      state.round += 1;
      if (state.activeEncounter.length) state.turnId = state.activeEncounter[0].id;
      persist();
      renderCards();
    }

    function updateCardField(cardId, field, value) {
      const combatant = state.activeEncounter.find((c) => c.id === cardId);
      if (!combatant) return;

      if (field === "hpCurrent") {
        combatant.hpCurrent = Math.max(0, asInt(value, combatant.hpCurrent));
        if (combatant.hpCurrent > combatant.hpMax) combatant.hpCurrent = combatant.hpMax;
      } else if (field === "hpMax") {
        combatant.hpMax = Math.max(0, asInt(value, combatant.hpMax));
        if (combatant.hpCurrent > combatant.hpMax) combatant.hpCurrent = combatant.hpMax;
      } else if (field === "ac") {
        combatant.ac = Math.max(0, asInt(value, combatant.ac));
      } else if (field === "speed") {
        combatant.speed = Math.max(0, asInt(value, combatant.speed));
      }

      persist();
      renderCards();
    }

    function applyDamageOrHeal(cardEl, mode) {
      const cardId = cardEl.dataset.id;
      const combatant = state.activeEncounter.find((c) => c.id === cardId);
      if (!combatant) return;

      const amountInput = cardEl.querySelector('[data-role="hp-amount"]');
      const amountRaw = amountInput ? amountInput.value : "";
      const amount = Math.max(1, asInt(amountRaw, 1));

      if (mode === "damage") {
        combatant.hpCurrent = Math.max(0, combatant.hpCurrent - amount);
      } else {
        combatant.hpCurrent = Math.min(combatant.hpMax, combatant.hpCurrent + amount);
      }

      if (amountInput) amountInput.value = "";

      persist();
      renderCards();
    }

    function removeCombatant(cardId) {
      const idx = state.activeEncounter.findIndex((c) => c.id === cardId);
      if (idx < 0) return;

      const removedWasTurn = state.turnId === cardId;
      state.activeEncounter.splice(idx, 1);

      if (!state.activeEncounter.length) {
        state.turnId = null;
      } else if (removedWasTurn) {
        const nextIdx = Math.min(idx, state.activeEncounter.length - 1);
        state.turnId = state.activeEncounter[nextIdx].id;
      }

      persist();
      renderCards();
    }

    function cloneEncounterCombatants(combatants) {
      return (combatants || []).map((c) =>
        normalizeCombatant(
          {
            id: nextId(state, "c"),
            name: c.name,
            type: c.type,
            ac: c.ac,
            speed: c.speed,
            hpCurrent: c.hpCurrent,
            hpMax: c.hpMax,
            portrait: c.portrait
          },
          state
        )
      );
    }

    function loadEncounter(encounterId, appendMode) {
      const entry = state.library.find((e) => e.id === encounterId);
      if (!entry) return;

      const clones = cloneEncounterCombatants(entry.combatants);
      if (appendMode) {
        state.activeEncounter.push(...clones);
      } else {
        state.activeEncounter = clones;
        state.round = 1;
      }

      ensureTurnId(state);
      if (!appendMode) {
        state.turnId = state.activeEncounter.length ? state.activeEncounter[0].id : null;
      }

      persist();
      renderCards();
      setTab("active");
    }

    function editEncounter(encounterId) {
      const entry = state.library.find((e) => e.id === encounterId);
      if (!entry) return;

      const name = window.prompt("Encounter name:", entry.name);
      if (name === null) return;
      const tags = window.prompt("Encounter tags:", entry.tags || "");
      if (tags === null) return;
      const location = window.prompt("Encounter location:", entry.location || "");
      if (location === null) return;

      entry.name = name.trim() || entry.name;
      entry.tags = tags.trim();
      entry.location = location.trim();

      persist();
      renderLibrary();
    }

    function duplicateEncounter(encounterId) {
      const entry = state.library.find((e) => e.id === encounterId);
      if (!entry) return;

      state.library.push({
        id: nextId(state, "e"),
        name: `${entry.name} (Copy)`,
        tags: entry.tags,
        location: entry.location,
        combatants: deepClone(entry.combatants)
      });

      persist();
      renderLibrary();
    }

    function reorderFromDom() {
      const ids = Array.from(refs.initiativeList.querySelectorAll(".card")).map((el) =>
        el.dataset.id
      );
      if (!ids.length) return;

      const map = new Map(state.activeEncounter.map((c) => [c.id, c]));
      state.activeEncounter = ids.map((id) => map.get(id)).filter(Boolean);
      ensureTurnId(state);
      persist();
      renderCards();
    }

    function wireDragAndDrop() {
      const list = refs.initiativeList;
      const cards = Array.from(list.querySelectorAll(".card"));
      if (!cards.length) return;

      cards.forEach((card) => {
        card.addEventListener("dragstart", (event) => {
          card.classList.add("dragging");
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", card.dataset.id || "");
          }
        });

        card.addEventListener("dragend", () => {
          card.classList.remove("dragging");
          reorderFromDom();
        });
      });

      list.addEventListener("dragover", (event) => {
        event.preventDefault();
        const dragging = list.querySelector(".card.dragging");
        if (!dragging) return;

        const nonDragging = Array.from(list.querySelectorAll(".card:not(.dragging)"));
        let next = null;

        for (const card of nonDragging) {
          const rect = card.getBoundingClientRect();
          const offset = event.clientY - (rect.top + rect.height / 2);
          if (offset < 0) {
            next = card;
            break;
          }
        }

        if (next) {
          list.insertBefore(dragging, next);
        } else {
          list.appendChild(dragging);
        }
      });
    }

    shadow.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const card = btn.closest(".card");
      const encounterRow = btn.closest(".encounter-row");
      const encounterId = encounterRow ? encounterRow.dataset.encounterId : null;

      if (action === "tab-active") {
        setTab("active");
        return;
      }

      if (action === "tab-library") {
        setTab("library");
        return;
      }

      if (action === "next-turn") {
        stepTurn();
        return;
      }

      if (action === "next-round") {
        stepRound();
        return;
      }

      if (action === "add-combatant") {
        addCombatantFromInputs();
        return;
      }

      if (action === "add-party-member") {
        const idx = asInt(btn.getAttribute("data-party-index"), -1);
        if (idx >= 0) addPartyMember(idx);
        return;
      }

      if (action === "add-full-party") {
        addFullParty();
        return;
      }

      if (action === "manage-party") {
        manageParty();
        return;
      }

      if (action === "damage" && card) {
        applyDamageOrHeal(card, "damage");
        return;
      }

      if (action === "heal" && card) {
        applyDamageOrHeal(card, "heal");
        return;
      }

      if (action === "remove-combatant" && card) {
        removeCombatant(card.dataset.id);
        return;
      }

      if (action === "load-encounter" && encounterId) {
        loadEncounter(encounterId, false);
        return;
      }

      if (action === "append-encounter" && encounterId) {
        loadEncounter(encounterId, true);
        return;
      }

      if (action === "edit-encounter" && encounterId) {
        editEncounter(encounterId);
        return;
      }

      if (action === "duplicate-encounter" && encounterId) {
        duplicateEncounter(encounterId);
      }
    });

    shadow.addEventListener("change", (event) => {
      const target = event.target;

      if (target === refs.roundInput) {
        state.round = Math.max(1, asInt(target.value, state.round));
        persist();
        renderRoundAndTurn();
        return;
      }

      if (target === refs.addType) {
        const t = normalizeType(refs.addType.value);
        refs.addType.value = t;
        return;
      }

      const card = target.closest(".card");
      if (!card) return;
      const cardId = card.dataset.id;
      if (!cardId) return;

      const field = target.getAttribute("data-field");
      if (field) {
        updateCardField(cardId, field, target.value);
      }
    });

    refs.addName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCombatantFromInputs();
      }
    });

    renderRoundAndTurn();
    renderParty();
    renderCards();
    renderLibrary();
    setTab("active");
  }

  registerEncounterTool();
  injectPanelOverrideCss();

  if (typeof window.renderToolsNav === "function") {
    window.renderToolsNav();
  }

  const prevRender = window.renderToolPanel;
  if (typeof prevRender === "function" && !prevRender.__encounterToolWrapped) {
    const wrappedRender = function (toolId) {
      const panel = document.getElementById("generatorPanel");
      if (panel) panel.classList.remove("encounter-tool-panel");

      if (toolId === TOOL_ID) {
        renderEncounterTool();
        return;
      }

      return prevRender(toolId);
    };

    wrappedRender.__encounterToolWrapped = true;
    window.renderToolPanel = wrappedRender;
  }
})();
