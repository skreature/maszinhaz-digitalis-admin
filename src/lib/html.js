// Minimális HTML-sablonozás: a html`` címkézett sablon minden beillesztett értéket escape-el.

class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

/** Megbízható, már kész HTML beillesztése escape nélkül. */
export const raw = (s) => new Safe(String(s));

export function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function render(v) {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Safe(out);
}

const huf = new Intl.NumberFormat("hu-HU");
/** 12000 → „12 000 Ft” */
export const money = (n) => `${huf.format(Math.round(Number(n) || 0))} Ft`;

/** <option> lista; a `selected` értékkel egyezőt kijelöli. */
export function options(list, selected) {
  return list.map(([value, label]) =>
    html`<option value="${value}"${String(value) === String(selected ?? "") ? raw(" selected") : ""}>${label}</option>`);
}
