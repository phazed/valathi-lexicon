// tool-statblock-importer.js
(() => {
  const TOOL_ID = "statblockImporter";
  const TOOL_NAME = "Stat Block Importer";
  const STORAGE_KEY = "vrahuneStatblockImporterDraftsV2";
  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

  const state = {
    imageDataUrl: "",
    ocrText: "",
    parsed: null,
    status: "idle", // idle | loading-lib | ocr | done | error
    progress: 0,
    error: "",
    lastInputMethod: "",
  };

  // --------------------------
  // General helpers
  // --------------------------
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toInt(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function uniq(arr) {
    return [...new Set((arr || []).map((x) => String(x).trim()).filter(Boolean))];
  }

  function normalizeSpaces(s) {
    return String(s || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitLines(text) {
    return normalizeSpaces(text)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function listToLine(arr) {
    return (arr || []).join(", ");
  }

  function loadDrafts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveDrafts(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function addDraft(entry) {
    const drafts = loadDrafts();
    drafts.unshift(entry);
    saveDrafts(drafts.slice(0, 150));
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  async function setImageFromBlob(blob, { labelEl, panelEl, method = "" }) {
    if (!blob || !blob.type || !blob.type.startsWith("image/")) return false;
    state.imageDataUrl = await blobToDataURL(blob);
    state.error = "";
    state.status = "idle";
    state.progress = 0;
    state.lastInputMethod = method;
    render({ labelEl, panelEl });
    return true;
  }

  async function ensureTesseractLoaded() {
    if (window.Tesseract) return;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-vrahune-tool="tesseract"]');
      if (existing) {
        if (window.Tesseract) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const s = document.createElement("script");
      s.src = TESSERACT_CDN;
      s.async = true;
      s.dataset.vrahuneTool = "tesseract";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // --------------------------
  // OCR cleanup + normalization
  // --------------------------
  function repairCommonLabels(text) {
    let t = text;

    // fuzzy fixes for common OCR label errors
    const fixes = [
      [/Armor\s*Clas[s5]\b/gi, "Armor Class"],
      [/Arm0r\s*Class\b/gi, "Armor Class"],
      [/Hit\s*Point[s5]\b/gi, "Hit Points"],
      [/Proficienc[yv]\s*Bonus\b/gi, "Proficiency Bonus"],
      [/Saving\s*Throw[s5]\b/gi, "Saving Throws"],
      [/Damage\s*Resistan[ct]e[s5]\b/gi, "Damage Resistances"],
      [/Condition\s*Immunit(?:y|ies)\b/gi, "Condition Immunities"],
      [/Legendary\s*Action[s5]\b/gi, "Legendary Actions"],
      [/Bonus\s*Action[s5]\b/gi, "Bonus Actions"],
      [/Reaction[s5]\b/gi, "Reactions"],
    ];
    for (const [re, rep] of fixes) t = t.replace(re, rep);

    // normalize punctuation/spacing
    t = t
      .replace(/[|¦]/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ");

    // force label starts onto new lines to reduce bleed
    const labels = [
      "Armor Class",
      "Hit Points",
      "Speed",
      "STR",
      "DEX",
      "CON",
      "INT",
      "WIS",
      "CHA",
      "Saving Throws",
      "Skills",
      "Damage Vulnerabilities",
      "Damage Resistances",
      "Damage Immunities",
      "Condition Immunities",
      "Senses",
      "Languages",
      "Challenge",
      "Proficiency Bonus",
      "Habitat",
      "Environment",
      "Actions",
      "Bonus Actions",
      "Reactions",
      "Legendary Actions",
    ];

    for (const label of labels) {
      const re = new RegExp(`\\s(${label})\\b`, "g");
      t = t.replace(re, "\n$1");
    }

    return normalizeSpaces(t);
  }

  // --------------------------
  // Parsing logic
  // --------------------------
  function findSectionIndex(lines, sectionName) {
    const rx = new RegExp(`^${sectionName}$`, "i");
    return lines.findIndex((l) => rx.test(l.trim()));
  }

  function firstLineMatch(lines, regex) {
    for (const l of lines) {
      const m = regex.exec(l);
      if (m) return m;
    }
    return null;
  }

  function parseAcFromText(text, lines) {
    const lineM = firstLineMatch(lines, /\bArmor Class\b\s*(\d{1,2})(?:\s*\(([^)]+)\))?/i);
    if (lineM) {
      const ac = toInt(lineM[1], 10);
      return {
        value: clamp(ac, 1, 30),
        notes: (lineM[2] || "").trim(),
        confidence: ac >= 1 && ac <= 30 ? "high" : "low",
      };
    }

    const inlineM = /\bArmor Class\b[^0-9]{0,12}(\d{1,2})(?:\s*\(([^)]+)\))?/i.exec(text);
    if (inlineM) {
      const ac = toInt(inlineM[1], 10);
      return {
        value: clamp(ac, 1, 30),
        notes: (inlineM[2] || "").trim(),
        confidence: ac >= 1 && ac <= 30 ? "medium" : "low",
      };
    }

    return { value: 10, notes: "", confidence: "low" };
  }

  function parseHpFromText(text, lines) {
    const lineM = firstLineMatch(lines, /\bHit Points?\b\s*(\d{1,4})(?:\s*\(([^)]+)\))?/i);
    if (lineM) {
      const hp = toInt(lineM[1], 1);
      return {
        value: clamp(hp, 1, 9999),
        formula: (lineM[2] || "").trim(),
        confidence: hp > 0 ? "high" : "low",
      };
    }

    const inlineM = /\bHit Points?\b[^0-9]{0,16}(\d{1,4})(?:\s*\(([^)]+)\))?/i.exec(text);
    if (inlineM) {
      const hp = toInt(inlineM[1], 1);
      return {
        value: clamp(hp, 1, 9999),
        formula: (inlineM[2] || "").trim(),
        confidence: hp > 0 ? "medium" : "low",
      };
    }

    return { value: 1, formula: "", confidence: "low" };
  }

  function parseSpeedFromText(text, lines) {
    const lineM = firstLineMatch(lines, /\bSpeed\b\s*([^.\n]+)/i);
    if (lineM) {
      const speed = lineM[1].trim();
      return {
        value: speed || "30 ft.",
        confidence: /\bft\b/i.test(speed) ? "high" : "medium",
      };
    }

    const inlineM = /\bSpeed\b\s*([^.\n]+)/i.exec(text);
    if (inlineM) {
      const speed = inlineM[1].trim();
      return {
        value: speed || "30 ft.",
        confidence: /\bft\b/i.test(speed) ? "medium" : "low",
      };
    }

    return { value: "30 ft.", confidence: "low" };
  }

  function parseCrXpPb(text, lines) {
    let cr = "1/8";
    let xp = 0;
    let pb = 2;
    let crConf = "low";
    let pbConf = "low";

    const crLine = firstLineMatch(lines, /\bChallenge\b\s*([0-9]+(?:\/[0-9]+)?)(?:\s*\(([\d,]+)\s*XP\))?/i);
    if (crLine) {
      cr = crLine[1];
      xp = crLine[2] ? toInt(String(crLine[2]).replace(/,/g, ""), 0) : 0;
      crConf = "high";
    } else {
      const crInline = /\b(?:Challenge|CR)\b[^0-9/]{0,10}([0-9]+(?:\/[0-9]+)?)/i.exec(text);
      if (crInline) {
        cr = crInline[1];
        crConf = "medium";
      }
    }

    const pbLine = firstLineMatch(lines, /\bProficiency Bonus\b\s*([+\-]?\d+)/i)
      || firstLineMatch(lines, /\bPB\b\s*([+\-]?\d+)/i);
    if (pbLine) {
      pb = clamp(toInt(pbLine[1], 2), -5, 20);
      pbConf = "high";
    } else {
      const pbInline = /\b(?:Proficiency Bonus|PB)\b[^+\-\d]{0,8}([+\-]?\d+)/i.exec(text);
      if (pbInline) {
        pb = clamp(toInt(pbInline[1], 2), -5, 20);
        pbConf = "medium";
      }
    }

    return { cr, xp, pb, crConf, pbConf };
  }

  function parseAbilities(lines, text) {
    const out = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, confidence: "low" };

    // Best case: explicit labels present
    const combined = lines.join(" ");
    const statRegex = /\b(STR|DEX|CON|INT|WIS|CHA)\s+(\d{1,2})\b/gi;
    let m;
    const found = {};
    while ((m = statRegex.exec(combined)) !== null) {
      found[m[1].toLowerCase()] = clamp(toInt(m[2], 10), 1, 30);
    }
    if (Object.keys(found).length >= 4) {
      out.str = found.str ?? out.str;
      out.dex = found.dex ?? out.dex;
      out.con = found.con ?? out.con;
      out.int = found.int ?? out.int;
      out.wis = found.wis ?? out.wis;
      out.cha = found.cha ?? out.cha;
      out.confidence = Object.keys(found).length === 6 ? "high" : "medium";
      return out;
    }

    // Fallback: sequence of six ability numbers in plausible range
    const nums = (combined.match(/\b([1-2]?\d|30)\b/g) || []).map((x) => toInt(x, NaN)).filter((n) => n >= 1 && n <= 30);
    if (nums.length >= 6) {
      out.str = nums[0];
      out.dex = nums[1];
      out.con = nums[2];
      out.int = nums[3];
      out.wis = nums[4];
      out.cha = nums[5];
      out.confidence = "low";
    }

    return out;
  }

  function parseLabeledList(lines, labelRegex) {
    const m = firstLineMatch(lines, new RegExp(`\\b(?:${labelRegex})\\b\\s*(.+)$`, "i"));
    if (!m) return [];
    return uniq(
      m[1]
        .split(/[,;]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    );
  }

  function parseTitleEntriesFromLines(lines) {
    const items = [];
    let current = null;

    const isTitleLine = (line) => /^[A-Z][A-Za-z0-9'’\-\s]{2,100}\.\s+/.test(line);

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (isTitleLine(line)) {
        if (current) items.push(current);
        const i = line.indexOf(".");
        current = {
          name: line.slice(0, i).trim(),
          text: line.slice(i + 1).trim(),
        };
      } else if (current) {
        current.text += " " + line;
      } else {
        // Unheaded text -> generic entry
        current = { name: "Feature", text: line };
      }
    }
    if (current) items.push(current);

    return items.map((x) => ({ name: x.name.trim(), text: normalizeSpaces(x.text) })).filter((x) => x.text);
  }

  function splitSections(lines) {
    const idx = {
      actions: findSectionIndex(lines, "Actions"),
      bonusActions: findSectionIndex(lines, "Bonus Actions"),
      reactions: findSectionIndex(lines, "Reactions"),
      legendaryActions: findSectionIndex(lines, "Legendary Actions"),
    };

    const allStarts = Object.values(idx).filter((n) => n >= 0).sort((a, b) => a - b);

    function sectionSlice(startIdx) {
      if (startIdx < 0) return [];
      const next = allStarts.find((n) => n > startIdx);
      const end = next >= 0 ? next : lines.length;
      return lines.slice(startIdx + 1, end);
    }

    // Traits are lines before first explicit section after we skip obvious core/meta area
    const firstSection = allStarts.length ? allStarts[0] : lines.length;
    const pre = lines.slice(0, firstSection);

    return {
      pre,
      actions: sectionSlice(idx.actions),
      bonusActions: sectionSlice(idx.bonusActions),
      reactions: sectionSlice(idx.reactions),
      legendaryActions: sectionSlice(idx.legendaryActions),
    };
  }

  function parseStatBlock(rawInput) {
    const cleaned = repairCommonLabels(rawInput);
    const text = normalizeSpaces(cleaned);
    const lines = splitLines(text);

    // Name + subtitle
    const name = lines[0] || "Unknown Monster";
    const subtitle = lines[1] || "";

    let sizeType = "";
    let alignment = "";
    const subM = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,]+),\s*(.+)$/i.exec(subtitle);
    if (subM) {
      sizeType = `${subM[1]} ${subM[2]}`.trim();
      alignment = subM[3].trim();
    } else {
      sizeType = subtitle.trim();
    }

    const acP = parseAcFromText(text, lines);
    const hpP = parseHpFromText(text, lines);
    const speedP = parseSpeedFromText(text, lines);
    const cxp = parseCrXpPb(text, lines);
    const abil = parseAbilities(lines, text);

    const saves = parseLabeledList(lines, "Saving Throws");
    const skills = parseLabeledList(lines, "Skills");
    const vulnerabilities = parseLabeledList(lines, "Damage Vulnerabilities");
    const resistances = parseLabeledList(lines, "Damage Resistances");
    const immunities = parseLabeledList(lines, "Damage Immunities");
    const conditionImmunities = parseLabeledList(lines, "Condition Immunities");
    const senses = parseLabeledList(lines, "Senses");
    const languages = parseLabeledList(lines, "Languages");
    const habitats = parseLabeledList(lines, "Habitat|Environment");

    const sec = splitSections(lines);

    // Remove obvious core/meta lines from pre before traits parsing
    const metaLabelRx = /^(Armor Class|Hit Points|Speed|STR|DEX|CON|INT|WIS|CHA|Saving Throws|Skills|Damage Vulnerabilities|Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus|Habitat|Environment)\b/i;
    const traitCandidateLines = sec.pre.filter((l, i) => i > 1 && !metaLabelRx.test(l));

    const traits = parseTitleEntriesFromLines(traitCandidateLines);
    const actions = parseTitleEntriesFromLines(sec.actions);
    const bonusActions = parseTitleEntriesFromLines(sec.bonusActions);
    const reactions = parseTitleEntriesFromLines(sec.reactions);
    const legendaryActions = parseTitleEntriesFromLines(sec.legendaryActions);

    // unmapped text = lines not consumed by recognized sections but likely content
    const unmapped = [];
    if (!actions.length && findSectionIndex(lines, "Actions") >= 0) {
      unmapped.push("Could not confidently parse Actions section.");
    }
    if (!traits.length && traitCandidateLines.length) {
      unmapped.push(traitCandidateLines.join("\n"));
    }

    const fieldConfidence = {
      ac: acP.confidence,
      hp: hpP.confidence,
      speed: speedP.confidence,
      cr: cxp.crConf,
      pb: cxp.pbConf,
      abilities: abil.confidence,
    };

    return {
      id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      source: "Imported Screenshot",
      sourceType: "homebrew",

      sizeType,
      alignment,

      ac: acP.value,
      acText: acP.notes,
      hp: hpP.value,
      hpFormula: hpP.formula,
      speed: speedP.value,

      cr: cxp.cr,
      xp: cxp.xp,
      proficiencyBonus: cxp.pb,

      str: abil.str,
      dex: abil.dex,
      con: abil.con,
      int: abil.int,
      wis: abil.wis,
      cha: abil.cha,

      saves,
      skills,
      vulnerabilities,
      resistances,
      immunities,
      conditionImmunities,
      senses,
      languages,
      habitats,

      traits,
      actions,
      bonusActions,
      reactions,
      legendaryActions,

      unmappedText: unmapped.filter(Boolean).join("\n\n").trim(),

      importedAt: new Date().toISOString(),
      importedFrom: "screenshot-ocr",
      confidence: fieldConfidence,
      cleanedOcrText: cleaned,
    };
  }

  // --------------------------
  // UI mapping helpers
  // --------------------------
  function entriesToText(entries) {
    return (entries || []).map((e) => `${e.name}. ${e.text}`).join("\n");
  }

  function parseEntriesFromTextarea(text) {
    const lines = splitLines(text || "");
    return parseTitleEntriesFromLines(lines);
  }

  function collectReviewed(panelEl) {
    if (!state.parsed) return null;
    const q = (id) => panelEl.querySelector(`#${id}`);

    return {
      ...state.parsed,
      name: (q("sbi-name")?.value || "").trim() || "Unknown Monster",
      sizeType: (q("sbi-sizeType")?.value || "").trim(),
      alignment: (q("sbi-alignment")?.value || "").trim(),

      ac: clamp(toInt(q("sbi-ac")?.value, 10), 1, 30),
      acText: (q("sbi-acText")?.value || "").trim(),
      hp: clamp(toInt(q("sbi-hp")?.value, 1), 1, 9999),
      hpFormula: (q("sbi-hpFormula")?.value || "").trim(),
      speed: (q("sbi-speed")?.value || "").trim() || "30 ft.",

      cr: (q("sbi-cr")?.value || "").trim() || "1/8",
      xp: Math.max(0, toInt(q("sbi-xp")?.value, 0)),
      proficiencyBonus: clamp(toInt(q("sbi-pb")?.value, 2), -5, 20),

      str: clamp(toInt(q("sbi-str")?.value, 10), 1, 30),
      dex: clamp(toInt(q("sbi-dex")?.value, 10), 1, 30),
      con: clamp(toInt(q("sbi-con")?.value, 10), 1, 30),
      int: clamp(toInt(q("sbi-int")?.value, 10), 1, 30),
      wis: clamp(toInt(q("sbi-wis")?.value, 10), 1, 30),
      cha: clamp(toInt(q("sbi-cha")?.value, 10), 1, 30),

      saves: uniq((q("sbi-saves")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      skills: uniq((q("sbi-skills")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      vulnerabilities: uniq((q("sbi-vuln")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      resistances: uniq((q("sbi-resist")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      immunities: uniq((q("sbi-immune")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      conditionImmunities: uniq((q("sbi-condImm")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      senses: uniq((q("sbi-senses")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      languages: uniq((q("sbi-languages")?.value || "").split(/[,;]+/).map((x) => x.trim())),
      habitats: uniq((q("sbi-habitats")?.value || "").split(/[,;]+/).map((x) => x.trim())),

      traits: parseEntriesFromTextarea(q("sbi-traits")?.value || ""),
      actions: parseEntriesFromTextarea(q("sbi-actions")?.value || ""),
      bonusActions: parseEntriesFromTextarea(q("sbi-bonusActions")?.value || ""),
      reactions: parseEntriesFromTextarea(q("sbi-reactions")?.value || ""),
      legendaryActions: parseEntriesFromTextarea(q("sbi-legendaryActions")?.value || ""),

      unmappedText: (q("sbi-unmapped")?.value || "").trim(),
    };
  }

  function confBadge(level) {
    const color = level === "high" ? "#7bd88f" : level === "medium" ? "#ffd166" : "#ff9aa2";
    return `<span style="font-size:10px;border:1px solid ${color};color:${color};padding:1px 6px;border-radius:999px;">${esc(level || "low")}</span>`;
  }

  function renderSection(title, entries) {
    if (!entries || !entries.length) return "";
    return `
      <section style="border-top:1px solid rgba(255,255,255,.14);padding-top:10px;margin-top:10px;">
        <h4 style="margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.06em;font-size:12px;opacity:.9;">${esc(title)}</h4>
        <div style="display:grid;gap:6px;">
          ${entries.map((e) => `
            <details style="border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:0 8px;">
              <summary style="cursor:pointer;padding:8px 0;font-weight:700;">${esc(e.name)}</summary>
              <div style="padding:0 0 8px 0;opacity:.95;">${esc(e.text)}</div>
            </details>
          `).join("")}
        </div>
      </section>
    `;
  }

  function statBlockPreview(m) {
    if (!m) return "";
    return `
      <div style="margin-top:14px;border:1px solid rgba(255,255,255,.18);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02);">
        <div style="padding:12px;border-bottom:1px solid rgba(255,255,255,.14);">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
            <h3 style="margin:0;font-size:20px;">${esc(m.name || "Unknown Monster")}</h3>
            <span style="font-size:12px;padding:3px 8px;border:1px solid rgba(255,255,255,.2);border-radius:999px;">CR ${esc(m.cr || "—")}</span>
          </div>
          <div class="muted" style="margin-top:4px;">
            ${esc(m.sizeType || "—")}${m.alignment ? `, ${esc(m.alignment)}` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            <span style="font-size:11px;padding:2px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;">XP ${esc(m.xp ?? 0)}</span>
            <span style="font-size:11px;padding:2px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;">PB ${m.proficiencyBonus >= 0 ? "+" : ""}${esc(m.proficiencyBonus ?? 2)}</span>
            ${m.habitats?.length ? `<span style="font-size:11px;padding:2px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;">Habitat: ${esc(listToLine(m.habitats))}</span>` : ""}
          </div>
        </div>

        <div style="padding:10px;border-bottom:1px solid rgba(255,255,255,.14);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">
          <div style="border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px;text-align:center;"><div class="muted" style="font-size:10px;">AC</div><div style="font-weight:800;">${esc(m.ac)}</div></div>
          <div style="border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px;text-align:center;"><div class="muted" style="font-size:10px;">HP</div><div style="font-weight:800;">${esc(m.hp)}</div></div>
          <div style="border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px;text-align:center;"><div class="muted" style="font-size:10px;">Speed</div><div style="font-weight:800;">${esc(m.speed || "—")}</div></div>
        </div>

        <div style="padding:10px;">
          <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;">
            ${["str","dex","con","int","wis","cha"].map((k) => {
              const v = clamp(toInt(m[k], 10), 1, 30);
              const mod = Math.floor((v - 10) / 2);
              const modTxt = mod >= 0 ? `+${mod}` : `${mod}`;
              return `<div style="border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px;text-align:center;">
                <div class="muted" style="font-size:10px;text-transform:uppercase;">${k}</div>
                <div style="font-weight:800;">${v} (${modTxt})</div>
              </div>`;
            }).join("")}
          </div>

          <div style="margin-top:10px;display:grid;gap:4px;">
            ${m.saves?.length ? `<div><span class="muted">Saving Throws:</span> ${esc(listToLine(m.saves))}</div>` : ""}
            ${m.skills?.length ? `<div><span class="muted">Skills:</span> ${esc(listToLine(m.skills))}</div>` : ""}
            ${m.vulnerabilities?.length ? `<div><span class="muted">Damage Vulnerabilities:</span> ${esc(listToLine(m.vulnerabilities))}</div>` : ""}
            ${m.resistances?.length ? `<div><span class="muted">Damage Resistances:</span> ${esc(listToLine(m.resistances))}</div>` : ""}
            ${m.immunities?.length ? `<div><span class="muted">Damage Immunities:</span> ${esc(listToLine(m.immunities))}</div>` : ""}
            ${m.conditionImmunities?.length ? `<div><span class="muted">Condition Immunities:</span> ${esc(listToLine(m.conditionImmunities))}</div>` : ""}
            ${m.senses?.length ? `<div><span class="muted">Senses:</span> ${esc(listToLine(m.senses))}</div>` : ""}
            ${m.languages?.length ? `<div><span class="muted">Languages:</span> ${esc(listToLine(m.languages))}</div>` : ""}
          </div>

          ${renderSection("Traits", m.traits)}
          ${renderSection("Actions", m.actions)}
          ${renderSection("Bonus Actions", m.bonusActions)}
          ${renderSection("Reactions", m.reactions)}
          ${renderSection("Legendary Actions", m.legendaryActions)}
        </div>
      </div>
    `;
  }

  function template() {
    const progressPct = Math.round((state.progress || 0) * 100);
    const p = state.parsed;
    return `
      <div class="tool-panel" style="display:grid;gap:12px;">
        <div>
          <h2 style="margin:0 0 6px 0;">Stat Block Importer</h2>
          <div class="muted">Paste screenshot (Win+Shift+S → Ctrl+V) or upload image → OCR locally → strict parse + review.</div>
        </div>

        <div id="sbi-paste-zone" tabindex="0" style="padding:14px;border:1px dashed rgba(255,255,255,.30);border-radius:10px;outline:none;">
          <strong>Paste Screenshot</strong><br>
          Click here and press <kbd>Ctrl</kbd> + <kbd>V</kbd> (or <kbd>Cmd</kbd> + <kbd>V</kbd>)
        </div>

        <label style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>Or Upload File:</span>
          <input id="sbi-file" type="file" accept="image/*" />
        </label>

        ${state.lastInputMethod ? `<div class="muted">Loaded via: <strong>${esc(state.lastInputMethod)}</strong></div>` : ""}
        ${state.status === "loading-lib" ? `<div>Loading OCR library…</div>` : ""}
        ${state.status === "ocr" ? `<div>OCR in progress: <strong>${progressPct}%</strong></div>` : ""}
        ${state.status === "error" ? `<div style="color:#ff9aa2;">${esc(state.error)}</div>` : ""}

        ${
          state.imageDataUrl
            ? `<img src="${state.imageDataUrl}" alt="Preview" style="max-width:100%;max-height:260px;border:1px solid rgba(255,255,255,.18);border-radius:10px;" />`
            : `<div style="padding:20px;border:1px dashed rgba(255,255,255,.25);border-radius:10px;">No image loaded yet.</div>`
        }

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="sbi-run" ${state.imageDataUrl ? "" : "disabled"}>Run OCR + Parse</button>
          <button id="sbi-clear">Clear</button>
        </div>

        <details ${state.ocrText ? "open" : ""}>
          <summary>OCR Text</summary>
          <textarea id="sbi-ocr-text" style="width:100%;min-height:140px;margin-top:8px;">${esc(state.ocrText || "")}</textarea>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button id="sbi-reparse">Re-parse Edited Text</button>
          </div>
        </details>

        ${
          p ? `
            <div style="border-top:1px solid rgba(255,255,255,.14);padding-top:10px;">
              <h3 style="margin:0 0 8px 0;">Parsed Fields</h3>

              <div style="display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:8px;">
                <label>Name<input id="sbi-name" style="width:100%;" value="${esc(p.name)}"></label>
                <label>Size/Type<input id="sbi-sizeType" style="width:100%;" value="${esc(p.sizeType)}"></label>
                <label>Alignment<input id="sbi-alignment" style="width:100%;" value="${esc(p.alignment)}"></label>

                <label>AC ${confBadge(p.confidence?.ac)}<input id="sbi-ac" type="number" style="width:100%;" value="${esc(p.ac)}"></label>
                <label>AC Notes<input id="sbi-acText" style="width:100%;" value="${esc(p.acText || "")}"></label>
                <label>HP ${confBadge(p.confidence?.hp)}<input id="sbi-hp" type="number" style="width:100%;" value="${esc(p.hp)}"></label>
                <label>HP Formula<input id="sbi-hpFormula" style="width:100%;" value="${esc(p.hpFormula || "")}"></label>
                <label>Speed ${confBadge(p.confidence?.speed)}<input id="sbi-speed" style="width:100%;" value="${esc(p.speed || "")}"></label>
                <label>CR ${confBadge(p.confidence?.cr)}<input id="sbi-cr" style="width:100%;" value="${esc(p.cr)}"></label>
                <label>XP<input id="sbi-xp" type="number" style="width:100%;" value="${esc(p.xp ?? 0)}"></label>
                <label>PB ${confBadge(p.confidence?.pb)}<input id="sbi-pb" type="number" style="width:100%;" value="${esc(p.proficiencyBonus ?? 2)}"></label>
              </div>

              <div style="display:grid;grid-template-columns:repeat(6,minmax(80px,1fr));gap:8px;margin-top:10px;">
                <label>STR<input id="sbi-str" type="number" style="width:100%;" value="${esc(p.str)}"></label>
                <label>DEX<input id="sbi-dex" type="number" style="width:100%;" value="${esc(p.dex)}"></label>
                <label>CON<input id="sbi-con" type="number" style="width:100%;" value="${esc(p.con)}"></label>
                <label>INT<input id="sbi-int" type="number" style="width:100%;" value="${esc(p.int)}"></label>
                <label>WIS<input id="sbi-wis" type="number" style="width:100%;" value="${esc(p.wis)}"></label>
                <label>CHA<input id="sbi-cha" type="number" style="width:100%;" value="${esc(p.cha)}"></label>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
                <label>Saving Throws<input id="sbi-saves" style="width:100%;" value="${esc(listToLine(p.saves))}"></label>
                <label>Skills<input id="sbi-skills" style="width:100%;" value="${esc(listToLine(p.skills))}"></label>
                <label>Damage Vulnerabilities<input id="sbi-vuln" style="width:100%;" value="${esc(listToLine(p.vulnerabilities))}"></label>
                <label>Damage Resistances<input id="sbi-resist" style="width:100%;" value="${esc(listToLine(p.resistances))}"></label>
                <label>Damage Immunities<input id="sbi-immune" style="width:100%;" value="${esc(listToLine(p.immunities))}"></label>
                <label>Condition Immunities<input id="sbi-condImm" style="width:100%;" value="${esc(listToLine(p.conditionImmunities))}"></label>
                <label>Senses<input id="sbi-senses" style="width:100%;" value="${esc(listToLine(p.senses))}"></label>
                <label>Languages<input id="sbi-languages" style="width:100%;" value="${esc(listToLine(p.languages))}"></label>
                <label style="grid-column:1 / -1;">Habitats / Environment<input id="sbi-habitats" style="width:100%;" value="${esc(listToLine(p.habitats))}"></label>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
                <label>Traits (Name. text)
                  <textarea id="sbi-traits" style="width:100%;min-height:110px;">${esc(entriesToText(p.traits))}</textarea>
                </label>
                <label>Actions (Name. text)
                  <textarea id="sbi-actions" style="width:100%;min-height:110px;">${esc(entriesToText(p.actions))}</textarea>
                </label>
                <label>Bonus Actions
                  <textarea id="sbi-bonusActions" style="width:100%;min-height:90px;">${esc(entriesToText(p.bonusActions))}</textarea>
                </label>
                <label>Reactions
                  <textarea id="sbi-reactions" style="width:100%;min-height:90px;">${esc(entriesToText(p.reactions))}</textarea>
                </label>
                <label style="grid-column:1 / -1;">Legendary Actions
                  <textarea id="sbi-legendaryActions" style="width:100%;min-height:90px;">${esc(entriesToText(p.legendaryActions))}</textarea>
                </label>
                <label style="grid-column:1 / -1;">Unmapped Text (review bucket)
                  <textarea id="sbi-unmapped" style="width:100%;min-height:90px;">${esc(p.unmappedText || "")}</textarea>
                </label>
              </div>

              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                <button id="sbi-refresh-preview">Refresh Preview</button>
                <button id="sbi-save">Save Draft</button>
                <button id="sbi-copy">Copy JSON</button>
              </div>
            </div>
          ` : `<div class="muted">No parsed result yet.</div>`
        }

        ${p ? statBlockPreview(p) : ""}
      </div>
    `;
  }

  function bind(labelEl, panelEl) {
    // cleanup old listeners to avoid duplicates
    if (panelEl._sbiCleanup && Array.isArray(panelEl._sbiCleanup)) {
      for (const fn of panelEl._sbiCleanup) {
        try { fn(); } catch {}
      }
    }
    panelEl._sbiCleanup = [];

    const q = (id) => panelEl.querySelector(`#${id}`);
    const fileEl = q("sbi-file");
    const pasteZone = q("sbi-paste-zone");

    const onZonePaste = async (e) => {
      try {
        const items = e.clipboardData?.items || [];
        for (const item of items) {
          if (item.type && item.type.startsWith("image/")) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              await setImageFromBlob(blob, { labelEl, panelEl, method: "clipboard paste" });
              return;
            }
          }
        }
      } catch (err) {
        state.status = "error";
        state.error = `Paste failed: ${err?.message || err}`;
        render({ labelEl, panelEl });
      }
    };

    const onGlobalPaste = async (e) => {
      if (!panelEl || !panelEl.isConnected) return;
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await setImageFromBlob(blob, { labelEl, panelEl, method: "clipboard paste" });
            return;
          }
        }
      }
    };

    pasteZone?.addEventListener("click", () => pasteZone.focus());
    pasteZone?.addEventListener("paste", onZonePaste);
    window.addEventListener("paste", onGlobalPaste);

    panelEl._sbiCleanup.push(() => {
      window.removeEventListener("paste", onGlobalPaste);
      pasteZone?.removeEventListener("paste", onZonePaste);
    });

    fileEl?.addEventListener("change", async (e) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        await setImageFromBlob(file, { labelEl, panelEl, method: "file upload" });
      } catch (err) {
        state.status = "error";
        state.error = `File load failed: ${err?.message || err}`;
        render({ labelEl, panelEl });
      }
    });

    q("sbi-clear")?.addEventListener("click", () => {
      state.imageDataUrl = "";
      state.ocrText = "";
      state.parsed = null;
      state.status = "idle";
      state.progress = 0;
      state.error = "";
      state.lastInputMethod = "";
      render({ labelEl, panelEl });
    });

    q("sbi-run")?.addEventListener("click", async () => {
      try {
        state.status = "loading-lib";
        render({ labelEl, panelEl });

        await ensureTesseractLoaded();

        state.status = "ocr";
        state.progress = 0;
        render({ labelEl, panelEl });

        const result = await window.Tesseract.recognize(state.imageDataUrl, "eng", {
          logger: (m) => {
            if (m?.status === "recognizing text" && Number.isFinite(m.progress)) {
              state.progress = m.progress;
            }
          },
        });

        const raw = normalizeSpaces(result?.data?.text || "");
        state.ocrText = raw;
        state.parsed = parseStatBlock(raw);
        state.status = "done";
      } catch (err) {
        state.status = "error";
        state.error = `OCR failed: ${err?.message || err}`;
      }
      render({ labelEl, panelEl });
    });

    q("sbi-reparse")?.addEventListener("click", () => {
      const raw = q("sbi-ocr-text")?.value || "";
      state.ocrText = raw;
      state.parsed = parseStatBlock(raw);
      state.status = "done";
      render({ labelEl, panelEl });
    });

    q("sbi-refresh-preview")?.addEventListener("click", () => {
      const reviewed = collectReviewed(panelEl);
      if (!reviewed) return;
      state.parsed = reviewed;
      render({ labelEl, panelEl });
    });

    q("sbi-save")?.addEventListener("click", () => {
      const reviewed = collectReviewed(panelEl);
      if (!reviewed) return;
      state.parsed = reviewed;
      addDraft({ ...reviewed, _savedAt: new Date().toISOString() });
      alert("Saved to Stat Block Importer drafts.");
      render({ labelEl, panelEl });
    });

    q("sbi-copy")?.addEventListener("click", async () => {
      const reviewed = collectReviewed(panelEl);
      if (!reviewed) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify(reviewed, null, 2));
        alert("Copied JSON.");
      } catch {
        alert("Clipboard copy failed.");
      }
    });
  }

  function render({ labelEl, panelEl }) {
    if (!panelEl) return;
    if (labelEl) labelEl.textContent = TOOL_NAME;
    panelEl.innerHTML = template();
    bind(labelEl, panelEl);
  }

  window.registerTool({
    id: TOOL_ID,
    name: TOOL_NAME,
    description: "Paste/upload screenshot, OCR locally, strict parse, review, and stat block preview.",
    render,
  });
})();
