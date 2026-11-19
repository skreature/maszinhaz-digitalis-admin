// Jegyek: állapot, foglaltság, eladás-sor és CSV-import szabályai. Tiszta függvények, tesztelhetők.
// Az admin nem árul jegyet: a máshol (saját webshop, partner, helyszín) megtörtént eladásokat gyűjti egy helyre.
import { stripAccents, normalizeEmail, normalizePhone, cleanName, normalizeDate } from "./normalize.js";

/** Előadás-állapotok (a címbe írt „TELTHÁZ”, „utolsó előadás” helyett külön mező). */
export const STATUSES = ["elérhető", "teltház", "utolsó előadás", "lezárt"];

/** Eladási csatornák: minden eladás-sornál rögzítjük, honnan jött. */
export const CHANNELS = ["saját webshop", "partner", "helyszíni", "meghívó"];

const plain = (s) => stripAccents(s).toLowerCase().replace(/\s+/g, " ").trim();

/** Csatorna felismerése szabad szövegből (CSV, régi megjegyzés). Ismeretlen → null. */
export function normalizeChannel(s) {
  const p = plain(s);
  if (!p) return null;
  if (/webshop|online|honlap|simplepay|sajat/.test(p)) return "saját webshop";
  if (/partner|tixa|jegy\.?hu|interticket|jegymester|kulso/.test(p)) return "partner";
  if (/helyszin|penztar|kassza|keszpenz/.test(p)) return "helyszíni";
  if (/meghivo|szabadjegy|tiszteletjegy|sajtojegy|ingyen/.test(p)) return "meghívó";
  return null;
}

/** Igen/nem mező (hírlevél-hozzájárulás). Csak egyértelmű igen számít igennek – alapból nem. */
export function parseYes(s) {
  return /^(igen|i|y|yes|1|x|true|ok|✓|✔)$/.test(plain(s));
}

/** Forint egész szám szövegből („6 500 Ft”, „6500,00”). Üres vagy hibás → null. */
export function parseHuf(s) {
  const t = String(s ?? "").replace(/\s|ft|huf| /gi, "").replace(/,00$|\.00$/, "");
  if (t === "") return null;
  if (!/^-?\d+$/.test(t.replace(/[.,]/g, ""))) return null;
  const n = Number(t.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Foglaltság: a megszámolt eladott darab (az ajándékjegy/utalvány nem foglal helyet az adott előadáson).
 * @param types [{id, is_gift}]
 * @param sales [{ticket_type_id, quantity}]
 */
export function occupancy(capacity, types, sales) {
  const gift = new Set(types.filter((t) => t.is_gift).map((t) => t.id));
  const seats = sales.filter((s) => !gift.has(s.ticket_type_id)).reduce((n, s) => n + s.quantity, 0);
  const cap = capacity > 0 ? capacity : null;
  return {
    seats,
    capacity: cap,
    free: cap === null ? null : cap - seats,
    percent: cap === null ? null : Math.round((seats / cap) * 100),
    full: cap !== null && seats >= cap,
  };
}

/**
 * Megjelenítendő állapot. A rögzített állapotot nem írjuk felül, de:
 * – a lezajlott előadás mindig „lezárt” (a múltbeli eladási oldal ne maradjon nyitva),
 * – ha a foglaltság elérte a kapacitást, „teltház”.
 */
export function effectiveStatus(perf, occ, today) {
  if (String(perf.starts_at).slice(0, 10) < today || perf.status === "lezárt") return "lezárt";
  if (occ?.full) return "teltház";
  return STATUSES.includes(perf.status) ? perf.status : "elérhető";
}

/**
 * Egy eladás-sor összege. Az egységárat MINDIG elmentjük a sorba, mert a jegytípus ára később változhat.
 * @param type {price}
 * @param quantity darab (>0)
 * @param unitPrice egyedi egységár (pl. egyedi kedvezmény); null → a jegytípus mostani ára
 */
export function saleLine(type, quantity, unitPrice = null) {
  const qty = Math.round(Number(quantity));
  if (!(qty > 0)) throw new Error("A darabszám legyen pozitív egész.");
  const unit = unitPrice === null || unitPrice === undefined || unitPrice === "" ? type.price : Math.round(Number(unitPrice));
  if (!(unit >= 0)) throw new Error("Az egységár nem lehet negatív.");
  return { quantity: qty, unit_price: unit, amount: qty * unit };
}

/** Elfér-e még `quantity` darab (ajándékjegy mindig elfér). */
export function fitsCapacity(occ, quantity, isGift = false) {
  if (isGift || occ.capacity === null) return true;
  return occ.seats + quantity <= occ.capacity;
}

/** Jegytípus-sablonokból az előadás saját listája: ami már megvan (azonos sablon vagy név), azt nem duplázza. */
export function typesFromTemplates(templates, existing) {
  const haveTpl = new Set(existing.map((t) => t.template_id).filter(Boolean));
  const haveName = new Set(existing.map((t) => plain(t.name)));
  return templates
    .filter((t) => t.active && !haveTpl.has(t.id) && !haveName.has(plain(t.name)))
    .map((t) => ({
      template_id: t.id, name: t.name, price: t.base_price, eligibility: t.eligibility ?? null,
      check_at_entry: t.check_at_entry ? 1 : 0, is_gift: t.is_gift ? 1 : 0,
    }));
}

// CSV-import (webshop-export vagy kézzel vezetett táblázat) oszlopai.
const COLUMNS = [
  ["sold_on", /datum|date|vasarlas ideje|idopont/],
  ["type", /jegytipus|tipus|ticket|jegy$/],
  ["quantity", /darab|mennyiseg|db|quantity|qty/],
  ["unit_price", /egysegar|^ar$|ar \(ft\)|price|jegyar/],
  ["channel", /csatorna|forras|channel|source/],
  ["name", /^nev$|vevo|vasarlo|nev\b|name/],
  ["email", /e-?mail/],
  ["phone", /telefon|mobil|phone/],
  ["newsletter", /hirlevel|newsletter|feliratkoz/],
  ["external_ref", /rendeles|azonosito|sorszam|order|ref/],
  ["note", /megjegyzes|note/],
];

/** Fejléc → mező (az első illeszkedő szabály; minden mezőt legfeljebb egy oszlophoz rendelünk). */
export function mapSalesHeaders(headers) {
  const used = new Set();
  return headers.map((h) => {
    const p = plain(h);
    for (const [field, re] of COLUMNS) {
      if (!used.has(field) && re.test(p)) { used.add(field); return field; }
    }
    return "";
  });
}

/**
 * Eladások CSV-sorainak értelmezése egy előadáshoz.
 * @param rows parseCsv() eredménye (első sor: fejléc)
 * @param types az előadás jegytípusai [{id, name, price, is_gift}]
 * @param defaults {channel, sold_on}
 * @returns {{sales: object[], errors: {row:number, message:string}[], mapping: string[]}}
 */
export function parseSalesRows(rows, types, defaults) {
  const [headers = [], ...data] = rows;
  const mapping = mapSalesHeaders(headers);
  const errors = [];
  const sales = [];
  if (!mapping.includes("type")) {
    return { sales, mapping, errors: [{ row: 1, message: "Nincs „Jegytípus” oszlop a fejlécben." }] };
  }
  const byName = new Map(types.map((t) => [plain(t.name), t]));
  data.forEach((cells, i) => {
    const row = i + 2;
    const f = {};
    mapping.forEach((field, c) => { if (field) f[field] = String(cells[c] ?? "").trim(); });
    const type = byName.get(plain(f.type));
    if (!type) return errors.push({ row, message: `Ismeretlen jegytípus: „${f.type || "üres"}”. Előbb vedd fel az előadáshoz.` });
    const qty = f.quantity === undefined || f.quantity === "" ? 1 : Number(f.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return errors.push({ row, message: `Hibás darabszám: „${f.quantity}”.` });
    let unit = null;
    if (f.unit_price !== undefined && f.unit_price !== "") {
      unit = parseHuf(f.unit_price);
      if (unit === null) return errors.push({ row, message: `Hibás ár: „${f.unit_price}”.` });
    }
    let channel = defaults.channel;
    if (f.channel) {
      channel = normalizeChannel(f.channel);
      if (!channel) return errors.push({ row, message: `Ismeretlen csatorna: „${f.channel}”.` });
    }
    const line = saleLine(type, qty, unit);
    sales.push({
      row,
      ticket_type_id: type.id,
      type_name: type.name,
      is_gift: Boolean(type.is_gift),
      ...line,
      channel,
      sold_on: normalizeDate(f.sold_on) || defaults.sold_on,
      buyer_name: cleanName(f.name ?? ""),
      buyer_email: normalizeEmail(f.email),
      buyer_phone: normalizePhone(f.phone),
      newsletter_consent: parseYes(f.newsletter) ? 1 : 0,
      external_ref: f.external_ref || null,
      note: f.note || null,
    });
  });
  return { sales, errors, mapping };
}

/**
 * Belépési lista: név szerint rendezve, a névtelen (pl. pénztári) sorok a végén.
 * Ajándékjegy nem kerül a listára (nem erre az előadásra szóló belépő).
 */
export function entryList(sales) {
  return sales
    .filter((s) => !s.is_gift)
    .map((s) => ({ ...s, sortKey: s.buyer_name ? plain(s.buyer_name) : "￿" }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "hu") || a.id - b.id);
}
