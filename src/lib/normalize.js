// Egységesítés: név, e-mail, telefon, szervezet. Tiszta függvények, tesztelhetők.

/** Ékezetek eltávolítása (á→a, ő→o, ű→u ...). */
export function stripAccents(s) {
  return String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Megjelenítendő név: felesleges szóközök nélkül, CSUPA NAGY vagy csupa kis betű esetén nagy kezdőbetűkkel. */
export function cleanName(name) {
  let s = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  }
  return s;
}

/** Névkulcs az összevetéshez: ékezet nélkül, kisbetűvel, írásjelek nélkül, a névrészek ábécérendben
 *  (így „Kovács Anna” és „Anna Kovács” ugyanazt adja). Titulusokat (dr., ifj., id.) elhagy. */
export function nameKey(name) {
  const parts = stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((p) => p && !["dr", "ifj", "id", "ozv", "prof"].includes(p));
  return parts.sort().join(" ");
}

/** E-mail: kisbetű, szóközök és „mailto:” nélkül; ha nem érvényes alakú, üres. */
export function normalizeEmail(email) {
  const s = String(email ?? "").trim().toLowerCase().replace(/^mailto:/, "").replace(/\s+/g, "");
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(s) ? s : "";
}

/** Telefon: egységes +36... alak. 06-tal vagy 36-tal kezdődő, illetve körzetszám nélküli
 *  9 jegyű (pl. 30 123 4567) magyar számokat alakít át; külföldi +-os számot meghagy. */
export function normalizePhone(phone) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    return d.length >= 8 ? "+" + d : "";
  }
  if (d.startsWith("0036")) d = d.slice(2);
  if (d.startsWith("06")) d = "36" + d.slice(2);
  else if (!d.startsWith("36") && (d.length === 9 || d.length === 8)) d = "36" + d;
  return d.length >= 10 ? "+" + d : "";
}

/** Telefonszám olvasható alakban: +36 30 123 4567 / +36 1 234 5678. */
export function formatPhone(phone) {
  const p = String(phone ?? "");
  const m = p.match(/^\+36(1)(\d{3})(\d{4})$/) || p.match(/^\+36(\d{2})(\d{3})(\d{3,4})$/);
  return m ? `+36 ${m[1]} ${m[2]} ${m[3]}` : p;
}

/** Szervezetkulcs: ékezet nélkül, kisbetűvel, a jogi forma (kft., bt., zrt.) nélkül. */
export function orgKey(org) {
  return stripAccents(org)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !["kft", "bt", "zrt", "nyrt", "kht", "nonprofit"].includes(p))
    .join(" ");
}

/** Címkék egységesítése: kisbetű, ismétlés nélkül, rendezve. */
export function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags ?? "").split(/[,;|]/);
  return [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].sort();
}

/** Egy feltöltött sor mezőinek egységesítése. A `fields` a párosítás után kapott nyers értékek. */
export function normalizeRecord(fields) {
  const name = cleanName(
    fields.name || [fields.last_name, fields.first_name].filter(Boolean).join(" "),
  );
  return {
    name,
    email: normalizeEmail(fields.email),
    phone: normalizePhone(fields.phone),
    org: String(fields.org ?? "").replace(/\s+/g, " ").trim(),
    tags: normalizeTags(fields.tags),
    consent_date: normalizeDate(fields.consent_date),
    note: String(fields.note ?? "").trim(),
  };
}

/** Dátum ÉÉÉÉ-HH-NN alakra (2023.05.04., 2023-5-4, 2023/05/04). Ha nem értelmezhető, üres. */
export function normalizeDate(s) {
  const m = String(s ?? "").trim().match(/^(\d{4})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}
