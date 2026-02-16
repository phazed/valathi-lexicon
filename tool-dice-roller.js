// tool-dice-roller.js
// Registers the Dice Roller tool.

(function () {
  if (!window.registerTool) {
    console.warn("Dice Roller tool: registerTool not found yet.");
    return;
  }

  function rollDiceExpression(expr) {
    let text = (expr || "").toString().trim().toLowerCase();
    if (!text) throw new Error("Empty expression");
    text = text.replace(/\s+/g, "");

    const regex = /([+-])?(\d*)d(\d+)|([+-])?(\d+)/g;
    let match;
    let total = 0;
    const terms = [];
    let found = false;

    while ((match = regex.exec(text)) !== null) {
      found = true;
      if (match[3]) {
        const sign = match[1] === "-" ? -1 : 1;
        const count = match[2] ? parseInt(match[2], 10) : 1;
        const faces = parseInt(match[3], 10);
        if (!faces || !count) continue;
        const rolls = [];
        for (let i = 0; i < count; i++) {
          const r = Math.floor(Math.random() * faces) + 1;
          rolls.push(r);
        }
        const subtotal = rolls.reduce((a, b) => a + b, 0) * sign;
        total += subtotal;
        terms.push({ type: "dice", sign, count, faces, rolls, subtotal });
      } else if (match[5]) {
        const sign = match[4] === "-" ? -1 : 1;
        const value = parseInt(match[5], 10);
        const subtotal = value * sign;
        total += subtotal;
        terms.push({ type: "mod", sign, value, subtotal });
      }
    }

    if (!found) throw new Error("Invalid dice expression");
    return { total, terms };
  }

  function formatTermSegments(terms) {
    if (!terms || !terms.length) return "";
    let first = true;
    let str = "";
    for (const term of terms) {
      const val = term.subtotal;
      if (first) {
        str = String(val);
        first = false;
      } else {
        if (val >= 0) {
          str += " + " + val;
        } else {
          str += " - " + (-val);
        }
      }
    }
    return str;
  }

  function showCopyMessage(panelEl, text) {
    const msg = panelEl.querySelector("#copyMessage");
    if (!msg) return;
    msg.textContent = `Copied: "${text}"`;
    setTimeout(() => {
      if (!msg.isConnected) return;
      msg.textContent = "Click any line to copy the text. History shows last 10 rolls.";
    }, 2000);
  }

  window.registerTool({
    id: "diceRoller",
    name: "Dice Roller",
    description: "Roll D&D-style dice (1d20, 4d6+2, etc.).",
    render({ panelEl }) {
      panelEl.innerHTML = `
        <div class="muted" style="margin-bottom:4px;">
          Enter expressions like <code>1d20</code>, <code>4d6+2</code>, or <code>2d6+1d4+3</code>.
          Use <b>Adv</b>/<b>Dis</b> toggles for advantage / disadvantage (rolls the expression twice and picks high/low).
        </div>
        <div class="row">
          <div class="col">
            <label for="diceExprInput">Dice expression</label>
            <input id="diceExprInput" type="text" placeholder="e.g. 1d20+5" />
          </div>
          <div class="col">
            <label>&nbsp;</label>
            <button id="diceRollBtn" class="btn-primary">Roll</button>
          </div>
        </div>
        <div class="row">
          <div class="col">
            <label>Quick rolls</label>
            <div style="display:flex; flex-wrap:wrap; gap:4px;">
              <button class="btn-secondary btn-small dice-quick" data-exp="1d4">d4</button>
              <button class="btn-secondary btn-small dice-quick" data-exp="1d6">d6</button>
              <button class="btn-secondary btn-small dice-quick" data-exp="1d8">d8</button>
              <button class="btn-secondary btn-small dice-quick" data-exp="1d10">d10</button>
              <button class="btn-secondary btn-small dice-quick" data-exp="1d12">d12</button>
              <button class="btn-secondary btn-small dice-quick" data-exp="1d20">d20</button>
              <button class="btn-secondary btn-small dice-quick" data-exp="1d100">d100</button>
            </div>
          </div>
          <div class="col">
            <label>Advantage / Disadvantage</label>
            <div style="display:flex; flex-wrap:wrap; gap:4px;">
              <button id="diceAdvToggle" class="btn-secondary btn-small" type="button">Adv</button>
              <button id="diceDisToggle" class="btn-secondary btn-small" type="button">Dis</button>
            </div>
          </div>
        </div>
        <div id="diceResults" class="generated-list"></div>
        <div id="copyMessage" class="copy-tip">Click any line to copy the text. History shows last 10 rolls.</div>
      `;

      const exprInput = panelEl.querySelector("#diceExprInput");
      const rollBtn = panelEl.querySelector("#diceRollBtn");
      const quickButtons = panelEl.querySelectorAll(".dice-quick");
      const advToggle = panelEl.querySelector("#diceAdvToggle");
      const disToggle = panelEl.querySelector("#diceDisToggle");
      const resultsDiv = panelEl.querySelector("#diceResults");

      let advMode = null;
      let history = [];

      function setAdvMode(mode) {
        advMode = mode;
        advToggle.classList.remove("toggle-active");
        disToggle.classList.remove("toggle-active");
        if (mode === "adv") advToggle.classList.add("toggle-active");
        if (mode === "dis") disToggle.classList.add("toggle-active");
      }

      function addHistoryLine(line) {
        history.unshift(line);
        if (history.length > 10) history.pop();
        resultsDiv.innerHTML = "";
        const frag = document.createDocumentFragment();
        history.forEach(txt => {
          const div = document.createElement("div");
          div.className = "generated-item";
          div.textContent = txt;
          frag.appendChild(div);
        });
        resultsDiv.appendChild(frag);
      }

      function doExprRoll() {
        let expr = (exprInput.value || "").trim();
        if (!expr) expr = "1d20";
        try {
          if (!advMode) {
            const result = rollDiceExpression(expr);
            const seg = formatTermSegments(result.terms);
            const line = seg
              ? `${expr} = ${result.total} [${seg}]`
              : `${expr} = ${result.total}`;
            addHistoryLine(line);
          } else {
            const first = rollDiceExpression(expr);
            const second = rollDiceExpression(expr);
            const chosen =
              advMode === "adv"
                ? (first.total >= second.total ? first : second)
                : (first.total <= second.total ? first : second);
            const other = chosen === first ? second : first;
            const seg1 = formatTermSegments(first.terms);
            const seg2 = formatTermSegments(second.terms);
            const label = advMode === "adv" ? "adv" : "dis";
            const line = `${expr} (${label}) = ${chosen.total} [${first.total} (${seg1}) vs ${second.total} (${seg2})]`;
            addHistoryLine(line);
          }
        } catch (err) {
          const msg = err && err.message ? err.message : "Invalid expression.";
          addHistoryLine(`Error: ${msg}`);
        }
      }

      if (rollBtn) {
        rollBtn.addEventListener("click", doExprRoll);
      }
      if (exprInput) {
        exprInput.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            doExprRoll();
          }
        });
      }

      quickButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          const exp = btn.dataset.exp;
          if (!exp) return;
          exprInput.value = exp;
          doExprRoll();
        });
      });

      advToggle.addEventListener("click", () => {
        if (advMode === "adv") setAdvMode(null);
        else setAdvMode("adv");
      });
      disToggle.addEventListener("click", () => {
        if (advMode === "dis") setAdvMode(null);
        else setAdvMode("dis");
      });

      resultsDiv.addEventListener("click", e => {
        const item = e.target.closest(".generated-item");
        if (!item) return;
        const text = item.textContent.trim();
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            () => showCopyMessage(panelEl, text),
            () => showCopyMessage(panelEl, text)
          );
        } else {
          showCopyMessage(panelEl, text);
        }
      });
    }
  });
})();
