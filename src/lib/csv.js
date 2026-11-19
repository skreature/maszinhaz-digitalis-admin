// Egyszerű CSV olvasó és író (RFC 4180 + magyar Excel „;” elválasztó).

/** Elválasztó felismerése az első sorból: „;”, „,” vagy tabulátor. */
export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** CSV szöveg → sorok (cellatömbök). Kezeli az idézőjeleket, sortörést idézőjelen belül, BOM-ot.
 *  Teljesen üres sorokat elhagy. */
export function parseCsv(text, delimiter) {
  text = String(text).replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Cellák → CSV szöveg (Excel-barát: „;” elválasztó, BOM-mal az elején). */
export function toCsv(rows, delimiter = ";") {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(delimiter)).join("\r\n") + "\r\n";
}

/** Bájtok → szöveg. UTF-8, ha érvényes; különben Windows-1250 (régi magyar Excel-export). */
export function decodeText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}
