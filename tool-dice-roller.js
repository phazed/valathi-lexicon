// tool-dice-roller.js
(function () {
  const { rollDiceExpression, formatTermSegments, handleCopyClick } = window.toolboxHelpers || {};

  window.registerTool({
    id: "diceRoller",
    name: "Dice Roller",
    description: "Roll D&D-style dice (1d20, 4d6+2, etc.).",
    render(panel) {
      panel.innerHTML = `
        <div class="muted" style="margin-bottom:4px;">
          Enter expressions like <code>1d20</code>, <code>4d6+2</code>, or <code>2d6+1d4+3</code>.<br/>
          Use <b>Adv</b>/<b>Dis</b> to roll twice and pick high/low. History shows last 10 rolls.
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

      const exprInput = panel.querySelector("#diceExprInput");
      const rollBtn = panel.querySelector("#diceRollBtn");
      const quickButtons = panel.querySelectorAll(".dice-quick");
      const advToggle = panel.querySelector("#diceAdvToggle");
      const disToggle = panel.querySelector("#diceDisToggle");
      const resultsDiv = panel.querySelector("#diceResults");

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
        renderHistory();
      }

      function renderHistory() {
        resultsDiv.innerHTML = "";
        const frag = document.createDocumentFragment();
        history.forEach(line => {
          const div = document.createElement("div");
          div.className = "generated-item";
          div.textContent = line;
          frag.appendChild(div);
        });
        resultsDiv.appendChild(frag);
        resultsDiv.addEventListener("click", handleCopyClick);
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
            const chosen = advMode === "adv"
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

      rollBtn.addEventListener("click", doExprRoll);
      exprInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doExprRoll();
        }
      });

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
    }
  });
})();
