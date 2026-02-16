// tool-encounter.js – Encounter / Initiative tool (modular, uses registerTool)
(function () {
  const STORAGE_KEY_STATE = "vrahuneEncounterStateV1";
  const STORAGE_KEY_PARTY = "vrahuneEncounterPartyV1";

  let stateLoaded = false;
  let encounterRound = 1;
  let activeIndex = 0;
  let combatants = [];
  let savedParty = [];
  let editId = null;
  let dragId = null;

  // --- 1. Inject styles (scoped, uses enc-* button classes) ---
  function ensureStyles() {
    if (window.__encounterToolStylesInjected) return;
    window.__encounterToolStylesInjected = true;

    const style = document.createElement("style");
    style.textContent = `
:root {
  --bg-elevated: #050814;
  --bg-elevated-soft: rgba(12, 16, 40, 0.96);
  --bg-elevated-softer: rgba(14, 23, 51, 0.92);
  --bg-elevated-alt: rgba(16, 24, 54, 0.98);
  --border-subtle: rgba(120, 160, 255, 0.16);
  --border-strong: rgba(140, 180, 255, 0.28);
  --accent: #7b8fff;
  --accent-soft: rgba(123, 143, 255, 0.14);
  --accent-soft-strong: rgba(123, 143, 255, 0.23);
  --accent-muted: #a0affe;
  --accent-strong: #c8d0ff;
  --accent-danger: #ff6f91;
  --accent-danger-soft: rgba(255, 111, 145, 0.12);
  --accent-success: #4cd4a8;
  --accent-success-soft: rgba(76, 212, 168, 0.1);
  --text-main: #f5f7ff;
  --text-soft: #b0b6d8;
  --text-softer: #8a90b0;
  --text-muted: #6b7194;
  --text-strong: #ffffff;
  --shadow-soft: 0 18px 40px rgba(0, 0, 0, 0.54);
  --shadow-subtile: 0 10px 32px rgba(0, 0, 0, 0.35);
  --glass-strong: rgba(8, 12, 30, 0.96);
  --glass-soft: rgba(16, 24, 60, 0.85);
  --glass-ultra: rgba(8, 12, 30, 0.98);
}

.preview-shell {
  background: radial-gradient(circle at top left, rgba(120, 150, 255, 0.12), transparent 60%),
              radial-gradient(circle at top right, rgba(120, 255, 230, 0.12), transparent 60%),
              radial-gradient(circle at bottom, rgba(255, 120, 180, 0.08), transparent 60%),
              linear-gradient(135deg, #050716, #050814 55%, #050716 100%);
  border-radius: 20px;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(120, 160, 255, 0.22);
  padding: 14px 16px 16px;
  color: var(--text-main);
  max-width: 780px;
  margin-inline: auto;
  box-sizing: border-box;
}

.header-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.header-subtitle {
  font-size: 11px;
  color: var(--text-soft);
}

.header-side {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-pill {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(128, 164, 255, 0.5);
  background: radial-gradient(circle at top left, rgba(120, 160, 255, 0.2), rgba(20, 30, 70, 0.98));
  color: var(--accent-strong);
  white-space: nowrap;
}

.tabs-row {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(123, 143, 255, 0.18);
  background: radial-gradient(circle at top, rgba(123, 143, 255, 0.25), rgba(12, 16, 40, 0.95));
  padding: 2px;
  margin-bottom: 12px;
}

.tabs-row .tab {
  border-radius: 999px;
  border: none;
  padding: 5px 12px;
  font-size: 11px;
  color: var(--text-soft);
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease-out;
}

.tabs-row .tab.active {
  background: linear-gradient(135deg, rgba(120, 170, 255, 0.38), rgba(140, 255, 228, 0.38));
  color: #050814;
  font-weight: 600;
  box-shadow: 0 0 0 1px rgba(200, 230, 255, 0.4);
}

.enc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1.25fr);
  gap: 14px;
  align-items: flex-start;
}

.enc-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Buttons, scoped */
.enc-btn {
  border-radius: 999px;
  border: 1px solid rgba(128, 164, 255, 0.7);
  background: radial-gradient(circle at top, rgba(140, 180, 255, 0.4), rgba(16, 24, 60, 0.96));
  color: #050814;
  font-weight: 600;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);
  white-space: nowrap;
}

.enc-btn-secondary {
  border-color: rgba(120, 160, 255, 0.55);
  background: linear-gradient(135deg, rgba(20, 28, 75, 0.98), rgba(20, 30, 90, 0.98));
  color: var(--accent-strong);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
}

.enc-btn-xs {
  font-size: 10px;
  padding: 3px 8px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
}

.enc-btn-icon {
  border-radius: 999px;
  border: 1px solid rgba(120, 160, 255, 0.42);
  background: radial-gradient(circle at top, rgba(140, 180, 255, 0.35), rgba(10, 16, 40, 0.96));
  color: #050814;
  font-size: 12px;
  width: 20px;
  height: 20px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Round box */
.round-box {
  border-radius: 14px;
  background: radial-gradient(circle at top, rgba(123, 143, 255, 0.25), rgba(12, 16, 40, 0.96));
  border: 1px solid rgba(140, 180, 255, 0.38);
  padding: 8px 10px;
}

.round-box-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.round-label {
  font-size: 11px;
  color: var(--text-soft);
}

.round-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.round-btn {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid rgba(140, 180, 255, 0.75);
  background: radial-gradient(circle at top, rgba(140, 180, 255, 0.6), rgba(10, 14, 40, 0.96));
  color: #050814;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.round-number {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-strong);
  min-width: 18px;
  text-align: center;
}

.round-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Party strip */
.party-box {
  border-radius: 12px;
  background: rgba(10, 14, 40, 0.98);
  border: 1px solid rgba(120, 160, 255, 0.22);
  padding: 7px 8px 8px;
}

.party-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.party-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.party-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.party-chip {
  border-radius: 999px;
  border: 1px solid rgba(123, 143, 255, 0.3);
  padding: 3px 8px;
  font-size: 10px;
  background: radial-gradient(circle at top, rgba(123, 143, 255, 0.24), rgba(15, 20, 50, 0.98));
  color: var(--accent-strong);
  cursor: pointer;
}

.party-chip.pc {
  border-color: rgba(140, 255, 220, 0.35);
  background: radial-gradient(circle at top, rgba(140, 255, 220, 0.24), rgba(15, 30, 50, 0.98));
}

.party-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Initiative column */
.initiative-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.initiative-title {
  font-size: 12px;
  font-weight: 600;
}

.initiative-subtitle {
  font-size: 10px;
  color: var(--text-soft);
}

.initiative-box {
  border-radius: 14px;
  background: rgba(8, 10, 30, 0.98);
  border: 1px solid rgba(120, 160, 255, 0.28);
  padding: 7px 8px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
}

.initiative-scroller {
  overflow-y: auto;
  padding-right: 2px;
}

.initiative-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Cards */
.card {
  position: relative;
  border-radius: 12px;
  border: 1px solid rgba(110, 150, 255, 0.28);
  background: radial-gradient(circle at top left, rgba(120, 160, 255, 0.25), rgba(10, 14, 40, 0.98));
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  padding: 6px 7px;
  display: flex;
  gap: 6px;
  cursor: grab;
}

.card.active-turn {
  border-color: rgba(178, 250, 210, 0.85);
  box-shadow: 0 0 0 1px rgba(178, 250, 228, 0.6), 0 14px 45px rgba(0, 0, 0, 0.7);
}

.card.enemy-card {
  background: radial-gradient(circle at top left, rgba(255, 132, 132, 0.22), rgba(20, 8, 20, 0.98));
  border-color: rgba(255, 132, 132, 0.5);
}

.card.dead-card {
  opacity: 0.6;
  border-style: dashed;
}

.card-main {
  display: flex;
  gap: 7px;
  width: 100%;
}

.card-portrait {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: radial-gradient(circle at top, rgba(140, 180, 255, 0.85), rgba(15, 22, 60, 0.98));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #050814;
  flex-shrink: 0;
}

.card.dead-card .card-portrait {
  filter: grayscale(0.9);
  opacity: 0.85;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-name {
  font-size: 12px;
  font-weight: 600;
}

.card-tag {
  font-size: 10px;
  color: var(--accent-muted);
}

.hp-block {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) auto auto;
  gap: 4px;
  align-items: center;
}

.hp-label {
  font-size: 11px;
  color: var(--accent-strong);
}

.hp-amount-input {
  width: 54px;
  border-radius: 999px;
  border: 1px solid rgba(140, 180, 255, 0.6);
  background: rgba(10, 14, 40, 0.96);
  color: var(--accent-strong);
  font-size: 11px;
  padding: 2px 6px;
}

.hp-buttons {
  display: inline-flex;
  gap: 3px;
}

.card-meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-soft);
}

/* Right column panels */
.enc-panel {
  border-radius: 14px;
  background: rgba(8, 12, 30, 0.98);
  border: 1px solid rgba(120, 160, 255, 0.3);
  padding: 8px 9px 9px;
}

.panel-header {
  margin-bottom: 7px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
}

.panel-subtitle {
  font-size: 10px;
  color: var(--text-soft);
}

.enc-form-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.enc-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.enc-field-small {
  max-width: 90px;
}

.enc-field-label {
  font-size: 10px;
  color: var(--text-soft);
}

.enc-input {
  border-radius: 8px;
  border: 1px solid rgba(120, 160, 255, 0.4);
  background: rgba(10, 14, 40, 0.98);
  color: var(--accent-strong);
  font-size: 11px;
  padding: 3px 7px;
}

.enc-form-actions {
  display: flex;
  gap: 4px;
}

.encounter-library {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.library-note {
  font-size: 10px;
  color: var(--text-soft);
}

.library-entry {
  border-radius: 10px;
  border: 1px solid rgba(120, 160, 255, 0.35);
  background: radial-gradient(circle at top, rgba(123, 143, 255, 0.3), rgba(8, 12, 30, 0.98));
  padding: 6px 7px;
}

.library-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-muted);
  margin-bottom: 2px;
}

.library-name {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
}

.library-text {
  font-size: 10px;
  color: var(--text-soft);
}

.muted {
  color: var(--text-soft);
}

@media (max-width: 720px) {
  .enc-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
    `;
    document.head.appendChild(style);
  }

  // --- 2. State load/save ---

  function loadState() {
    if (stateLoaded) return;
    stateLoaded = true;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.combatants)) {
          combatants = parsed.combatants;
          encounterRound = parsed.round || 1;
          activeIndex = parsed.activeIndex || 0;
        }
      } else {
        // Seed like the mockup
        combatants = [
          {
            id: "pc-vesper",
            name: "Vesper",
            type: "PC",
            role: "pc",
            ac: 17,
            maxHp: 42,
            currentHp: 29,
            speed: 30,
            initiative: 18,
          },
          {
            id: "pc-aranis",
            name: "Arannis",
            type: "PC",
            role: "pc",
            ac: 16,
            maxHp: 36,
            currentHp: 36,
            speed: 30,
            initiative: 15,
          },
          {
            id: "goblin-1",
            name: "Goblin Skirmisher",
            type: "Enemy",
            role: "enemy",
            ac: 14,
            maxHp: 22,
            currentHp: 0,
            speed: 30,
            initiative: 12,
          },
        ];
        encounterRound = 3;
        activeIndex = 1;
      }
    } catch (e) {
      console.error("Failed to load encounter state", e);
    }

    try {
      const rawParty = window.localStorage.getItem(STORAGE_KEY_PARTY);
      if (rawParty) {
        const parsedParty = JSON.parse(rawParty);
        if (Array.isArray(parsedParty)) savedParty = parsedParty;
      } else {
        savedParty = [
          { id: "pc-vesper", name: "Vesper", role: "pc", ac: 17, maxHp: 42, speed: 30 },
          { id: "pc-aranis", name: "Arannis", role: "pc", ac: 16, maxHp: 36, speed: 30 },
          { id: "pc-selvor", name: "Selvor", role: "pc", ac: 15, maxHp: 34, speed: 30 },
        ];
      }
    } catch (e) {
      console.error("Failed to load encounter party", e);
    }
  }

  function saveState() {
    try {
      const data = {
        round: encounterRound,
        activeIndex,
        combatants,
      };
      window.localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save encounter state", e);
    }
  }

  function saveParty() {
    try {
      window.localStorage.setItem(STORAGE_KEY_PARTY, JSON.stringify(savedParty));
    } catch (e) {
      console.error("Failed to save encounter party", e);
    }
  }

  // --- 3. Helpers & render pieces ---

  function getRoot() {
    return document.querySelector(".encounter-tool-root");
  }

  function sortCombatants() {
    combatants.sort((a, b) => {
      const ai = typeof a.initiative === "number" ? a.initiative : 0;
      const bi = typeof b.initiative === "number" ? b.initiative : 0;
      if (bi !== ai) return bi - ai;
      return (a.name || "").localeCompare(b.name || "");
    });
    if (activeIndex < 0 || activeIndex >= combatants.length) {
      activeIndex = combatants.length ? 0 : -1;
    }
  }

  function renderRound(root) {
    const span = root.querySelector("#enc-round-number");
    if (span) span.textContent = String(encounterRound);
  }

  function renderPartyStrip(root) {
    const strip = root.querySelector(".party-strip");
    if (!strip) return;
    const existingStatic = strip.querySelectorAll(".party-chip[data-party-static]");
    existingStatic.forEach((el) => el.remove());
    savedParty.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "party-chip pc";
      btn.dataset.partyId = p.id;
      btn.dataset.partyStatic = "1";
      btn.textContent = p.name;
      strip.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function combatantToCardHtml(c, index) {
    const isActive = index === activeIndex;
    const isDead = c.currentHp <= 0;
    const roleClass = c.role === "enemy" ? "enemy-card" : "pc-card";
    const deadClass = isDead ? "dead-card" : "";
    const activeClass = isActive ? "active-turn" : "";
    const initial = (c.name || "?").trim().charAt(0).toUpperCase() || "?";
    const ac = c.ac != null ? c.ac : "—";
    const speed = c.speed != null ? c.speed : "—";
    const cur = c.currentHp != null ? c.currentHp : c.maxHp || 0;
    const max = c.maxHp != null ? c.maxHp : cur || 0;
    const typeLabel = c.type || (c.role === "enemy" ? "Enemy" : "PC");

    return `
      <div class="card ${roleClass} ${deadClass} ${activeClass}" data-id="${escapeHtml(
        c.id
      )}" draggable="true">
        <div class="card-main">
          <div class="card-portrait" title="Portrait">${escapeHtml(initial)}</div>
          <div class="card-content">
            <div class="name-block">
              <div class="name-row">
                <span class="card-name">${escapeHtml(c.name || "")}</span>
                <span class="card-tag">${escapeHtml(typeLabel)}</span>
              </div>
            </div>
            <div class="hp-block">
              <span class="hp-label">HP: ${cur} / <strong>${max}</strong></span>
              <input class="hp-amount-input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="">
              <div class="hp-buttons">
                <button class="enc-btn enc-btn-xs hp-damage-btn" type="button">Damage</button>
                <button class="enc-btn enc-btn-secondary enc-btn-xs hp-heal-btn" type="button">Heal</button>
              </div>
            </div>
            <div class="card-meta">
              <div class="card-meta-top">
                <span>AC: ${ac}</span>
                <span>Spd: ${speed} ft</span>
                <button class="enc-btn-icon remove-combatant-btn" type="button" title="Remove">×</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCards(root) {
    const list = root.querySelector("#enc-initiative-list");
    if (!list) return;
    sortCombatants();
    const html = combatants.map((c, idx) => combatantToCardHtml(c, idx)).join("");
    list.innerHTML =
      html ||
      '<div class="muted" style="padding:4px 6px;">No combatants yet. Use “Add combatant” or the Saved party buttons.</div>';
  }

  function clearForm(root) {
    editId = null;
    const nameEl = root.querySelector("#enc-name-input");
    const typeEl = root.querySelector("#enc-type-input");
    const initEl = root.querySelector("#enc-init-input");
    const acEl = root.querySelector("#enc-ac-input");
    const maxHpEl = root.querySelector("#enc-maxhp-input");
    const speedEl = root.querySelector("#enc-speed-input");
    if (nameEl) nameEl.value = "";
    if (typeEl) typeEl.value = "pc";
    if (initEl) initEl.value = "";
    if (acEl) acEl.value = "";
    if (maxHpEl) maxHpEl.value = "";
    if (speedEl) speedEl.value = "";
    const modeLabel = root.querySelector("#enc-form-mode-label");
    if (modeLabel) modeLabel.textContent = "Add combatant";
  }

  function fillFormForEdit(root, c) {
    editId = c.id;
    const nameEl = root.querySelector("#enc-name-input");
    const typeEl = root.querySelector("#enc-type-input");
    const initEl = root.querySelector("#enc-init-input");
    const acEl = root.querySelector("#enc-ac-input");
    const maxHpEl = root.querySelector("#enc-maxhp-input");
    const speedEl = root.querySelector("#enc-speed-input");
    if (nameEl) nameEl.value = c.name || "";
    if (typeEl) typeEl.value = c.role || "pc";
    if (initEl) initEl.value = c.initiative != null ? String(c.initiative) : "";
    if (acEl) acEl.value = c.ac != null ? String(c.ac) : "";
    if (maxHpEl) maxHpEl.value = c.maxHp != null ? String(c.maxHp) : "";
    if (speedEl) speedEl.value = c.speed != null ? String(c.speed) : "";
    const modeLabel = root.querySelector("#enc-form-mode-label");
    if (modeLabel) modeLabel.textContent = "Edit combatant";
  }

  function addOrUpdateFromForm(root) {
    const nameEl = root.querySelector("#enc-name-input");
    const typeEl = root.querySelector("#enc-type-input");
    const initEl = root.querySelector("#enc-init-input");
    const acEl = root.querySelector("#enc-ac-input");
    const maxHpEl = root.querySelector("#enc-maxhp-input");
    const speedEl = root.querySelector("#enc-speed-input");

    if (!nameEl || !typeEl) return;
    const name = (nameEl.value || "").trim();
    if (!name) return;

    const role = typeEl.value || "pc";
    const typeLabel = role === "enemy" ? "Enemy" : role === "npc" ? "NPC" : "PC";
    const initiative = parseInt(initEl && initEl.value ? initEl.value : "0", 10) || 0;
    const ac = parseInt(acEl && acEl.value ? acEl.value : "0", 10) || 0;
    const maxHp = parseInt(maxHpEl && maxHpEl.value ? maxHpEl.value : "0", 10) || 0;
    const speed = parseInt(speedEl && speedEl.value ? speedEl.value : "0", 10) || 0;

    if (editId) {
      const idx = combatants.findIndex((c) => c.id === editId);
      if (idx !== -1) {
        const c = combatants[idx];
        c.name = name;
        c.role = role;
        c.type = typeLabel;
        c.initiative = initiative;
        c.ac = ac;
        c.maxHp = maxHp;
        if (c.currentHp == null || c.currentHp > maxHp) {
          c.currentHp = maxHp;
        }
        c.speed = speed;
      }
    } else {
      const id = "c-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
      combatants.push({
        id,
        name,
        role,
        type: typeLabel,
        initiative,
        ac,
        maxHp,
        currentHp: maxHp,
        speed,
      });
      activeIndex = combatants.length - 1;
    }

    saveState();
    renderCards(root);
    clearForm(root);
  }

  function adjustHp(root, cardEl, delta) {
    const id = cardEl && cardEl.getAttribute("data-id");
    if (!id) return;
    const idx = combatants.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const c = combatants[idx];
    const max = c.maxHp != null ? c.maxHp : 0;
    let cur = c.currentHp != null ? c.currentHp : max;
    cur += delta;
    if (cur < 0) cur = 0;
    if (max && cur > max) cur = max;
    c.currentHp = cur;
    saveState();
    renderCards(root);
  }

  function moveActiveNext(root, advanceRound) {
    if (!combatants.length) return;
    const len = combatants.length;
    let newIndex = activeIndex;
    for (let step = 1; step <= len; step++) {
      const candidate = (activeIndex + step) % len;
      const c = combatants[candidate];
      if (!c || c.currentHp <= 0) continue;
      newIndex = candidate;
      break;
    }
    activeIndex = newIndex;
    if (advanceRound) {
      encounterRound += 1;
      renderRound(root);
    }
    saveState();
    renderCards(root);
  }

  function removeCombatant(root, cardEl) {
    const id = cardEl && cardEl.getAttribute("data-id");
    if (!id) return;
    const idx = combatants.findIndex((c) => c.id === id);
    if (idx === -1) return;
    combatants.splice(idx, 1);
    if (activeIndex >= combatants.length) {
      activeIndex = combatants.length ? combatants.length - 1 : -1;
    }
    saveState();
    renderCards(root);
  }

  function startEditFromCard(root, cardEl) {
    const id = cardEl && cardEl.getAttribute("data-id");
    if (!id) return;
    const c = combatants.find((x) => x.id === id);
    if (!c) return;
    fillFormForEdit(root, c);
  }

  function addPartyMember(root, partyId) {
    const tmpl = savedParty.find((p) => p.id === partyId);
    if (!tmpl) return;
    const id = "c-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
    combatants.push({
      id,
      name: tmpl.name,
      role: tmpl.role || "pc",
      type: "PC",
      initiative: 10,
      ac: tmpl.ac || 0,
      maxHp: tmpl.maxHp || 0,
      currentHp: tmpl.maxHp || 0,
      speed: tmpl.speed || 30,
    });
    activeIndex = combatants.length - 1;
    saveState();
    renderCards(root);
  }

  // --- 4. Drag & drop ---

  function onDragStart(e) {
    const card = e.target.closest(".card");
    if (!card) return;
    dragId = card.getAttribute("data-id");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function onDragOver(e) {
    const card = e.target.closest(".card");
    if (!card) return;
    if (dragId == null) return;
    e.preventDefault();
  }

  function onDrop(root, e) {
    const card = e.target.closest(".card");
    if (!card || dragId == null) return;
    e.preventDefault();
    const targetId = card.getAttribute("data-id");
    if (!targetId || targetId === dragId) {
      dragId = null;
      return;
    }
    const fromIdx = combatants.findIndex((c) => c.id === dragId);
    const toIdx = combatants.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      dragId = null;
      return;
    }
    const [moved] = combatants.splice(fromIdx, 1);
    combatants.splice(toIdx, 0, moved);
    if (activeIndex === fromIdx) {
      activeIndex = toIdx;
    } else if (fromIdx < activeIndex && toIdx >= activeIndex) {
      activeIndex -= 1;
    } else if (fromIdx > activeIndex && toIdx <= activeIndex) {
      activeIndex += 1;
    }
    saveState();
    renderCards(root);
    dragId = null;
  }

  // --- 5. Main render for this tool ---

  function renderEncounterUI(labelEl, panelEl) {
    labelEl.textContent = "Encounter / Initiative";

    panelEl.innerHTML = `
      <div class="encounter-tool-root">
        <div class="preview-shell encounter-shell">
          <div class="header-line">
            <div class="header-main">
              <div class="header-title">Encounter / Initiative</div>
              <div class="header-subtitle">Track turn order, HP, and party for any combat or tense scene.</div>
            </div>
            <div class="header-side">
              <span class="label-pill">Tool · Right Panel</span>
            </div>
          </div>

          <div class="tabs-row">
            <button class="tab active" type="button" id="enc-tab-active">Active encounter</button>
            <button class="tab" type="button" id="enc-tab-library">Encounter library</button>
          </div>

          <div class="enc-layout">
            <div class="enc-col">
              <div class="round-box">
                <div class="round-box-inner">
                  <div class="round-label">Round</div>
                  <div class="round-controls">
                    <button class="round-btn" type="button" id="enc-round-prev">−</button>
                    <div class="round-number" id="enc-round-number">1</div>
                    <button class="round-btn" type="button" id="enc-round-next">+</button>
                  </div>
                  <div class="round-info">
                    <button class="enc-btn enc-btn-xs" type="button" id="enc-next-turn">Next turn</button>
                    <button class="enc-btn enc-btn-secondary enc-btn-xs" type="button" id="enc-next-round">Next round</button>
                    <button class="enc-btn enc-btn-xs" type="button" id="enc-round-reset">Reset</button>
                  </div>
                </div>
              </div>

              <div class="party-box">
                <div class="party-header">
                  <span class="party-title">Saved party</span>
                </div>
                <div class="party-strip">
                  <!-- party chips injected here -->
                </div>
                <div class="party-actions">
                  <button class="enc-btn enc-btn-xs" type="button" id="enc-add-full-party">Add full party</button>
                  <button class="enc-btn enc-btn-secondary enc-btn-xs" type="button" id="enc-manage-party">Manage party</button>
                </div>
              </div>

              <div class="initiative-header">
                <div class="initiative-title">Turn order</div>
                <div class="initiative-subtitle">Drag cards up/down to set initiative.</div>
              </div>

              <div class="initiative-box">
                <div class="initiative-scroller">
                  <div class="initiative-list" id="enc-initiative-list"></div>
                </div>
              </div>
            </div>

            <div class="enc-col">
              <div class="enc-panel enc-panel-active" id="enc-active-panel">
                <div class="panel-header">
                  <div class="panel-title">
                    <span id="enc-form-mode-label">Add combatant</span>
                  </div>
                  <div class="panel-subtitle">Quickly add PCs, NPCs, and monsters.</div>
                </div>

                <div class="enc-form-row">
                  <div class="enc-field">
                    <label class="enc-field-label" for="enc-name-input">Name</label>
                    <input id="enc-name-input" class="enc-input" type="text" placeholder="Goblin, Vesper, Untitled Horror..." />
                  </div>
                  <div class="enc-field enc-field-small">
                    <label class="enc-field-label" for="enc-type-input">Type</label>
                    <select id="enc-type-input" class="enc-input">
                      <option value="pc">PC</option>
                      <option value="npc">NPC</option>
                      <option value="enemy">Enemy</option>
                    </select>
                  </div>
                  <div class="enc-field enc-field-small">
                    <label class="enc-field-label" for="enc-init-input">Init</label>
                    <input id="enc-init-input" class="enc-input" type="number" inputmode="numeric" />
                  </div>
                </div>

                <div class="enc-form-row">
                  <div class="enc-field enc-field-small">
                    <label class="enc-field-label" for="enc-ac-input">AC</label>
                    <input id="enc-ac-input" class="enc-input" type="number" inputmode="numeric" />
                  </div>
                  <div class="enc-field enc-field-small">
                    <label class="enc-field-label" for="enc-maxhp-input">Max HP</label>
                    <input id="enc-maxhp-input" class="enc-input" type="number" inputmode="numeric" />
                  </div>
                  <div class="enc-field enc-field-small">
                    <label class="enc-field-label" for="enc-speed-input">Speed</label>
                    <input id="enc-speed-input" class="enc-input" type="number" inputmode="numeric" placeholder="30" />
                  </div>
                </div>

                <div class="enc-form-actions">
                  <button class="enc-btn enc-btn-xs" type="button" id="enc-add-btn">Save / Add to encounter</button>
                  <button class="enc-btn enc-btn-secondary enc-btn-xs" type="button" id="enc-clear-btn">Clear</button>
                </div>
              </div>

              <div class="enc-panel enc-panel-library" id="enc-library-panel" style="display:none;">
                <div class="panel-header">
                  <div class="panel-title">Encounter library</div>
                  <div class="panel-subtitle">Scratch space for possible fights.</div>
                </div>
                <div class="encounter-library">
                  <div class="library-note muted">
                    This is intentionally light: jot down rough ideas, not full stat blocks.
                  </div>
                  <div class="library-entry">
                    <div class="library-tag">Skirmish</div>
                    <div class="library-name">Harbor ambush</div>
                    <div class="library-text muted">
                      3x bandit, 1x thug, 1x spellcaster on the docks. Use crates as half-cover. Reinforcements arrive on round 3 if loud.
                    </div>
                  </div>
                  <div class="library-entry">
                    <div class="library-tag">Boss</div>
                    <div class="library-name">Wolf Idol avatar</div>
                    <div class="library-text muted">
                      Werewolf leader + corrupted druid channeling the Frostclaw idol. Difficult terrain from ice and broken stone.
                    </div>
                  </div>
                  <div class="library-entry">
                    <div class="library-tag">Social</div>
                    <div class="library-name">Gala infiltration</div>
                    <div class="library-text muted">
                      Track “rounds” as phases of the party: arrival, mingling, suspicion, escalation, fallout.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const root = getRoot();
    if (!root) return;
    renderRound(root);
    renderPartyStrip(root);
    renderCards(root);
  }

  // --- 6. Global handlers (delegated) ---

  function setupGlobalHandlers() {
    if (window.__encounterToolHandlersSetup) return;
    window.__encounterToolHandlersSetup = true;

    document.addEventListener("click", function (e) {
      const root = e.target.closest(".encounter-tool-root");
      if (!root) return;

      if (e.target.id === "enc-round-prev") {
        if (encounterRound > 1) {
          encounterRound -= 1;
          renderRound(root);
          saveState();
        }
        return;
      }
      if (e.target.id === "enc-round-next") {
        encounterRound += 1;
        renderRound(root);
        saveState();
        return;
      }
      if (e.target.id === "enc-round-reset") {
        encounterRound = 1;
        activeIndex = 0;
        saveState();
        renderRound(root);
        renderCards(root);
        return;
      }
      if (e.target.id === "enc-next-turn") {
        moveActiveNext(root, false);
        return;
      }
      if (e.target.id === "enc-next-round") {
        moveActiveNext(root, true);
        return;
      }
      if (e.target.id === "enc-add-btn") {
        addOrUpdateFromForm(root);
        return;
      }
      if (e.target.id === "enc-clear-btn") {
        clearForm(root);
        return;
      }
      if (e.target.id === "enc-add-full-party") {
        savedParty.forEach((p) => addPartyMember(root, p.id));
        return;
      }
      if (e.target.id === "enc-manage-party") {
        window.alert(
          "Party management is not fully implemented yet – for now this just auto-loads Vesper, Arannis, Selvor as defaults."
        );
        return;
      }
      if (e.target.classList.contains("party-chip") && e.target.dataset.partyId) {
        addPartyMember(root, e.target.dataset.partyId);
        return;
      }
      if (e.target.id === "enc-tab-active") {
        const activePanel = root.querySelector("#enc-active-panel");
        const libraryPanel = root.querySelector("#enc-library-panel");
        if (activePanel && libraryPanel) {
          activePanel.style.display = "";
          libraryPanel.style.display = "none";
        }
        const activeTab = root.querySelector("#enc-tab-active");
        const libTab = root.querySelector("#enc-tab-library");
        if (activeTab) activeTab.classList.add("active");
        if (libTab) libTab.classList.remove("active");
        return;
      }
      if (e.target.id === "enc-tab-library") {
        const activePanel = root.querySelector("#enc-active-panel");
        const libraryPanel = root.querySelector("#enc-library-panel");
        if (activePanel && libraryPanel) {
          activePanel.style.display = "none";
          libraryPanel.style.display = "";
        }
        const activeTab = root.querySelector("#enc-tab-active");
        const libTab = root.querySelector("#enc-tab-library");
        if (activeTab) activeTab.classList.remove("active");
        if (libTab) libTab.classList.add("active");
        return;
      }

      const damageBtn = e.target.closest(".hp-damage-btn");
      if (damageBtn) {
        const card = damageBtn.closest(".card");
        if (!card) return;
        const input = card.querySelector(".hp-amount-input");
        const val = input && input.value ? parseInt(input.value, 10) : 0;
        if (val) {
          adjustHp(root, card, -Math.abs(val));
          input.value = "";
        }
        return;
      }

      const healBtn = e.target.closest(".hp-heal-btn");
      if (healBtn) {
        const card = healBtn.closest(".card");
        if (!card) return;
        const input = card.querySelector(".hp-amount-input");
        const val = input && input.value ? parseInt(input.value, 10) : 0;
        if (val) {
          adjustHp(root, card, Math.abs(val));
          input.value = "";
        }
        return;
      }

      const removeBtn = e.target.closest(".remove-combatant-btn");
      if (removeBtn) {
        const card = removeBtn.closest(".card");
        if (!card) return;
        if (window.confirm("Remove this combatant from the encounter?")) {
          removeCombatant(root, card);
        }
        return;
      }

      const cardForEdit = e.target.closest(".card");
      if (cardForEdit && !e.target.closest(".hp-buttons") && !e.target.closest(".enc-btn-icon")) {
        startEditFromCard(root, cardForEdit);
        return;
      }
    });

    document.addEventListener("dragstart", function (e) {
      const root = e.target.closest(".encounter-tool-root");
      if (!root) return;
      onDragStart(e);
    });

    document.addEventListener("dragover", function (e) {
      const root = e.target.closest(".encounter-tool-root");
      if (!root) return;
      onDragOver(e);
    });

    document.addEventListener("drop", function (e) {
      const root = e.target.closest(".encounter-tool-root");
      if (!root) return;
      onDrop(root, e);
    });
  }

  // --- 7. Register with your toolbox system ---

  if (window.registerTool) {
    ensureStyles();
    loadState();
    setupGlobalHandlers();

    window.registerTool({
      id: "encounter",
      name: "Encounter / Initiative",
      description: "Track initiative, HP, and rounds for any combat or tense scene.",
      render: function (ctx) {
        ensureStyles();
        loadState();
        setupGlobalHandlers();
        renderEncounterUI(ctx.labelEl, ctx.panelEl);
      },
    });
  } else {
    console.warn(
      "Encounter tool: window.registerTool not found. Make sure app.js defines it before loading this script."
    );
  }
})();
