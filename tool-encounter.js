// tool-encounter.js
// Encounter / Initiative Tool – modular tool plugged into window.registerTool

(function () {
  if (!window.registerTool) {
    console.error(
      "[Encounter Tool] window.registerTool is not defined. Make sure app.js defines it before loading this file."
    );
    return;
  }

  // Inject scoped styles (no global :root or body overrides)
  function injectStyles() {
    if (document.getElementById("encounter-tool-styles")) return;

    const style = document.createElement("style");
    style.id = "encounter-tool-styles";
    style.textContent = `
      /* === Encounter / Initiative tool styles (scoped by .enc-tool) === */

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
        margin-bottom: 4px;
      }

      .enc-title-block {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .enc-title-kicker {
        font-size: 0.75rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--accent-soft, #9aa2b4);
      }

      .enc-title {
        font-size: 1.05rem;
        font-weight: 650;
        color: var(--accent-strong, #f5f5f5);
      }

      .enc-subtitle {
        font-size: 0.78rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-tag-pill {
        align-self: flex-start;
        padding: 3px 10px;
        border-radius: 999px;
        border: 1px solid var(--border-subtle, #2c3440);
        background: radial-gradient(circle at top left, #070a11, #05070c);
        font-size: 0.72rem;
        color: var(--accent-soft, #b0b7c6);
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .enc-tag-pill span {
        font-weight: 600;
        color: var(--accent-strong, #f5f5f5);
      }

      /* Single-column layout so it feels like one big tool in the panel */

      .enc-layout {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .enc-main-panel,
      .enc-right-panel {
        border-radius: 12px;
        border: 1px solid #222833;
        background: radial-gradient(circle at top left, #090d18, #05070c 70%);
        padding: 8px 10px;
      }

      .enc-box-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        gap: 6px;
      }

      .enc-box-title {
        font-size: 0.8rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--accent-soft, #9aa2b4);
      }

      .enc-box-title strong {
        font-weight: 600;
        color: var(--accent-strong, #f5f5f5);
      }

      .enc-hint {
        font-size: 0.72rem;
        color: var(--text-muted, #9ba1aa);
      }

      /* Tabs */

      .enc-tabs-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
      }

      .enc-tab {
        padding: 3px 10px;
        border-radius: 999px;
        border: 1px solid #2c3442;
        background: #05070c;
        font-size: 0.75rem;
        color: var(--text-muted, #9aa1aa);
        cursor: pointer;
        user-select: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition:
          background 0.12s ease-out,
          border-color 0.12s ease-out,
          color 0.12s ease-out,
          transform 0.06s ease-out;
      }

      .enc-tab span {
        font-size: 0.72rem;
        opacity: 0.8;
      }

      .enc-tab.active {
        background: linear-gradient(135deg, #151b29, #222b3a);
        border-color: #757f92;
        color: var(--accent-strong, #f5f5f5);
        transform: translateY(-0.5px);
      }

      .enc-tab:active {
        transform: translateY(0.5px) scale(0.99);
      }

      /* Summary row */

      .enc-summary-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 4px;
        font-size: 0.76rem;
      }

      .enc-summary-chip {
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid #232a33;
        background: #05070c;
        color: var(--accent-soft, #aeb5c4);
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .enc-summary-chip strong {
        color: var(--accent-strong, #f5f5f5);
      }

      /* Encounter cards list */

      .enc-cards {
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 260px;
        overflow-y: auto;
        padding-right: 2px;
      }

      .enc-cards::-webkit-scrollbar {
        width: 5px;
      }

      .enc-cards::-webkit-scrollbar-track {
        background: transparent;
      }

      .enc-cards::-webkit-scrollbar-thumb {
        background: #313745;
        border-radius: 999px;
      }

      .enc-card {
        border-radius: 11px;
        border: 1px solid #2c3442;
        background: #05070d;
        padding: 6px 8px;
        display: flex;
        align-items: stretch;
        gap: 8px;
        transition:
          background 0.12s ease-out,
          border-color 0.12s ease-out,
          transform 0.06s ease-out,
          box-shadow 0.06s ease-out;
      }

      .enc-card.current {
        border-color: #f5f5f5;
        box-shadow: 0 0 12px rgba(220, 220, 230, 0.35);
      }

      .enc-card.dead {
        border-color: #ff5c5c;
        background: radial-gradient(circle at top left, #301414, #120606);
        opacity: 0.7;
      }

      .enc-card-portrait {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 1px solid #3a414e;
        background: radial-gradient(circle at top, #141927, #080b13);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 0.76rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-card-portrait img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .enc-card-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .enc-name-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
      }

      .enc-name {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--accent-strong, #f5f5f5);
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .enc-type-pill {
        padding: 1px 7px;
        border-radius: 999px;
        border: 1px solid #313744;
        background: #05070c;
        font-size: 0.7rem;
        color: var(--accent-soft, #aeb5c4);
      }

      .enc-tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 0.7rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-tag-pill-sm {
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid #313744;
        background: #05070c;
      }

      .enc-meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.72rem;
        color: var(--accent-soft, #9aa2b4);
      }

      .enc-meta-row span strong {
        color: var(--accent-strong, #f5f5f5);
      }

      .enc-side-col {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        min-width: 140px;
      }

      .enc-hp-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .enc-hp-label {
        font-size: 0.78rem;
        color: var(--accent-strong, #f5f5f5);
      }

      .enc-hp-label span {
        color: var(--accent-soft, #aeb5c4);
      }

      .enc-hp-input {
        width: 48px;
        padding: 3px 4px;
        font-size: 0.78rem;
        text-align: center;
      }

      .enc-hp-buttons {
        display: flex;
        gap: 4px;
      }

      .enc-round-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        color: var(--accent-soft, #aeb5c4);
      }

      .enc-round-input {
        width: 36px;
        padding: 3px 4px;
        font-size: 0.78rem;
        text-align: center;
      }

      .enc-init-input {
        width: 38px;
        padding: 3px 4px;
        font-size: 0.78rem;
        text-align: center;
      }

      .enc-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 0.7rem;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-chip {
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid #313744;
        background: #05070c;
      }

      /* Add / edit form */

      .enc-form {
        margin-top: 6px;
        border-top: 1px dashed #252b37;
        padding-top: 6px;
      }

      .enc-form-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 4px;
      }

      .enc-form-field {
        flex: 1;
        min-width: 120px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.72rem;
      }

      .enc-form-field label {
        color: var(--text-muted, #9ba1aa);
      }

      .enc-form-field input {
        font-size: 0.78rem;
      }

      .enc-checkbox-row {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        margin-top: 2px;
        color: var(--text-muted, #9ba1aa);
      }

      .enc-form-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
        justify-content: flex-end;
      }

      .enc-parties-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }

      .enc-party-button {
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid #303641;
        background: #05070c;
        font-size: 0.74rem;
        color: var(--accent-strong, #f5f5f5);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .enc-party-button:hover {
        background: #161c2b;
      }

      .enc-party-label {
        font-size: 0.74rem;
        color: var(--text-muted, #9ba1aa);
        margin-top: 4px;
      }

      .enc-muted {
        font-size: 0.7rem;
        color: var(--text-muted, #9ba1aa);
      }

      @media (max-width: 720px) {
        .enc-side-col {
          min-width: 0;
          width: 100%;
          align-items: flex-start;
        }

        .enc-card {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- State helpers ----

  function createBlankEncounterState() {
    return {
      activeTab: "all",
      round: 1,
      combatants: [],
      currentId: null,
      savedParties: [
        {
          id: "default-party",
          name: "Core party",
          members: [
            {
              id: "p1",
              name: "PC A",
              type: "PC",
              ac: 15,
              hp: 35,
              maxHp: 35,
              init: 12,
              notes: "Frontliner"
            },
            {
              id: "p2",
              name: "PC B",
              type: "PC",
              ac: 14,
              hp: 30,
              maxHp: 30,
              init: 15,
              notes: "Blaster"
            }
          ]
        }
      ]
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function sortCombatantsForDisplay(combatants) {
    return [...combatants].sort((a, b) => {
      const ai = typeof a.init === "number" ? a.init : 0;
      const bi = typeof b.init === "number" ? b.init : 0;
      if (bi !== ai) return bi - ai;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  function filterCombatantsByTab(combatants, tab) {
    if (tab === "all") return combatants;
    if (tab === "pcs") return combatants.filter((c) => c.type === "PC");
    if (tab === "npcs") return combatants.filter((c) => c.type === "NPC");
    if (tab === "hostiles") return combatants.filter((c) => c.type === "Hostile");
    return combatants;
  }

  // ---- Rendering ----

  function renderEncounterTool({ labelEl, panelEl }) {
    injectStyles();

    labelEl.textContent = "Encounter / Initiative";

    let state = createBlankEncounterState();
    let formEditingId = null;

    const root = document.createElement("div");
    root.className = "enc-tool";

    root.innerHTML = `
      <div class="enc-header-row">
        <div class="enc-title-block">
          <div class="enc-title-kicker">Encounter control</div>
          <div class="enc-title">Encounter / Initiative</div>
          <div class="enc-subtitle">
            Quick initiative tracker + party shortcuts. Optimized for your Vrahune sessions.
          </div>
        </div>
        <div class="enc-tag-pill">
          <span>Live</span> ready for table use
        </div>
      </div>

      <div class="enc-layout">
        <div class="enc-main-panel">
          <div class="enc-box-header">
            <div class="enc-box-title">
              <strong>Active encounter</strong>
            </div>
            <div class="enc-hint">
              Track PCs, NPCs, and enemies in a clean initiative view.
            </div>
          </div>

          <div class="enc-tabs-row">
            <button class="enc-tab" data-tab="all">All</button>
            <button class="enc-tab" data-tab="pcs">PCs</button>
            <button class="enc-tab" data-tab="npcs">NPCs</button>
            <button class="enc-tab" data-tab="hostiles">Hostiles</button>
          </div>

          <div class="enc-summary-row" data-enc-summary></div>

          <div class="enc-cards" data-enc-cards></div>

          <div class="enc-form" data-enc-form>
            <div class="enc-form-row">
              <div class="enc-form-field">
                <label for="enc-name-input">Name</label>
                <input id="enc-name-input" type="text" placeholder="Name" />
              </div>
              <div class="enc-form-field">
                <label for="enc-type-input">Type</label>
                <input id="enc-type-input" type="text" placeholder="PC / NPC / Hostile" />
              </div>
              <div class="enc-form-field">
                <label for="enc-ac-input">AC</label>
                <input id="enc-ac-input" type="number" placeholder="15" />
              </div>
              <div class="enc-form-field">
                <label for="enc-hp-input">Max HP</label>
                <input id="enc-hp-input" type="number" placeholder="35" />
              </div>
              <div class="enc-form-field">
                <label for="enc-init-input">Init</label>
                <input id="enc-init-input" type="number" placeholder="12" />
              </div>
            </div>

            <div class="enc-form-row">
              <div class="enc-form-field">
                <label for="enc-speed-input">Speed</label>
                <input id="enc-speed-input" type="text" placeholder="30 ft." />
              </div>
              <div class="enc-form-field">
                <label for="enc-role-input">Role / Notes</label>
                <input id="enc-role-input" type="text" placeholder="Frontliner, caster, etc." />
              </div>
            </div>

            <div class="enc-form-buttons">
              <button type="button" class="btn-secondary btn-small" data-enc-clear-form>
                Clear
              </button>
              <button type="button" class="btn-primary btn-small" data-enc-add-update>
                Add to encounter
              </button>
            </div>

            <div class="enc-checkbox-row">
              <input id="enc-advance-current" type="checkbox" checked />
              <label for="enc-advance-current">
                Auto-select highest initiative as current when adding.
              </label>
            </div>
          </div>
        </div>

        <div class="enc-right-panel">
          <div class="enc-box-header">
            <div class="enc-box-title"><strong>Saved party</strong></div>
            <div class="enc-hint">Quick add your usual PCs.</div>
          </div>
          <div class="enc-party-label">
            In the real toolbox this will use browser storage. For now it’s a single demo party.
          </div>
          <div class="enc-parties-row" data-enc-parties></div>
          <div class="enc-muted" style="margin-top:6px;">
            Tip: tweak stats after you add them if they changed since last session.
          </div>
        </div>
      </div>
    `;

    panelEl.innerHTML = "";
    panelEl.appendChild(root);

    const tabs = Array.from(root.querySelectorAll(".enc-tab"));
    const summaryEl = root.querySelector("[data-enc-summary]");
    const cardsEl = root.querySelector("[data-enc-cards]");
    const partiesEl = root.querySelector("[data-enc-parties]");

    const nameInput = root.querySelector("#enc-name-input");
    const typeInput = root.querySelector("#enc-type-input");
    const acInput = root.querySelector("#enc-ac-input");
    const hpInput = root.querySelector("#enc-hp-input");
    const initInput = root.querySelector("#enc-init-input");
    const speedInput = root.querySelector("#enc-speed-input");
    const roleInput = root.querySelector("#enc-role-input");
    const clearBtn = root.querySelector("[data-enc-clear-form]");
    const addBtn = root.querySelector("[data-enc-add-update]");
    const advanceCurrentCheckbox = root.querySelector("#enc-advance-current");

    function updateTabs() {
      tabs.forEach((tab) => {
        const id = tab.getAttribute("data-tab");
        tab.classList.toggle("active", id === state.activeTab);
      });
    }

    function updateSummary() {
      const total = state.combatants.length;
      const pcs = state.combatants.filter((c) => c.type === "PC").length;
      const npcs = state.combatants.filter((c) => c.type === "NPC").length;
      const hostiles = state.combatants.filter((c) => c.type === "Hostile").length;
      const dead = state.combatants.filter((c) => c.dead).length;

      summaryEl.innerHTML = `
        <div class="enc-summary-chip">
          <strong>${total}</strong> in encounter
        </div>
        <div class="enc-summary-chip">
          PCs: <strong>${pcs}</strong>
        </div>
        <div class="enc-summary-chip">
          NPCs: <strong>${npcs}</strong>
        </div>
        <div class="enc-summary-chip">
          Hostiles: <strong>${hostiles}</strong>
        </div>
        <div class="enc-summary-chip">
          Down: <strong>${dead}</strong>
        </div>
      `;
    }

    function getDisplayCombatants() {
      const sorted = sortCombatantsForDisplay(state.combatants);
      return filterCombatantsByTab(sorted, state.activeTab);
    }

    function renderCards() {
      const list = getDisplayCombatants();
      cardsEl.innerHTML = "";

      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "enc-muted";
        empty.textContent = "No combatants yet. Add one below or use your saved party.";
        cardsEl.appendChild(empty);
        return;
      }

      list.forEach((c) => {
        const card = document.createElement("div");
        card.className = "enc-card";
        if (state.currentId === c.id) card.classList.add("current");
        if (c.dead) card.classList.add("dead");

        card.innerHTML = `
          <div class="enc-card-portrait">
            <span>${(c.name || "?")
              .split(" ")
              .map((p) => p[0] || "")
              .join("")
              .slice(0, 3)
              .toUpperCase()}</span>
          </div>
          <div class="enc-card-main">
            <div class="enc-name-row">
              <div class="enc-name">${c.name || "Unnamed"}</div>
              <div class="enc-type-pill">${c.type || "Unknown"}</div>
            </div>
            <div class="enc-tag-row">
              ${
                c.role
                  ? `<span class="enc-tag-pill-sm">${c.role}</span>`
                  : `<span class="enc-tag-pill-sm">No notes</span>`
              }
              ${
                c.speed
                  ? `<span class="enc-tag-pill-sm">Speed ${c.speed}</span>`
                  : `<span class="enc-tag-pill-sm">Speed ?</span>`
              }
            </div>
            <div class="enc-meta-row">
              <span>AC <strong>${c.ac ?? "?"}</strong></span>
              <span>Init <strong>${c.init ?? "?"}</strong></span>
              <span>HP <strong>${c.hp ?? "?"}</strong> / ${c.maxHp ?? "?"}</span>
            </div>
            <div class="enc-chip-row">
              <span class="enc-chip">Click to edit</span>
              <span class="enc-chip">Right-click to remove</span>
              <span class="enc-chip">Shift+Click toggles down</span>
            </div>
          </div>
          <div class="enc-side-col">
            <div class="enc-hp-row">
              <div class="enc-hp-label">
                HP <span>${c.hp ?? "?"}/${c.maxHp ?? "?"}</span>
              </div>
              <input class="enc-hp-input" type="number" placeholder="±" />
            </div>
            <div class="enc-hp-buttons">
              <button type="button" class="btn-secondary btn-tiny" data-action="damage">
                Dmg
              </button>
              <button type="button" class="btn-secondary btn-tiny" data-action="heal">
                Heal
              </button>
            </div>
            <div class="enc-round-row">
              <span>Round</span>
              <input class="enc-round-input" type="number" value="${state.round}" />
            </div>
            <div class="enc-round-row">
              <span>Init</span>
              <input class="enc-init-input" type="number" value="${c.init ?? ""}" />
            </div>
          </div>
        `;

        // Click to set current
        card.addEventListener("click", (ev) => {
          if (ev.shiftKey) {
            c.dead = !c.dead;
          } else {
            state.currentId = c.id;
          }
          updateSummary();
          renderCards();
        });

        // Right-click to remove
        card.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          const idx = state.combatants.findIndex((x) => x.id === c.id);
          if (idx !== -1) {
            state.combatants.splice(idx, 1);
            if (state.currentId === c.id) state.currentId = null;
            updateSummary();
            renderCards();
          }
        });

        // HP controls
        const hpInput = card.querySelector(".enc-hp-input");
        const dmgBtn = card.querySelector('button[data-action="damage"]');
        const healBtn = card.querySelector('button[data-action="heal"]');
        const roundInput = card.querySelector(".enc-round-input");
        const initInputCard = card.querySelector(".enc-init-input");

        function applyHpChange(sign) {
          const delta = parseInt(hpInput.value, 10);
          if (isNaN(delta)) return;
          const val = typeof c.hp === "number" ? c.hp : c.maxHp || 0;
          let next = val + sign * delta;
          const max = typeof c.maxHp === "number" ? c.maxHp : next;
          if (next > max) next = max;
          if (next < 0) next = 0;
          c.hp = next;
          hpInput.value = "";
          renderCards();
          updateSummary();
        }

        dmgBtn.addEventListener("click", () => applyHpChange(-1));
        healBtn.addEventListener("click", () => applyHpChange(1));

        roundInput.addEventListener("change", () => {
          const val = parseInt(roundInput.value, 10);
          if (!isNaN(val) && val >= 1) {
            state.round = val;
            renderCards();
          }
        });

        initInputCard.addEventListener("change", () => {
          const val = parseInt(initInputCard.value, 10);
          if (!isNaN(val)) {
            c.init = val;
            renderCards();
          }
        });

        cardsEl.appendChild(card);
      });
    }

    function renderParties() {
      partiesEl.innerHTML = "";
      if (!state.savedParties.length) {
        const empty = document.createElement("div");
        empty.className = "enc-muted";
        empty.textContent = "No saved parties yet.";
        partiesEl.appendChild(empty);
        return;
      }

      state.savedParties.forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "enc-party-button";
        btn.innerHTML = `
          <span>${p.name}</span>
          <span>(${p.members.length})</span>
        `;
        btn.addEventListener("click", () => {
          p.members.forEach((m) => {
            state.combatants.push({
              id: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              name: m.name,
              type: m.type,
              ac: m.ac,
              hp: m.hp,
              maxHp: m.maxHp,
              init: m.init,
              speed: m.speed,
              role: m.notes || m.role || ""
            });
          });
          if (advanceCurrentCheckbox.checked) {
            const sorted = sortCombatantsForDisplay(state.combatants);
            state.currentId = sorted.length ? sorted[0].id : null;
          }
          updateSummary();
          renderCards();
        });
        partiesEl.appendChild(btn);
      });
    }

    function clearForm() {
      formEditingId = null;
      nameInput.value = "";
      typeInput.value = "";
      acInput.value = "";
      hpInput.value = "";
      initInput.value = "";
      speedInput.value = "";
      roleInput.value = "";
    }

    function addOrUpdateFromForm() {
      const name = nameInput.value.trim();
      if (!name) return;

      const type = (typeInput.value || "").trim() || "PC";
      const ac = acInput.value ? parseInt(acInput.value, 10) : null;
      const hp = hpInput.value ? parseInt(hpInput.value, 10) : null;
      const init = initInput.value ? parseInt(initInput.value, 10) : null;
      const speed = speedInput.value.trim() || "";
      const role = roleInput.value.trim() || "";

      if (formEditingId) {
        const c = state.combatants.find((x) => x.id === formEditingId);
        if (c) {
          c.name = name;
          c.type = type;
          c.ac = ac;
          if (hp !== null) {
            c.maxHp = hp;
            if (typeof c.hp !== "number") c.hp = hp;
          }
          if (init !== null) c.init = init;
          c.speed = speed;
          c.role = role;
        }
      } else {
        const id = `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        state.combatants.push({
          id,
          name,
          type,
          ac,
          hp: hp ?? null,
          maxHp: hp ?? null,
          init,
          speed,
          role,
          dead: false
        });
        if (advanceCurrentCheckbox.checked) {
          const sorted = sortCombatantsForDisplay(state.combatants);
          state.currentId = sorted.length ? sorted[0].id : null;
        }
      }

      clearForm();
      updateSummary();
      renderCards();
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-tab");
        state.activeTab = id;
        updateTabs();
        renderCards();
      });
    });

    clearBtn.addEventListener("click", () => {
      clearForm();
    });

    addBtn.addEventListener("click", () => {
      addOrUpdateFromForm();
    });

    // Initial render
    updateTabs();
    updateSummary();
    renderCards();
    renderParties();
  }

  window.registerTool({
    id: "encounterTool",
    name: "Encounter / Initiative",
    description: "Slick initiative tracker with quick-add parties.",
    render: renderEncounterTool
  });
})();
