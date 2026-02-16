// tool-encounter.js
// Auto-generated from "test encounter .html" to render 1:1 inside toolbox tool panel.
(function () {
  const TOOL_ID = "encounterTool";
  const TOOL_NAME = "Encounter / Initiative";

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

    // Fallback for older app versions
    window.toolsConfig = window.toolsConfig || [];
    const exists = window.toolsConfig.some((t) => t.id === TOOL_ID);
    if (!exists) window.toolsConfig.push(def);
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
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);
  }

  function renderEncounterTool() {
    const label = document.getElementById("activeGeneratorLabel");
    const panel = document.getElementById("generatorPanel");
    if (!panel) return;

    if (label) label.textContent = TOOL_NAME;

    panel.innerHTML = "";
    panel.removeEventListener("click", window.handleCopyClick || (() => {}));
    panel.classList.add("encounter-tool-panel");

    const host = document.createElement("div");
    host.style.display = "block";
    host.style.width = "100%";
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
    }

    * {
      box-sizing: border-box;
    }

    .encounter-body {
      margin: 0;
      padding: 16px;
      background: radial-gradient(circle at top left, #151921 0, #050608 40%, #000000 100%);
      color: var(--text-main);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }

    .preview-shell {
      width: 780px;
      max-width: 100%;
      background: var(--bg-panel);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      padding: 10px 12px;
      box-shadow: 0 0 24px rgba(0,0,0,0.6);
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
      cursor: default;
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
      max-height: calc(100vh - 120px);
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

    /* Remove number spinners */
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
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: #181f2b;
      color: var(--accent-strong);
    }

    .btn-secondary {
      background: #080b11;
      border-color: #303641;
      color: var(--text-muted);
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
      cursor: default;
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

    .boxed-subsection {
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

    .initiative-box {
      border-radius: 10px;
      border: 1px solid #262c37;
      background: #05070c;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .initiative-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
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
      cursor: default;
    }

    .enemy-card .card-portrait {
      background: radial-gradient(circle at top left, #3a2025, #05070c);
    }

    /* Grid: name | HP block | meta */
    .card-content {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) auto minmax(0, 1.1fr);
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
      display: inline-block;
      min-width: 90px;      /* keeps HP text width consistent */
      text-align: center;
    }

    .hp-label strong {
      font-size: 1.08rem;
    }

    /* Small damage/heal input with room for 2 digits */
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

    .party-strip {
      border-radius: 10px;
      border: 1px solid #262c37;
      background: #05070c;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
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
      cursor: default;
      padding: 0 2px;
    }

    code {
      font-family: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.74rem;
      background: rgba(255,255,255,0.04);
      padding: 0 3px;
      border-radius: 4px;
    }

    @media (max-width: 600px) {
      .preview-shell {
        padding: 8px;
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
      <div class="label-pill">Tool · Right Panel Preview</div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <div class="tabs-row">
        <button class="tab active">Active Encounter</button>
        <button class="tab">Encounter Library</button>
      </div>
      <div class="hint-text">
        Use this even outside combat (stealth runs, chases, social scenes with “turns”).
      </div>
    </div>

    <div class="panel-inner">
      <!-- ACTIVE ENCOUNTER HEADER -->
      <div class="section-heading-row">
        <div class="section-title">Active Encounter</div>
        <div class="hint-text">Round & turn tracking with compact, draggable cards.</div>
      </div>

      <!-- ROUND / TURN CONTROLS -->
      <div class="row">
        <div class="col" style="max-width:80px;">
          <label>Round</label>
          <input type="number" value="3" min="1">
        </div>
        <div class="col">
          <label>Current turn</label>
          <input type="text" value="Vesper" readonly>
        </div>
        <div class="col" style="display:flex; gap:4px; justify-content:flex-end;">
          <button class="btn btn-xs">Next turn</button>
          <button class="btn btn-secondary btn-xs">Next round</button>
        </div>
      </div>

      <!-- SAVED PARTY STRIP -->
      <div class="party-strip">
        <div class="party-row">
          <span class="party-name">Saved party: Frostclaw Cell</span>
          <span class="hint-text">Click + to add a member, or add all at once.</span>
        </div>
        <div class="party-row">
          <div class="party-chip">Vesper <button title="Add to encounter">+</button></div>
          <div class="party-chip">Arelix <button title="Add to encounter">+</button></div>
          <div class="party-chip">Lirael <button title="Add to encounter">+</button></div>
          <div class="party-chip">Thamar <button title="Add to encounter">+</button></div>
          <button class="btn btn-xs">Add full party</button>
          <button class="btn btn-xs">Manage parties</button>
        </div>
      </div>

      <!-- ADD COMBATANT -->
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
            <label>Name</label>
            <input type="text" placeholder="Vesper, Goblin Scout, Frostclaw Wolf">
          </div>
          <div class="col" style="max-width:80px;">
            <label>AC</label>
            <input type="number" value="15" min="0">
          </div>
          <div class="col" style="max-width:100px;">
            <label>Speed (ft)</label>
            <input type="number" value="30" min="0">
          </div>
          <div class="col" style="max-width:170px;">
            <label>HP (current / max)</label>
            <div style="display:flex; gap:4px;">
              <input type="number" value="27" min="0">
              <input type="number" value="35" min="0">
            </div>
          </div>
          <div class="col" style="max-width:110px;">
            <label>Type</label>
            <select>
              <option>PC</option>
              <option>NPC</option>
              <option>Enemy</option>
            </select>
          </div>
          <div class="col" style="max-width:90px;">
            <label>&nbsp;</label>
            <button class="btn btn-xs">Add</button>
          </div>
        </div>
      </div>

      <!-- TURN ORDER + CARDS -->
      <div class="initiative-box">
        <div class="section-heading-row">
          <div class="section-title">Turn order</div>
          <div class="hint-text">Drag cards up/down to set initiative. Top goes first.</div>
        </div>

        <div class="initiative-list">
          <!-- CARD 1: Active PC -->
          <div class="card pc-card active-turn">
            <div class="card-main">
              <div class="card-portrait" title="Portrait">
                V
              </div>
              <div class="card-content">
                <!-- Left: name -->
                <div class="name-block">
                  <div class="name-row">
                    <span class="card-name">Vesper</span>
                    <span class="card-tag">PC</span>
                  </div>
                </div>

                <!-- Center: HP & tiny input -->
                <div class="hp-block">
                  <span class="hp-label">HP: 27 / <strong>35</strong></span>
                  <input class="hp-amount-input" type="text" placeholder="">
                  <div class="hp-buttons">
                    <button class="btn btn-xs">Damage</button>
                    <button class="btn btn-secondary btn-xs">Heal</button>
                  </div>
                </div>

                <!-- Right: meta -->
                <div class="card-meta">
                  <div class="card-meta-top">
                    <span>AC: 16</span>
                    <span>Spd: 30 ft</span>
                    <button class="btn-icon" title="Remove">×</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CARD 2: Enemy -->
          <div class="card enemy-card">
            <div class="card-main">
              <div class="card-portrait" title="Portrait">
                W
              </div>
              <div class="card-content">
                <div class="name-block">
                  <div class="name-row">
                    <span class="card-name">Frostclaw Wolf</span>
                    <span class="card-tag">Enemy</span>
                  </div>
                </div>

                <div class="hp-block">
                  <span class="hp-label">HP: 55 / <strong>55</strong></span>
                  <input class="hp-amount-input" type="text" placeholder="">
                  <div class="hp-buttons">
                    <button class="btn btn-xs">Damage</button>
                    <button class="btn btn-secondary btn-xs">Heal</button>
                  </div>
                </div>

                <div class="card-meta">
                  <div class="card-meta-top">
                    <span>AC: 13</span>
                    <span>Spd: 40 ft</span>
                    <button class="btn-icon" title="Remove">×</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CARD 3: Downed Enemy -->
          <div class="card enemy-card downed">
            <div class="card-main">
              <div class="card-portrait" title="Portrait">
                B
              </div>
              <div class="card-content">
                <div class="name-block">
                  <div class="name-row">
                    <span class="card-name">Bandit Captain</span>
                    <span class="card-tag">Enemy</span>
                  </div>
                </div>

                <div class="hp-block">
                  <span class="hp-label">HP: 0 / <strong>65</strong></span>
                  <input class="hp-amount-input" type="text" placeholder="">
                  <div class="hp-buttons">
                    <button class="btn btn-xs">Damage</button>
                    <button class="btn btn-secondary btn-xs">Heal</button>
                  </div>
                </div>

                <div class="card-meta">
                  <div class="card-meta-top">
                    <span>AC: 15</span>
                    <span>Spd: 30 ft</span>
                    <button class="btn-icon" title="Remove">×</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <hr class="section-divider">

      <!-- ENCOUNTER LIBRARY PREVIEW -->
      <div class="section-heading-row">
        <div class="section-title">Encounter Library (preview of other tab)</div>
        <div class="hint-text">
          Prebuild fights, then load them into the Active view with a single click.
        </div>
      </div>

      <div class="encounter-list">
        <div class="encounter-row">
          <div class="encounter-row-header">
            <div>
              <div class="encounter-name">Bandits on the Old Road</div>
              <div class="encounter-tags">3x Bandit · 1x Bandit Captain · CR ~3</div>
            </div>
            <span class="hint-text">Verdant Veil · Old trade route</span>
          </div>
          <div class="encounter-actions">
            <button class="btn btn-xs">Load as active</button>
            <button class="btn btn-secondary btn-xs">Append to active</button>
            <button class="btn btn-secondary btn-xs">Edit</button>
            <button class="btn btn-secondary btn-xs">Duplicate</button>
          </div>
        </div>

        <div class="encounter-row">
          <div class="encounter-row-header">
            <div>
              <div class="encounter-name">Frostclaw Gulf Patrol</div>
              <div class="encounter-tags">2x Frostclaw Wolf · 1x Clan Hunter</div>
            </div>
            <span class="hint-text">Frostclaw Wilds · Coastal ice</span>
          </div>
          <div class="encounter-actions">
            <button class="btn btn-xs">Load as active</button>
            <button class="btn btn-secondary btn-xs">Append to active</button>
            <button class="btn btn-secondary btn-xs">Edit</button>
            <button class="btn btn-secondary btn-xs">Duplicate</button>
          </div>
        </div>
      </div>

      <div class="hint-text">
        In the real toolbox, “Saved party” would live in <code>localStorage</code>, and the + / Add full party
        buttons would just call your existing “add combatant” flow behind the scenes.
      </div>
    </div>
  </div>
      </div>
    `;
  }

  registerEncounterTool();
  injectPanelOverrideCss();

  // If app is already initialized, refresh tool list so this appears immediately.
  if (typeof window.renderToolsNav === "function") {
    window.renderToolsNav();
  }

  // Wrap core renderToolPanel so this tool can render in current app architecture.
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
