// tool-text-cleaner.js
(function () {
  const { cleanTextForGenerator, showCopyMessage } = window.toolboxHelpers || {};

  window.registerTool({
    id: "textCleaner",
    name: "Text Cleaner",
    description: "Clean numbered / multi-column lists into one-entry-per-line.",
    render(panel) {
      panel.innerHTML = `
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

      const cleanRunBtn = panel.querySelector("#cleanRunBtn");
      const cleanCopyBtn = panel.querySelector("#cleanCopyBtn");
      const cleanInput = panel.querySelector("#cleanInput");
      const cleanOutput = panel.querySelector("#cleanOutput");

      if (!cleanRunBtn || !cleanCopyBtn || !cleanInput || !cleanOutput) return;

      cleanRunBtn.addEventListener("click", () => {
        const raw = cleanInput.value || "";
        const cleaned = cleanTextForGenerator ? cleanTextForGenerator(raw) : raw;
        cleanOutput.value = cleaned;
      });

      cleanCopyBtn.addEventListener("click", () => {
        const val = cleanOutput.value || "";
        if (!val.trim()) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val)
            .then(() => {
              if (showCopyMessage) {
                showCopyMessage(
                  val.split("\n")[0] + (val.includes("\n") ? " ..." : "")
                );
              }
            })
            .catch(() => {
              if (showCopyMessage) showCopyMessage("Cleaned text");
            });
        } else if (showCopyMessage) {
          showCopyMessage("Cleaned text");
        }
      });
    }
  });
})();
