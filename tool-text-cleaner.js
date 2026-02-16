// tool-text-cleaner.js
// Registers the Text Cleaner tool with the Vrahune toolbox.

(function () {
  if (!window.registerTool) {
    console.warn("Text Cleaner tool: registerTool not found yet.");
    return;
  }

  function cleanTextForGenerator(raw) {
    if (!raw) return "";

    let replaced = raw.replace(/\r\n/g, "\n");
    replaced = replaced.replace(/(^|\s)(\d+)(?=[\.\)]?\s*[A-Za-z])/g, "\n$2");

    const lines = replaced.split(/\n+/);
    const cleaned = [];

    for (let line of lines) {
      let t = line.trim();
      if (!t) continue;

      t = t.replace(/^[\-\*\u2022]+\s*/, "");
      t = t.replace(/^\d+[\.\)]?\s*/, "");
      t = t.replace(/\s{2,}/g, " ");
      t = t.trim().replace(/[,\s]+$/, "").trim();

      if (t) cleaned.push(t);
    }

    return cleaned.join("\n");
  }

  function showCopyMessage(panelEl, text) {
    const msg = panelEl.querySelector("#copyMessage");
    if (!msg) return;
    msg.textContent = `Copied: "${text}"`;
    setTimeout(() => {
      if (!msg.isConnected) return;
      msg.textContent = "Click an item or use “Copy cleaned text”.";
    }, 2000);
  }

  window.registerTool({
    id: "textCleaner",
    name: "Text Cleaner",
    description: "Clean numbered / multi-column lists into one-entry-per-line.",
    render({ panelEl }) {
      panelEl.innerHTML = `
        <div class="muted" style="margin-bottom:4px;">
          Paste messy, numbered or multi-column text (e.g. <code>4 Arrogant 54 Logical</code>) below,
          click <b>Clean text</b>, then copy the cleaned list for your generators.
        </div>
        <div class="toolbox-row">
          <div class="toolbox-col">
            <label for="cleanInput">Raw text</label>
            <textarea id="cleanInput" placeholder="4 Arrogant 54 Logical&#10;5 Blunt 55 Love-struck&#10;..."></textarea>
          </div>
          <div class="toolbox-col">
            <label for="cleanOutput">Cleaned · one item per line</label>
            <textarea id="cleanOutput" readonly></textarea>
          </div>
        </div>
        <div class="row" style="margin-top:4px;">
          <button id="cleanRunBtn" class="btn-primary btn-small" type="button">
            Clean text
          </button>
          <button id="cleanCopyBtn" class="btn-secondary btn-small" type="button">
            Copy cleaned text
          </button>
        </div>
        <div id="copyMessage" class="copy-tip">Click an item or use “Copy cleaned text”.</div>
      `;

      const cleanRunBtn = panelEl.querySelector("#cleanRunBtn");
      const cleanCopyBtn = panelEl.querySelector("#cleanCopyBtn");
      const cleanInput = panelEl.querySelector("#cleanInput");
      const cleanOutput = panelEl.querySelector("#cleanOutput");

      if (cleanRunBtn) {
        cleanRunBtn.addEventListener("click", () => {
          const raw = cleanInput.value || "";
          const cleaned = cleanTextForGenerator(raw);
          cleanOutput.value = cleaned;
        });
      }

      if (cleanCopyBtn) {
        cleanCopyBtn.addEventListener("click", () => {
          const val = cleanOutput.value || "";
          if (!val.trim()) return;
          const preview = val.split("\n")[0] + (val.includes("\n") ? " ..." : "");
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(
              () => showCopyMessage(panelEl, preview),
              () => showCopyMessage(panelEl, "Cleaned text")
            );
          } else {
            showCopyMessage(panelEl, preview);
          }
        });
      }
    }
  });
})();
