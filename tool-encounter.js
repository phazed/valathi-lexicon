// tool-encounter.js
// Adds an Encounter / Initiative tool to the Vrahune Toolbox
// Requires: app.js already loaded (so window.toolsConfig, window.renderToolPanel, window.renderToolsNav exist)

(function () {
  const STORAGE_ENCOUNTER_KEY = "vrahuneEncounterV1";
  const STORAGE_PARTY_KEY = "vrahunePartyV1";

  function loadStoredEncounter() {
    try {
      const raw = localStorage.getItem(STORAGE_ENCOUNTER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveStoredEncounter(data) {
    try {
      localStorage.setItem(STORAGE_ENCOUNTER_KEY, JSON.stringify(data));
    } catch {}
  }

  function loadStoredParty() {
    try {
      const raw = localStorage.getItem(STORAGE_PARTY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveStoredParty(party) {
    try {
      localStorage.setItem(STORAGE_PARTY_KEY, JSON.stringify(party));
    } catch {}
  }

  // Make sure the base app has actually loaded
  if (typeof window === "undefined" || !window.toolsConfig || !Array.isArray(window.toolsConfig)) {
    console.warn("[Encounter Tool] toolsConfig not found. Make sure tool-encounter.js is loaded AFTER app.js.");
    return;
  }
  if (typeof window.renderToolPanel !== "function") {
    console.warn("[Encounter Tool] renderToolPanel not found. Make sure tool-encounter.js is loaded AFTER app.js.");
    return;
  }

  // Register this tool in the Tools list
  window.toolsConfig.push({
    id: "encounterInitiative",
    name: "Encounter / Initiative",
    description: "Track combat rounds, initiative, HP, AC, and speed for PCs and enemies."
  });

  // Refresh the Tools nav so it appears on the left
  if (typeof window.renderToolsNav === "function") {
    window.renderToolsNav();
  }

  const originalRenderToolPanel = window.renderToolPanel;

  // Small helpers
  function sortByInitiative(list) {
    return list.slice().sort((a, b) => {
      const ai = typeof a.initiative === "number" ? a.initiative : 0;
      const bi = typeof b.initiative === "number" ? b.initiative : 0;
      return bi - ai;
    });
  }

  function createId() {
    return "enc-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
  }

  function clampNumber(val, min, max) {
    const n = Number(val);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function updateEncounterStorage(combatants, round, activeIndex) {
    saveStoredEncounter({ combatants, round, activeIndex });
  }

  function renderCombatantsList(container, state) {
    const { combatants, activeIndex } = state;
    container.innerHTML = "";

    const sorted = sortByInitiative(combatants);
    const frag = document.createDocumentFragment();

    sorted.forEach((c, idx) => {
      const isActive = idx === activeIndex;
      const card = document.createElement("div");
      card.className = "enc-card";
      card.dataset.id = c.id;

      const cardTypeClass = c.type === "enemy" ? "enc-card-enemy" : "enc-card-player";
      card.classList.add(cardTypeClass);
      if (isActive) {
        card.classList.add("enc-card-active");
      }
      if (c.dead) {
        card.classList.add("enc-card-dead");
      }

      const curHp = typeof c.hpCurrent === "number" ? c.hpCurrent : c.hpMax;
      const maxHp = typeof c.hpMax === "number" ? c.hpMax : curHp;

      card.innerHTML = `
        <div class="enc-card-top">
          <div class="enc-avatar">
            ${c.portrait ? `<img src="${c.portrait}" alt="${c.name || ""}">` : `<span class="enc-avatar-placeholder">+</span>`}
          </div>
          <div class="enc-main">
            <div class="enc-name-row">
              <div class="enc-name">${c.name || "Unnamed"}</div>
              <div class="enc-initiative">Init ${c.initiative ?? "-"}</div>
            </div>
            <div class="enc-meta">
              <span>AC <strong>${c.ac ?? "-"}</strong></span>
              <span>SPD <strong>${c.speed ?? "-"}</strong></span>
            </div>
          </div>
        </div>

        <div class="enc-card-mid">
          <div class="enc-hp-block">
            <span class="enc-hp-label">HP</span>
            <input type="number" class="enc-hp-current" min="0" value="${curHp}" />
            <span class="enc-hp-separator">/</span>
            <input type="number" class="enc-hp-max" min="1" value="${maxHp}" />
          </div>

          <div class="enc-dmg-block">
            <input type="number" class="enc-dmg-input" min="-999" max="999" value="0" />
            <button type="button" class="btn-secondary btn-small enc-dmg-btn">Dmg</button>
            <button type="button" class="btn-secondary btn-small enc-heal-btn">Heal</button>
          </div>
        </div>

        <div class="enc-card-bottom">
          <button type="button" class="btn-secondary btn-small enc-mark-dead-btn">${c.dead ? "Revive" : "Dead"}</button>
          <button type="button" class="btn-secondary btn-small enc-edit-btn">Edit</button>
          <button type="button" class="btn-secondary btn-small enc-remove-btn">Remove</button>
        </div>
      `;

      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  // Override renderToolPanel to insert our tool, otherwise call original
  window.renderToolPanel = function (toolId) {
    if (toolId !== "encounterInitiative") {
      return originalRenderToolPanel(toolId);
    }

    const label = document.getElementById("activeGeneratorLabel");
    const panel = document.getElementById("generatorPanel");
    if (!panel || !label) return;

    // Clear panel
    panel.innerHTML = "";

    const saved = loadStoredEncounter();
    let combatants = saved?.combatants || [];
    let round = saved?.round || 1;
    let activeIndex = saved?.activeIndex || 0;
    let editingId = null;

    const party = loadStoredParty();

    label.textContent = "Encounter / Initiative";

    panel.innerHTML = `
      <div class="muted" style="margin-bottom:4px;">
        Track encounters: initiative, HP, AC, speed, and rounds. PCs and enemies in one place.
      </div>

      <div class="row">
        <div class="col">
          <label>Round</label>
          <div style="display:flex; align-items:center; gap:4px;">
            <button id="encRoundDown" class="btn-secondary btn-small" type="button">–</button>
            <input id="encRoundInput" type="number" min="1" value="${round}" style="width:60px; text-align:center;">
            <button id="encRoundUp" class="btn-secondary btn-small" type="button">+</button>
            <button id="encNextTurnBtn" class="btn-primary btn-small" type="button">Next turn</button>
          </div>
        </div>
        <div class="col">
          <label>Party</label>
          <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            ${party.map(p => `
              <button type="button" class="btn-secondary btn-small enc-party-btn" data-id="${p.id}">
                ${p.name || "PC"}
              </button>
            `).join("")}
            <button id="encAddFullPartyBtn" class="btn-secondary btn-small" type="button">Add full party</button>
            <button id="encManagePartyBtn" class="btn-secondary btn-small" type="button">Manage party</button>
          </div>
        </div>
      </div>

      <hr />

      <div class="row">
        <div class="col">
          <div class="section-title">
            <span>Turn Order & Combatants</span>
          </div>
          <div id="encCardsContainer" class="generated-list" style="max-height:none;"></div>
        </div>
      </div>

      <hr />

      <div class="row">
        <div class="col">
          <div class="section-title">
            <span>${editingId ? "Edit Combatant" : "Add / Edit Combatant"}</span>
          </div>
          <div id="encForm">
            <div class="row">
              <div class="col">
                <label for="encNameInput">Name</label>
                <input id="encNameInput" type="text" placeholder="Goblin, Thariel, etc." />
              </div>
              <div class="col">
                <label for="encTypeSelect">Type</label>
                <select id="encTypeSelect">
                  <option value="player">Player</option>
                  <option value="enemy">Enemy</option>
                  <option value="ally">Ally</option>
                </select>
              </div>
              <div class="col">
                <label for="encPortraitInput">Portrait URL</label>
                <input id="encPortraitInput" type="text" placeholder="Optional image URL" />
              </div>
            </div>

            <div class="row">
              <div class="col">
                <label for="encInitInput">Initiative</label>
                <input id="encInitInput" type="number" value="10" />
              </div>
              <div class="col">
                <label for="encAcInput">AC</label>
                <input id="encAcInput" type="number" value="15" />
              </div>
              <div class="col">
                <label for="encSpeedInput">Speed</label>
                <input id="encSpeedInput" type="number" value="30" />
              </div>
            </div>

            <div class="row">
              <div class="col">
                <label for="encHpMaxInput">HP Max</label>
                <input id="encHpMaxInput" type="number" value="20" />
              </div>
              <div class="col">
                <label for="encHpCurrentInput">HP Current</label>
                <input id="encHpCurrentInput" type="number" value="20" />
              </div>
              <div class="col">
                <label>&nbsp;</label>
                <button id="encSaveCombatantBtn" class="btn-primary btn-small" type="button">
                  Save combatant
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach behavior
    const roundInput = panel.querySelector("#encRoundInput");
    const roundDown = panel.querySelector("#encRoundDown");
    const roundUp = panel.querySelector("#encRoundUp");
    const nextTurnBtn = panel.querySelector("#encNextTurnBtn");
    const cardsContainer = panel.querySelector("#encCardsContainer");
    const saveCombatantBtn = panel.querySelector("#encSaveCombatantBtn");
    const addFullPartyBtn = panel.querySelector("#encAddFullPartyBtn");
    const managePartyBtn = panel.querySelector("#encManagePartyBtn");

    const nameInput = panel.querySelector("#encNameInput");
    const typeSelect = panel.querySelector("#encTypeSelect");
    const portraitInput = panel.querySelector("#encPortraitInput");
    const initInput = panel.querySelector("#encInitInput");
    const acInput = panel.querySelector("#encAcInput");
    const speedInput = panel.querySelector("#encSpeedInput");
    const hpMaxInput = panel.querySelector("#encHpMaxInput");
    const hpCurrentInput = panel.querySelector("#encHpCurrentInput");

    function syncRoundFromInput() {
      const val = clampNumber(roundInput.value, 1, 9999);
      round = val;
      roundInput.value = round;
      updateEncounterStorage(combatants, round, activeIndex);
    }

    roundInput.addEventListener("change", syncRoundFromInput);
    roundDown.addEventListener("click", () => {
      round = Math.max(1, round - 1);
      roundInput.value = round;
      updateEncounterStorage(combatants, round, activeIndex);
    });
    roundUp.addEventListener("click", () => {
      round = round + 1;
      roundInput.value = round;
      updateEncounterStorage(combatants, round, activeIndex);
    });

    function advanceTurn() {
      if (!combatants.length) return;
      activeIndex = (activeIndex + 1) % combatants.length;
      if (activeIndex === 0) {
        round += 1;
        roundInput.value = round;
      }
      updateEncounterStorage(combatants, round, activeIndex);
      renderCombatantsList(cardsContainer, { combatants, activeIndex });
    }

    nextTurnBtn.addEventListener("click", advanceTurn);

    function writeFormFromCombatant(c) {
      if (!c) {
        editingId = null;
        nameInput.value = "";
        typeSelect.value = "player";
        portraitInput.value = "";
        initInput.value = 10;
        acInput.value = 15;
        speedInput.value = 30;
        hpMaxInput.value = 20;
        hpCurrentInput.value = 20;
        return;
      }
      editingId = c.id;
      nameInput.value = c.name || "";
      typeSelect.value = c.type || "player";
      portraitInput.value = c.portrait || "";
      initInput.value = c.initiative ?? 10;
      acInput.value = c.ac ?? 15;
      speedInput.value = c.speed ?? 30;
      hpMaxInput.value = c.hpMax ?? 20;
      hpCurrentInput.value = c.hpCurrent ?? c.hpMax ?? 20;
    }

    function readFormToCombatant(existingId) {
      const id = existingId || createId();
      const name = (nameInput.value || "").trim() || "Unnamed";
      const type = typeSelect.value || "player";
      const portrait = (portraitInput.value || "").trim() || "";
      const initiative = Number(initInput.value) || 0;
      const ac = Number(acInput.value) || 0;
      const speed = Number(speedInput.value) || 0;
      const hpMax = Math.max(1, Number(hpMaxInput.value) || 1);
      let hpCurrent = Number(hpCurrentInput.value);
      if (Number.isNaN(hpCurrent) || hpCurrent <= 0) {
        hpCurrent = hpMax;
      }
      return {
        id, name, type, portrait,
        initiative, ac, speed,
        hpMax, hpCurrent,
        dead: false
      };
    }

    saveCombatantBtn.addEventListener("click", () => {
      const newData = readFormToCombatant(editingId);
      const idx = combatants.findIndex(c => c.id === newData.id);
      if (idx === -1) {
        combatants.push(newData);
      } else {
        const preserveDead = combatants[idx].dead;
        combatants[idx] = { ...newData, dead: preserveDead };
      }
      combatants = sortByInitiative(combatants);
      activeIndex = 0;
      updateEncounterStorage(combatants, round, activeIndex);
      renderCombatantsList(cardsContainer, { combatants, activeIndex });
      writeFormFromCombatant(null);
    });

    cardsContainer.addEventListener("click", (e) => {
      const card = e.target.closest(".enc-card");
      if (!card) return;
      const id = card.dataset.id;
      const idx = combatants.findIndex(c => c.id === id);
      if (idx === -1) return;
      const c = combatants[idx];

      if (e.target.classList.contains("enc-remove-btn")) {
        combatants.splice(idx, 1);
        if (activeIndex >= combatants.length) {
          activeIndex = Math.max(0, combatants.length - 1);
        }
        updateEncounterStorage(combatants, round, activeIndex);
        renderCombatantsList(cardsContainer, { combatants, activeIndex });
        return;
      }

      if (e.target.classList.contains("enc-edit-btn")) {
        writeFormFromCombatant(c);
        return;
      }

      if (e.target.classList.contains("enc-mark-dead-btn")) {
        c.dead = !c.dead;
        if (c.dead && c.hpCurrent > 0) {
          c.hpCurrent = 0;
        }
        combatants[idx] = c;
        updateEncounterStorage(combatants, round, activeIndex);
        renderCombatantsList(cardsContainer, { combatants, activeIndex });
        return;
      }

      if (e.target.classList.contains("enc-dmg-btn") || e.target.classList.contains("enc-heal-btn")) {
        const dmgInput = card.querySelector(".enc-dmg-input");
        const hpCurInput = card.querySelector(".enc-hp-current");
        const hpMaxInputLocal = card.querySelector(".enc-hp-max");

        let delta = Number(dmgInput.value) || 0;
        if (e.target.classList.contains("enc-dmg-btn")) {
          delta = -Math.abs(delta);
        } else {
          delta = Math.abs(delta);
        }

        const hpCurrentOld = Number(hpCurInput.value) || 0;
        const hpMaxVal = Number(hpMaxInputLocal.value) || c.hpMax || 1;
        let hpNew = hpCurrentOld + delta;
        hpNew = Math.max(0, Math.min(hpMaxVal, hpNew));

        c.hpCurrent = hpNew;
        c.hpMax = hpMaxVal;
        if (hpNew <= 0) {
          c.dead = true;
        } else {
          c.dead = false;
        }

        hpCurInput.value = hpNew;
        combatants[idx] = c;
        updateEncounterStorage(combatants, round, activeIndex);
        return;
      }
    });

    cardsContainer.addEventListener("change", (e) => {
      const card = e.target.closest(".enc-card");
      if (!card) return;
      const id = card.dataset.id;
      const idx = combatants.findIndex(c => c.id === id);
      if (idx === -1) return;
      const c = combatants[idx];

      if (e.target.classList.contains("enc-hp-current")) {
        const val = Math.max(0, Number(e.target.value) || 0);
        c.hpCurrent = val;
        if (val <= 0) {
          c.dead = true;
        } else {
          c.dead = false;
        }
      } else if (e.target.classList.contains("enc-hp-max")) {
        const val = Math.max(1, Number(e.target.value) || 1);
        c.hpMax = val;
        if (c.hpCurrent > val) {
          c.hpCurrent = val;
        }
      }

      combatants[idx] = c;
      updateEncounterStorage(combatants, round, activeIndex);
    });

    function quickAddFullParty() {
      if (!Array.isArray(party) || !party.length) return;
      party.forEach(p => {
        const exists = combatants.some(c => c.id === p.id);
        if (!exists) {
          combatants.push({
            id: p.id,
            name: p.name || "PC",
            type: "player",
            portrait: p.portrait || "",
            initiative: 10,
            ac: p.ac ?? 15,
            speed: p.speed ?? 30,
            hpMax: p.hpMax ?? 20,
            hpCurrent: p.hpCurrent ?? p.hpMax ?? 20,
            dead: false
          });
        }
      });
      combatants = sortByInitiative(combatants);
      activeIndex = 0;
      updateEncounterStorage(combatants, round, activeIndex);
      renderCombatantsList(cardsContainer, { combatants, activeIndex });
    }

    if (addFullPartyBtn) {
      addFullPartyBtn.addEventListener("click", quickAddFullParty);
    }

    function openPartyManager() {
      const existingModal = document.getElementById("encPartyModal");
      if (existingModal) {
        existingModal.remove();
      }

      const modal = document.createElement("div");
      modal.id = "encPartyModal";
      modal.className = "generator-create-box";
      modal.style.display = "flex";

      const inner = document.createElement("div");
      inner.className = "generator-create-inner";
      inner.style.maxWidth = "720px";

      inner.innerHTML = `
        <div class="generator-create-header">
          <div class="generator-create-title">Manage Party</div>
          <button type="button" class="btn-secondary btn-small encPartyCloseBtn">✕ Close</button>
        </div>
        <div class="generator-create-body" style="max-height:60vh; overflow:auto;">
          <div class="row">
            <div class="col">
              <label>Party members</label>
              <div id="encPartyList" class="generated-list" style="max-height:none;"></div>
            </div>
          </div>
          <div class="row" style="margin-top:6px;">
            <div class="col">
              <label for="encPartyNameInput">Name</label>
              <input id="encPartyNameInput" type="text" placeholder="PC name" />
            </div>
            <div class="col">
              <label for="encPartyAcInput">AC</label>
              <input id="encPartyAcInput" type="number" value="15" />
            </div>
            <div class="col">
              <label for="encPartySpeedInput">Speed</label>
              <input id="encPartySpeedInput" type="number" value="30" />
            </div>
          </div>
          <div class="row">
            <div class="col">
              <label for="encPartyHpMaxInput">HP Max</label>
              <input id="encPartyHpMaxInput" type="number" value="20" />
            </div>
            <div class="col">
              <label for="encPartyPortraitInput">Portrait URL</label>
              <input id="encPartyPortraitInput" type="text" placeholder="Optional" />
            </div>
            <div class="col">
              <label>&nbsp;</label>
              <button id="encPartyAddBtn" class="btn-primary btn-small" type="button">Add to party</button>
            </div>
          </div>
        </div>
      `;

      modal.appendChild(inner);
      document.body.appendChild(modal);

      const partyListDiv = inner.querySelector("#encPartyList");
      const closeBtn = inner.querySelector(".encPartyCloseBtn");
      const partyNameInput = inner.querySelector("#encPartyNameInput");
      const partyAcInput = inner.querySelector("#encPartyAcInput");
      const partySpeedInput = inner.querySelector("#encPartySpeedInput");
      const partyHpMaxInput = inner.querySelector("#encPartyHpMaxInput");
      const partyPortraitInput = inner.querySelector("#encPartyPortraitInput");
      const partyAddBtn = inner.querySelector("#encPartyAddBtn");

      function renderPartyList() {
        partyListDiv.innerHTML = "";
        if (!party.length) {
          partyListDiv.innerHTML = `<div class="muted">No party members saved yet.</div>`;
          return;
        }
        const frag = document.createDocumentFragment();
        party.forEach(p => {
          const row = document.createElement("div");
          row.className = "generated-item";
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.justifyContent = "space-between";
          row.style.gap = "8px";
          row.innerHTML = `
            <span>${p.name || "PC"} (AC ${p.ac ?? "-"}, HP ${p.hpMax ?? "-"})</span>
            <button type="button" class="btn-secondary btn-small encPartyRemoveBtn" data-id="${p.id}">Remove</button>
          `;
          frag.appendChild(row);
        });
        partyListDiv.appendChild(frag);
      }

      renderPartyList();

      partyListDiv.addEventListener("click", (e) => {
        const btn = e.target.closest(".encPartyRemoveBtn");
        if (!btn) return;
        const id = btn.dataset.id;
        const idx = party.findIndex(p => p.id === id);
        if (idx === -1) return;
        party.splice(idx, 1);
        saveStoredParty(party);
        renderPartyList();
      });

      partyAddBtn.addEventListener("click", () => {
        const name = (partyNameInput.value || "").trim();
        if (!name) return;
        const ac = Number(partyAcInput.value) || 15;
        const speed = Number(partySpeedInput.value) || 30;
        const hpMax = Math.max(1, Number(partyHpMaxInput.value) || 20);
        const portrait = (partyPortraitInput.value || "").trim() || "";

        const id = "pc-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
        party.push({ id, name, ac, speed, hpMax, hpCurrent: hpMax, portrait });
        saveStoredParty(party);

        partyNameInput.value = "";
        partyAcInput.value = 15;
        partySpeedInput.value = 30;
        partyHpMaxInput.value = 20;
        partyPortraitInput.value = "";

        renderPartyList();
      });

      closeBtn.addEventListener("click", () => {
        modal.remove();
      });
    }

    if (managePartyBtn) {
      managePartyBtn.addEventListener("click", openPartyManager);
    }

    // Initial render of combatants
    renderCombatantsList(cardsContainer, { combatants, activeIndex });
  };

  // Basic styles for the encounter cards (piggyback off existing styles)
  const styleId = "encounter-tool-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .enc-card {
        border-radius: 10px;
        border: 1px solid #2c323d;
        background: #05070c;
        padding: 6px 8px;
        margin-bottom: 4px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-shadow: 0 0 8px rgba(0,0,0,0.4);
      }
      .enc-card-player {
        background: radial-gradient(circle at top left, #141a26, #05070c);
      }
      .enc-card-enemy {
        background: radial-gradient(circle at top left, #261418, #05070c);
      }
      .enc-card-active {
        border-color: #c0c0c0;
        box-shadow: 0 0 12px rgba(192,192,192,0.35);
      }
      .enc-card-dead {
        opacity: 0.6;
        border-color: #ff5c5c;
      }
      .enc-card-top {
        display: flex;
        gap: 8px;
      }
      .enc-avatar {
        width: 38px;
        height: 38px;
        border-radius: 999px;
        border: 1px solid #3a414d;
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #05070c;
      }
      .enc-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .enc-avatar-placeholder {
        font-size: 0.7rem;
        color: #666;
      }
      .enc-main {
        flex: 1;
        min-width: 0;
      }
      .enc-name-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 6px;
      }
      .enc-name {
        font-size: 0.9rem;
        font-weight: 600;
      }
      .enc-initiative {
        font-size: 0.75rem;
        color: #9ba1aa;
      }
      .enc-meta {
        font-size: 0.75rem;
        color: #9ba1aa;
        display: flex;
        gap: 8px;
      }
      .enc-card-mid {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .enc-hp-block {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .enc-hp-label {
        font-size: 0.8rem;
        color: #9ba1aa;
      }
      .enc-hp-current,
      .enc-hp-max {
        width: 42px;
        font-size: 0.8rem;
        padding: 3px 4px;
      }
      .enc-hp-separator {
        font-size: 0.8rem;
      }
      .enc-dmg-block {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .enc-dmg-input {
        width: 38px;
        font-size: 0.8rem;
        padding: 2px 4px;
      }
      .enc-card-bottom {
        display: flex;
        gap: 4px;
        justify-content: flex-end;
      }
    `;
    document.head.appendChild(style);
  }
})();
