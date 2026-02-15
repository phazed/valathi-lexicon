// tool-encounter.js
// Adds an Encounter / Initiative tool to the Vrahune Toolbox without modifying the main script.
// Usage: include this AFTER your main script in index.html, e.g.:
//   <script src="app.js"></script>
//   <script src="tool-encounter.js"></script>

(function () {
  if (typeof window === "undefined" || !window.renderToolPanel) {
    console.warn("Vrahune Toolbox core not found; load app.js before tool-encounter.js");
    return;
  }

  const STORAGE_ENCOUNTER_KEY = "vrahuneEncounterV1";
  const STORAGE_PARTY_KEY = "vrahunePartyV1";

  function loadJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  // ---------- Data helpers ----------

  function createEmptyEncounter() {
    return {
      round: 1,
      activeId: null,
      order: [], // array of ids (combatant ids) in initiative order
      combatants: {} // id -> { id, name, type, ac, speed, maxHp, currentHp, initiative, isDead, portraitData }
    };
  }

  function createEmptyParty() {
    return {
      members: [] // { id, name, ac, speed, maxHp, portraitData }
    };
  }

  function generateId() {
    return "c-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }

  // ---------- Rendering helper ----------

  function setLabelText(text) {
    const label = document.getElementById("activeGeneratorLabel");
    if (label) label.textContent = text;
  }

  function setPanelContent(html) {
    const panel = document.getElementById("generatorPanel");
    if (!panel) return null;
    panel.innerHTML = html;
    return panel;
  }

  // ---------- Main render function for this tool ----------

  function renderEncounterTool() {
    setLabelText("Encounter / Initiative · Track rounds, turn order, HP, AC, and speed");

    const panel = setPanelContent(`
      <div class="muted" style="margin-bottom:4px;">
        Use this tool to track initiative, rounds, HP, AC, speed, and status for PCs & enemies.
        Save your party for quick reuse across encounters.
      </div>

      <div class="row" style="margin-bottom:6px;">
        <div class="col">
          <label>Turn / Round</label>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button id="encPrevTurnBtn" class="btn-secondary btn-small" type="button">◀ Prev</button>
            <button id="encNextTurnBtn" class="btn-primary btn-small" type="button">Next ▶</button>
            <span id="encTurnLabel" style="font-size:0.8rem; color:#c0c0c0; min-width:140px;">No combatants yet</span>
            <span style="margin-left:auto; display:flex; align-items:center; gap:4px;">
              <span style="font-size:0.78rem; color:#9ba1aa;">Round</span>
              <input id="encRoundInput" type="number" min="1" value="1" style="width:64px; text-align:center;">
              <button id="encRoundResetBtn" class="btn-secondary btn-small" type="button">Reset</button>
            </span>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px;">

        <!-- Turn order + cards -->
        <div style="
          border:1px solid #222832;
          border-radius:10px;
          background:#05070c;
          padding:8px 8px 6px;
          display:flex;
          flex-direction:column;
          gap:6px;
        ">
          <div class="section-title" style="margin-bottom:2px;">
            <span>Turn Order & Combatants</span>
            <span style="display:flex; gap:6px; align-items:center;">
              <button id="encClearEncounterBtn" class="btn-secondary btn-small" type="button">Clear encounter</button>
            </span>
          </div>
          <div id="encTurnOrderStrip" style="font-size:0.78rem; color:#9ba1aa;"></div>
          <div id="encCardsContainer" style="display:flex; flex-direction:column; gap:6px; margin-top:4px;"></div>
        </div>

        <!-- Add / edit combatants + party -->
        <div style="
          border:1px solid #222832;
          border-radius:10px;
          background:#05070c;
          padding:8px 8px 6px;
          display:flex;
          flex-direction:column;
          gap:6px;
        ">
          <div class="section-title" style="margin-bottom:2px;">
            <span>Add / Edit Combatants</span>
            <button id="encToggleFormBtn" class="btn-secondary btn-small" type="button">Hide editor</button>
          </div>

          <div id="encFormWrapper">
            <form id="encForm" style="display:flex; flex-wrap:wrap; gap:6px; align-items:flex-end;">
              <div style="flex:1; min-width:160px;">
                <label for="encNameInput">Name</label>
                <input id="encNameInput" type="text" placeholder="Name">
              </div>
              <div style="width:120px;">
                <label for="encTypeSelect">Type</label>
                <select id="encTypeSelect">
                  <option value="pc">PC / Ally</option>
                  <option value="enemy">Enemy</option>
                  <option value="npc">Neutral / NPC</option>
                </select>
              </div>
              <div style="width:80px;">
                <label for="encAcInput">AC</label>
                <input id="encAcInput" type="number" min="0" value="10">
              </div>
              <div style="width:80px;">
                <label for="encSpeedInput">Speed</label>
                <input id="encSpeedInput" type="number" min="0" value="30">
              </div>
              <div style="width:100px;">
                <label for="encMaxHpInput">Max HP</label>
                <input id="encMaxHpInput" type="number" min="0" value="10">
              </div>
              <div style="width:100px;">
                <label for="encInitInput">Init</label>
                <input id="encInitInput" type="number" min="-20" max="50" value="10">
              </div>
              <div style="width:140px;">
                <label for="encPortraitInput">Portrait</label>
                <input id="encPortraitInput" type="file" accept="image/*">
              </div>
              <div style="width:120px;">
                <button id="encAddBtn" class="btn-primary" type="submit">Add / Update</button>
              </div>
            </form>
          </div>

          <hr/>

          <div style="display:flex; flex-direction:column; gap:4px;">
            <div class="section-title" style="margin-bottom:0;">
              <span>Party Management</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              <button id="encLoadPartyBtn" class="btn-secondary btn-small" type="button">Add full party</button>
              <button id="encManagePartyBtn" class="btn-secondary btn-small" type="button">Manage party...</button>
              <span id="encPartySummary" class="muted" style="font-size:0.78rem;"></span>
            </div>
          </div>
        </div>
      </div>
    `);

    if (!panel) return;

    // ---- State load ----
    let encounter = loadJson(STORAGE_ENCOUNTER_KEY, createEmptyEncounter());
    let party = loadJson(STORAGE_PARTY_KEY, createEmptyParty());

    // If there are no combatants but we have an old activeId, reset it
    if (!encounter.order || !encounter.order.length) {
      encounter.activeId = null;
    }

    // ---- DOM references ----
    const encRoundInput = panel.querySelector("#encRoundInput");
    const encRoundResetBtn = panel.querySelector("#encRoundResetBtn");
    const encPrevTurnBtn = panel.querySelector("#encPrevTurnBtn");
    const encNextTurnBtn = panel.querySelector("#encNextTurnBtn");
    const encTurnLabel = panel.querySelector("#encTurnLabel");
    const encCardsContainer = panel.querySelector("#encCardsContainer");
    const encTurnOrderStrip = panel.querySelector("#encTurnOrderStrip");
    const encClearEncounterBtn = panel.querySelector("#encClearEncounterBtn");

    const encFormWrapper = panel.querySelector("#encFormWrapper");
    const encToggleFormBtn = panel.querySelector("#encToggleFormBtn");
    const encForm = panel.querySelector("#encForm");
    const encNameInput = panel.querySelector("#encNameInput");
    const encTypeSelect = panel.querySelector("#encTypeSelect");
    const encAcInput = panel.querySelector("#encAcInput");
    const encSpeedInput = panel.querySelector("#encSpeedInput");
    const encMaxHpInput = panel.querySelector("#encMaxHpInput");
    const encInitInput = panel.querySelector("#encInitInput");
    const encPortraitInput = panel.querySelector("#encPortraitInput");
    const encAddBtn = panel.querySelector("#encAddBtn");

    const encLoadPartyBtn = panel.querySelector("#encLoadPartyBtn");
    const encManagePartyBtn = panel.querySelector("#encManagePartyBtn");
    const encPartySummary = panel.querySelector("#encPartySummary");

    // For editing existing
    let editingId = null;

    // ---------- helpers ----------

    function saveEncounter() {
      saveJson(STORAGE_ENCOUNTER_KEY, encounter);
    }

    function saveParty() {
      saveJson(STORAGE_PARTY_KEY, party);
    }

    function getActiveIndex() {
      if (!encounter.order || !encounter.order.length || !encounter.activeId) return -1;
      return encounter.order.indexOf(encounter.activeId);
    }

    function setActiveByIndex(idx) {
      if (!encounter.order || !encounter.order.length) {
        encounter.activeId = null;
        return;
      }
      if (idx < 0) idx = 0;
      if (idx >= encounter.order.length) idx = encounter.order.length - 1;
      encounter.activeId = encounter.order[idx];
    }

    function sortOrderByInitiative() {
      encounter.order.sort((a, b) => {
        const ca = encounter.combatants[a];
        const cb = encounter.combatants[b];
        const ia = ca ? (ca.initiative ?? 0) : 0;
        const ib = cb ? (cb.initiative ?? 0) : 0;
        // Higher initiative first; tie-break by name
        if (ib !== ia) return ib - ia;
        const na = ca ? ca.name || "" : "";
        const nb = cb ? cb.name || "" : "";
        return na.localeCompare(nb);
      });
    }

    function describeParty(p) {
      if (!p.members || !p.members.length) return "No party saved.";
      const count = p.members.length;
      const names = p.members.map(m => m.name).filter(Boolean);
      const listed = names.slice(0, 3).join(", ");
      const extra = names.length > 3 ? ` +${names.length - 3} more` : "";
      return `Saved party (${count}): ${listed}${extra}`;
    }

    function getTypeLabel(type) {
      if (type === "pc") return "PC / Ally";
      if (type === "enemy") return "Enemy";
      if (type === "npc") return "NPC";
      return type || "Unknown";
    }

    function typeColor(type) {
      if (type === "pc") return "#1e90ff"; // blue-ish
      if (type === "enemy") return "#ff4f4f"; // red-ish
      if (type === "npc") return "#c8a24c"; // gold-ish
      return "#808890";
    }

    function portraitBackground(c) {
      if (c.portraitData) {
        return `background-image:url(${c.portraitData}); background-size:cover; background-position:center;`;
      }
      const col = typeColor(c.type);
      return `
        background: radial-gradient(circle at 30% 20%, ${col}, #05070c 60%);
      `;
    }

    function updateRoundUI() {
      encRoundInput.value = encounter.round || 1;
    }

    function updateTurnLabel() {
      if (!encounter.order.length) {
        encTurnLabel.textContent = "No combatants yet";
        return;
      }
      const idx = getActiveIndex();
      if (idx === -1) {
        encTurnLabel.textContent = "Select a combatant or advance turn";
        return;
      }
      const id = encounter.order[idx];
      const c = encounter.combatants[id];
      if (!c) {
        encTurnLabel.textContent = "Unknown combatant";
        return;
      }
      encTurnLabel.textContent = `Round ${encounter.round} · Turn ${idx + 1}/${encounter.order.length}: ${c.name}`;
    }

    function updateTurnOrderStrip() {
      const strip = encTurnOrderStrip;
      strip.innerHTML = "";
      if (!encounter.order.length) {
        strip.textContent = "Turn order will appear here once combatants are added.";
        return;
      }
      const frag = document.createDocumentFragment();
      encounter.order.forEach((id, idx) => {
        const c = encounter.combatants[id];
        if (!c) return;
        const span = document.createElement("span");
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.justifyContent = "center";
        span.style.padding = "2px 6px";
        span.style.marginRight = "4px";
        span.style.borderRadius = "999px";
        span.style.fontSize = "0.75rem";
        span.style.cursor = "pointer";
        span.dataset.id = id;

        const isActive = encounter.activeId === id;
        const baseBorder = "#3a414d";
        const myColor = typeColor(c.type);

        span.style.border = `1px solid ${isActive ? myColor : baseBorder}`;
        span.style.color = isActive ? myColor : "#c0c4cc";
        span.style.background = isActive ? "#10151f" : "#05070c";

        const icon =
          c.type === "pc" ? "◆" :
          c.type === "enemy" ? "✖" :
          c.type === "npc" ? "◈" : "•";

        span.textContent = `${icon} ${c.name} (${c.initiative ?? 0})`;

        span.addEventListener("click", () => {
          encounter.activeId = id;
          updateTurnLabel();
          renderCards();
          saveEncounter();
        });

        frag.appendChild(span);
      });
      strip.appendChild(frag);
    }

    function renderCards() {
      encCardsContainer.innerHTML = "";

      if (!encounter.order.length) {
        encCardsContainer.innerHTML = `<div class="muted" style="font-size:0.78rem;">No combatants yet. Add PCs, NPCs, or enemies below.</div>`;
        return;
      }

      const activeId = encounter.activeId;

      encounter.order.forEach((id) => {
        const c = encounter.combatants[id];
        if (!c) return;

        const isActive = activeId === id;
        const isDead = !!c.isDead;

        const card = document.createElement("div");
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.gap = "8px";
        card.style.padding = "6px 8px";
        card.style.borderRadius = "10px";
        card.style.border = "1px solid #222832";
        card.style.background =
          isDead
            ? "#2a0909"
            : isActive
            ? "linear-gradient(135deg, #273142, #181f2b)"
            : "#080b11";

        card.style.boxShadow = isActive ? "0 0 10px rgba(192,192,192,0.25)" : "none";

        // Entire card is drag handle (for future reordering if desired)
        card.style.cursor = "default";

        // Portrait
        const portraitWrap = document.createElement("div");
        portraitWrap.style.width = "40px";
        portraitWrap.style.height = "40px";
        portraitWrap.style.borderRadius = "999px";
        portraitWrap.style.border = "2px solid #3b4656";
        portraitWrap.style.flexShrink = "0";
        portraitWrap.style.overflow = "hidden";
        portraitWrap.style.background = "#05070c";
        portraitWrap.style.position = "relative";
        portraitWrap.style.backgroundClip = "padding-box";
        portraitWrap.style.cssText += portraitBackground(c);

        const initials = document.createElement("div");
        initials.style.position = "absolute";
        initials.style.inset = "0";
        initials.style.display = "flex";
        initials.style.alignItems = "center";
        initials.style.justifyContent = "center";
        initials.style.fontSize = "0.75rem";
        initials.style.color = "#e6e6e6";
        initials.style.textShadow = "0 0 4px rgba(0,0,0,0.8)";

        const nameParts = String(c.name || "?").trim().split(/\s+/);
        const inits = nameParts
          .filter(Boolean)
          .slice(0, 2)
          .map(s => s[0].toUpperCase())
          .join("");
        initials.textContent = inits || "?";
        portraitWrap.appendChild(initials);

        // Middle block: Name + HP
        const middle = document.createElement("div");
        middle.style.display = "flex";
        middle.style.flexDirection = "column";
        middle.style.flex = "1 1 auto";
        middle.style.minWidth = "0";

        const nameRow = document.createElement("div");
        nameRow.style.display = "flex";
        nameRow.style.alignItems = "center";
        nameRow.style.gap = "6px";
        nameRow.style.marginBottom = "2px";

        const nameLabel = document.createElement("div");
        nameLabel.style.fontSize = "0.92rem";
        nameLabel.style.fontWeight = "600";
        nameLabel.style.color = isDead ? "#f8d7da" : "#f5f5f5";
        nameLabel.style.whiteSpace = "nowrap";
        nameLabel.style.overflow = "hidden";
        nameLabel.style.textOverflow = "ellipsis";
        nameLabel.textContent = c.name || "Unnamed";

        const typeBadge = document.createElement("span");
        typeBadge.style.fontSize = "0.7rem";
        typeBadge.style.padding = "1px 6px";
        typeBadge.style.borderRadius = "999px";
        typeBadge.style.border = "1px solid #3b4656";
        typeBadge.style.color = typeColor(c.type);
        typeBadge.style.background = "#05070c";
        typeBadge.textContent = getTypeLabel(c.type);

        nameRow.appendChild(nameLabel);
        nameRow.appendChild(typeBadge);

        const hpRow = document.createElement("div");
        hpRow.style.display = "flex";
        hpRow.style.alignItems = "center";
        hpRow.style.gap = "6px";

        const current = typeof c.currentHp === "number" ? c.currentHp : c.maxHp || 0;
        const max = typeof c.maxHp === "number" ? c.maxHp : 0;

        const hpDisplay = document.createElement("div");
        hpDisplay.style.fontFamily = `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;
        hpDisplay.style.fontSize = "0.8rem";
        hpDisplay.style.color = isDead ? "#f8d7da" : "#e6e6e6";

        const hpLabel = document.createElement("span");
        hpLabel.textContent = "HP ";
        hpLabel.style.color = "#9ba1aa";

        const hpCurrentSpan = document.createElement("span");
        hpCurrentSpan.textContent = String(current);
        hpCurrentSpan.style.fontWeight = "600";

        const hpSep = document.createElement("span");
        hpSep.textContent = " / ";

        const hpMaxSpan = document.createElement("span");
        hpMaxSpan.textContent = String(max);
        hpMaxSpan.style.fontWeight = "700";

        hpDisplay.appendChild(hpLabel);
        hpDisplay.appendChild(hpCurrentSpan);
        hpDisplay.appendChild(hpSep);
        hpDisplay.appendChild(hpMaxSpan);

        // Damage / heal control
        const dmgBox = document.createElement("input");
        dmgBox.type = "number";
        dmgBox.min = "-999";
        dmgBox.max = "999";
        dmgBox.value = "";
        dmgBox.style.width = "60px";
        dmgBox.style.fontSize = "0.78rem";
        dmgBox.style.padding = "3px 4px";

        const dmgBtn = document.createElement("button");
        dmgBtn.type = "button";
        dmgBtn.className = "btn-secondary btn-small";
        dmgBtn.textContent = "Damage";

        const healBtn = document.createElement("button");
        healBtn.type = "button";
        healBtn.className = "btn-secondary btn-small";
        healBtn.textContent = "Heal";

        function applyDelta(sign) {
          const raw = dmgBox.value;
          if (!raw) return;
          const val = parseInt(raw, 10);
          if (isNaN(val) || val === 0) return;

          let cur = typeof c.currentHp === "number" ? c.currentHp : c.maxHp || 0;
          let maxHp = typeof c.maxHp === "number" ? c.maxHp : 0;
          if (maxHp < 0) maxHp = 0;

          let next = sign === "damage" ? cur - val : cur + val;
          if (next > maxHp) next = maxHp;
          if (next < 0) next = 0;

          c.currentHp = next;
          c.isDead = next <= 0 && maxHp > 0;

          saveEncounter();
          renderCards();
          updateTurnLabel();
        }

        dmgBtn.addEventListener("click", () => applyDelta("damage"));
        healBtn.addEventListener("click", () => applyDelta("heal"));

        const dmgControls = document.createElement("div");
        dmgControls.style.display = "flex";
        dmgControls.style.alignItems = "center";
        dmgControls.style.gap = "4px";
        dmgControls.appendChild(dmgBox);
        dmgControls.appendChild(dmgBtn);
        dmgControls.appendChild(healBtn);

        hpRow.appendChild(hpDisplay);
        hpRow.appendChild(dmgControls);

        middle.appendChild(nameRow);
        middle.appendChild(hpRow);

        // Right block: AC, speed, init, controls
        const right = document.createElement("div");
        right.style.display = "flex";
        right.style.flexDirection = "column";
        right.style.alignItems = "flex-end";
        right.style.gap = "3px";
        right.style.minWidth = "120px";

        const statsRow = document.createElement("div");
        statsRow.style.display = "flex";
        statsRow.style.gap = "8px";
        statsRow.style.justifyContent = "flex-end";
        statsRow.style.fontSize = "0.76rem";
        statsRow.style.color = "#c0c4cc";

        const acSpan = document.createElement("span");
        acSpan.textContent = `AC ${c.ac ?? "-"}`;

        const spSpan = document.createElement("span");
        spSpan.textContent = `Speed ${c.speed ?? "-"}`;

        const initSpan = document.createElement("span");
        initSpan.textContent = `Init ${c.initiative ?? "-"}`;

        statsRow.appendChild(acSpan);
        statsRow.appendChild(spSpan);
        statsRow.appendChild(initSpan);

        const controlsRow = document.createElement("div");
        controlsRow.style.display = "flex";
        controlsRow.style.gap = "4px";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn-secondary btn-small";
        editBtn.textContent = "Edit";

        const killBtn = document.createElement("button");
        killBtn.type = "button";
        killBtn.className = "btn-secondary btn-small";
        killBtn.textContent = isDead ? "Revive" : "Kill";

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-secondary btn-small";
        removeBtn.textContent = "✕";

        editBtn.addEventListener("click", () => {
          editingId = c.id;
          encNameInput.value = c.name || "";
          encTypeSelect.value = c.type || "pc";
          encAcInput.value = c.ac ?? 10;
          encSpeedInput.value = c.speed ?? 30;
          encMaxHpInput.value = c.maxHp ?? 10;
          encInitInput.value = c.initiative ?? 10;
          // portrait stays, we only change if new one uploaded
          encNameInput.focus();
          encAddBtn.textContent = "Update combatant";
        });

        killBtn.addEventListener("click", () => {
          if (c.isDead) {
            c.isDead = false;
            if (typeof c.currentHp !== "number" || c.currentHp <= 0) {
              c.currentHp = c.maxHp ?? 0;
            }
          } else {
            c.isDead = true;
            c.currentHp = 0;
          }
          saveEncounter();
          renderCards();
        });

        removeBtn.addEventListener("click", () => {
          const idx = encounter.order.indexOf(c.id);
          if (idx !== -1) {
            encounter.order.splice(idx, 1);
          }
          delete encounter.combatants[c.id];

          if (encounter.order.length === 0) {
            encounter.activeId = null;
          } else if (encounter.activeId === c.id) {
            setActiveByIndex(Math.min(idx, encounter.order.length - 1));
          }

          saveEncounter();
          renderCards();
          updateTurnOrderStrip();
          updateTurnLabel();
        });

        controlsRow.appendChild(editBtn);
        controlsRow.appendChild(killBtn);
        controlsRow.appendChild(removeBtn);

        right.appendChild(statsRow);
        right.appendChild(controlsRow);

        card.appendChild(portraitWrap);
        card.appendChild(middle);
        card.appendChild(right);

        // Click card to set active
        card.addEventListener("click", (e) => {
          // Avoid conflict with button clicks
          if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
          encounter.activeId = c.id;
          saveEncounter();
          renderCards();
          updateTurnOrderStrip();
          updateTurnLabel();
        });

        encCardsContainer.appendChild(card);
      });
    }

    // ---------- Initial UI sync ----------
    if (!encounter.round || encounter.round < 1) encounter.round = 1;
    if (!Array.isArray(encounter.order)) encounter.order = [];
    if (!encounter.combatants || typeof encounter.combatants !== "object") {
      encounter.combatants = {};
    }

    sortOrderByInitiative();
    if (encounter.order.length && !encounter.activeId) {
      encounter.activeId = encounter.order[0];
    }

    updateRoundUI();
    updateTurnOrderStrip();
    renderCards();
    updateTurnLabel();
    encPartySummary.textContent = describeParty(party);

    // ---------- Event wiring ----------

    encRoundResetBtn.addEventListener("click", () => {
      encounter.round = 1;
      saveEncounter();
      updateRoundUI();
      updateTurnLabel();
    });

    encRoundInput.addEventListener("change", () => {
      let val = parseInt(encRoundInput.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      encounter.round = val;
      saveEncounter();
      updateRoundUI();
      updateTurnLabel();
    });

    encNextTurnBtn.addEventListener("click", () => {
      if (!encounter.order.length) return;
      let idx = getActiveIndex();
      if (idx === -1) {
        encounter.activeId = encounter.order[0];
      } else {
        idx++;
        if (idx >= encounter.order.length) {
          idx = 0;
          encounter.round = (encounter.round || 1) + 1;
          updateRoundUI();
        }
        encounter.activeId = encounter.order[idx];
      }
      saveEncounter();
      renderCards();
      updateTurnOrderStrip();
      updateTurnLabel();
    });

    encPrevTurnBtn.addEventListener("click", () => {
      if (!encounter.order.length) return;
      let idx = getActiveIndex();
      if (idx === -1) {
        encounter.activeId = encounter.order[0];
      } else {
        idx--;
        if (idx < 0) {
          idx = encounter.order.length - 1;
          if ((encounter.round || 1) > 1) {
            encounter.round -= 1;
            updateRoundUI();
          }
        }
        encounter.activeId = encounter.order[idx];
      }
      saveEncounter();
      renderCards();
      updateTurnOrderStrip();
      updateTurnLabel();
    });

    encClearEncounterBtn.addEventListener("click", () => {
      const ok = window.confirm("Clear all combatants and reset round/turn?");
      if (!ok) return;
      encounter = createEmptyEncounter();
      saveEncounter();
      encRoundInput.value = "1";
      updateRoundUI();
      updateTurnOrderStrip();
      renderCards();
      updateTurnLabel();
    });

    encToggleFormBtn.addEventListener("click", () => {
      const isHidden = encFormWrapper.style.display === "none";
      encFormWrapper.style.display = isHidden ? "block" : "none";
      encToggleFormBtn.textContent = isHidden ? "Hide editor" : "Show editor";
    });

    encFormWrapper.style.display = "block";

    encForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = (encNameInput.value || "").trim() || "Unnamed";
      const type = encTypeSelect.value || "pc";
      const ac = parseInt(encAcInput.value, 10) || 10;
      const speed = parseInt(encSpeedInput.value, 10) || 30;
      const maxHp = parseInt(encMaxHpInput.value, 10) || 0;
      const init = parseInt(encInitInput.value, 10) || 0;

      function finalizeAdd(portraitData) {
        const base = {
          name,
          type,
          ac,
          speed,
          maxHp,
          initiative: init,
          portraitData: portraitData || null
        };

        let id = editingId;
        if (!id) {
          id = generateId();
        }

        const existing = encounter.combatants[id] || {};
        const currentHp =
          typeof existing.currentHp === "number"
            ? existing.currentHp
            : maxHp;

        const updated = {
          id,
          ...base,
          currentHp,
          isDead: currentHp <= 0 && maxHp > 0
        };

        encounter.combatants[id] = updated;

        if (!encounter.order.includes(id)) {
          encounter.order.push(id);
        }

        sortOrderByInitiative();
        if (!encounter.activeId) {
          encounter.activeId = id;
        }

        saveEncounter();
        renderCards();
        updateTurnOrderStrip();
        updateTurnLabel();

        // Reset form for next entry
        editingId = null;
        encAddBtn.textContent = "Add / Update";
        encForm.reset();
        encAcInput.value = ac;
        encSpeedInput.value = speed;
        encMaxHpInput.value = maxHp;
        encInitInput.value = init;
      }

      const file = encPortraitInput.files && encPortraitInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          finalizeAdd(dataUrl);
        };
        reader.readAsDataURL(file);
      } else {
        finalizeAdd(null);
      }
    });

    // Party management
    encPartySummary.textContent = describeParty(party);

    encLoadPartyBtn.addEventListener("click", () => {
      if (!party.members || !party.members.length) {
        window.alert("No party saved yet. Use 'Manage party' to define PCs.");
        return;
      }

      party.members.forEach((m) => {
        const id = generateId();
        const c = {
          id,
          name: m.name || "Unnamed",
          type: "pc",
          ac: m.ac ?? 10,
          speed: m.speed ?? 30,
          maxHp: m.maxHp ?? 0,
          currentHp: m.maxHp ?? 0,
          initiative: 0,
          isDead: false,
          portraitData: m.portraitData || null
        };
        encounter.combatants[id] = c;
        encounter.order.push(id);
      });

      sortOrderByInitiative();
      if (encounter.order.length && !encounter.activeId) {
        encounter.activeId = encounter.order[0];
      }

      saveEncounter();
      renderCards();
      updateTurnOrderStrip();
      updateTurnLabel();
    });

    encManagePartyBtn.addEventListener("click", () => {
      const panel = document.getElementById("generatorPanel");
      if (!panel) return;

      setLabelText("Encounter / Initiative · Manage Party");

      panel.innerHTML = `
        <div class="muted" style="margin-bottom:4px;">
          Define your core party here. These entries can be quickly added to any encounter.
        </div>

        <div style="
          border:1px solid #222832;
          border-radius:10px;
          background:#05070c;
          padding:8px 8px 6px;
          margin-bottom:8px;
        ">
          <div class="section-title" style="margin-bottom:4px;">
            <span>Party Members</span>
            <button id="encPartyBackBtn" class="btn-secondary btn-small" type="button">← Back to encounter</button>
          </div>
          <div id="encPartyList" style="display:flex; flex-direction:column; gap:4px;"></div>
        </div>

        <div style="
          border:1px solid #222832;
          border-radius:10px;
          background:#05070c;
          padding:8px 8px 6px;
        ">
          <div class="section-title" style="margin-bottom:4px;">
            <span>Add / Edit Party Member</span>
          </div>
          <form id="encPartyForm" style="display:flex; flex-wrap:wrap; gap:6px; align-items:flex-end;">
            <div style="flex:1; min-width:160px;">
              <label for="encPartyNameInput">Name</label>
              <input id="encPartyNameInput" type="text" placeholder="PC name">
            </div>
            <div style="width:80px;">
              <label for="encPartyAcInput">AC</label>
              <input id="encPartyAcInput" type="number" min="0" value="15">
            </div>
            <div style="width:80px;">
              <label for="encPartySpeedInput">Speed</label>
              <input id="encPartySpeedInput" type="number" min="0" value="30">
            </div>
            <div style="width:100px;">
              <label for="encPartyMaxHpInput">Max HP</label>
              <input id="encPartyMaxHpInput" type="number" min="0" value="30">
            </div>
            <div style="width:140px;">
              <label for="encPartyPortraitInput">Portrait</label>
              <input id="encPartyPortraitInput" type="file" accept="image/*">
            </div>
            <div style="width:140px;">
              <button id="encPartyAddBtn" class="btn-primary" type="submit">Add / Update</button>
            </div>
          </form>
        </div>
      `;

      const partyListEl = panel.querySelector("#encPartyList");
      const partyBackBtn = panel.querySelector("#encPartyBackBtn");
      const partyForm = panel.querySelector("#encPartyForm");
      const partyNameInput = panel.querySelector("#encPartyNameInput");
      const partyAcInput = panel.querySelector("#encPartyAcInput");
      const partySpeedInput = panel.querySelector("#encPartySpeedInput");
      const partyMaxHpInput = panel.querySelector("#encPartyMaxHpInput");
      const partyPortraitInput = panel.querySelector("#encPartyPortraitInput");
      const partyAddBtn = panel.querySelector("#encPartyAddBtn");

      let editingPartyId = null;

      function ensurePartyArray() {
        if (!party.members || !Array.isArray(party.members)) {
          party.members = [];
        }
      }

      function renderPartyList() {
        ensurePartyArray();
        partyListEl.innerHTML = "";
        if (!party.members.length) {
          partyListEl.innerHTML = `<div class="muted" style="font-size:0.78rem;">No party members defined yet.</div>`;
          return;
        }
        party.members.forEach((m) => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.justifyContent = "space-between";
          row.style.padding = "4px 6px";
          row.style.borderRadius = "8px";
          row.style.border = "1px solid #222832";
          row.style.background = "#080b11";

          const left = document.createElement("div");
          left.style.display = "flex";
          left.style.flexDirection = "column";

          const name = document.createElement("div");
          name.style.fontSize = "0.84rem";
          name.style.fontWeight = "600";
          name.textContent = m.name || "Unnamed";

          const stats = document.createElement("div");
          stats.style.fontSize = "0.76rem";
          stats.style.color = "#c0c4cc";
          stats.textContent = `AC ${m.ac ?? "-"}, Speed ${m.speed ?? "-"}, Max HP ${m.maxHp ?? "-"}`;

          left.appendChild(name);
          left.appendChild(stats);

          const right = document.createElement("div");
          right.style.display = "flex";
          right.style.gap = "4px";

          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "btn-secondary btn-small";
          editBtn.textContent = "Edit";

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn-secondary btn-small";
          removeBtn.textContent = "✕";

          editBtn.addEventListener("click", () => {
            editingPartyId = m.id;
            partyNameInput.value = m.name || "";
            partyAcInput.value = m.ac ?? 15;
            partySpeedInput.value = m.speed ?? 30;
            partyMaxHpInput.value = m.maxHp ?? 30;
            partyAddBtn.textContent = "Update member";
          });

          removeBtn.addEventListener("click", () => {
            ensurePartyArray();
            const idx = party.members.findIndex(x => x.id === m.id);
            if (idx !== -1) {
              party.members.splice(idx, 1);
              saveParty();
              renderPartyList();
              encPartySummary.textContent = describeParty(party);
            }
          });

          right.appendChild(editBtn);
          right.appendChild(removeBtn);

          row.appendChild(left);
          row.appendChild(right);

          partyListEl.appendChild(row);
        });
      }

      renderPartyList();

      partyBackBtn.addEventListener("click", () => {
        // Re-render the encounter tool
        renderEncounterTool();
      });

      partyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = (partyNameInput.value || "").trim() || "Unnamed";
        const ac = parseInt(partyAcInput.value, 10) || 15;
        const speed = parseInt(partySpeedInput.value, 10) || 30;
        const maxHp = parseInt(partyMaxHpInput.value, 10) || 30;

        function finalizePartyAdd(portraitData) {
          ensurePartyArray();
          let id = editingPartyId;
          if (!id) {
            id = generateId();
          }

          const existingIdx = party.members.findIndex(m => m.id === id);
          const member = {
            id,
            name,
            ac,
            speed,
            maxHp,
            portraitData: portraitData || (existingIdx !== -1 ? party.members[existingIdx].portraitData || null : null)
          };

          if (existingIdx !== -1) {
            party.members[existingIdx] = member;
          } else {
            party.members.push(member);
          }

          saveParty();
          encPartySummary.textContent = describeParty(party);
          renderPartyList();

          editingPartyId = null;
          partyAddBtn.textContent = "Add member";
          partyForm.reset();
          partyAcInput.value = ac;
          partySpeedInput.value = speed;
          partyMaxHpInput.value = maxHp;
        }

        const file = partyPortraitInput.files && partyPortraitInput.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            finalizePartyAdd(ev.target.result);
          };
          reader.readAsDataURL(file);
        } else {
          finalizePartyAdd(null);
        }
      });
    });
  }

  // ---------- Hook into existing toolbox ----------

  // Require that the base script has created window.toolsConfig
  if (typeof window === "undefined" || !window.toolsConfig || !Array.isArray(window.toolsConfig)) {
    console.warn("[Encounter Tool] toolsConfig not found. Make sure tool-encounter.js is loaded AFTER the main script.");
    return;
  }
  if (typeof window.renderToolPanel !== "function") {
    console.warn("[Encounter Tool] renderToolPanel not found. Make sure tool-encounter.js is loaded AFTER the main script.");
    return;
  }

  // Add this tool to the Tools list on the left.
  window.toolsConfig.push({
    id: "encounterInitiative",
    name: "Encounter / Initiative",
    description: "Track combat rounds, initiative, HP, AC, and speed for PCs and enemies."
  });

  // Refresh the tools nav so it appears immediately
  if (typeof window.renderToolsNav === "function") {
    window.renderToolsNav();
  }

  // Keep a reference to the original tool renderer
  const originalRenderToolPanel = window.renderToolPanel;

  // Override renderToolPanel to handle our new tool id
  window.renderToolPanel = function (toolId) {
    if (toolId !== "encounterInitiative") {
      return originalRenderToolPanel(toolId);
    }
    renderEncounterTool();
  };
})();
