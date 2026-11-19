// Összefésülés (duplikátumszűrés): biztos / bizonytalan / új. Tiszta függvények.
import { nameKey, orgKey } from "./normalize.js";

/** Két szöveg szerkesztési távolsága (Levenshtein). */
export function editDistance(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Hasonló-e a két névkulcs: egyezik, vagy apró elírás (rövid névnél 1, hosszúnál 2 betű). */
export function similarNames(keyA, keyB) {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const len = Math.min(keyA.length, keyB.length);
  const limit = len >= 12 ? 2 : len >= 5 ? 1 : 0;
  return editDistance(keyA, keyB) <= limit;
}

/** Egy forrásrekord ujjlenyomata: ez alapján emlékszünk az emberi döntésekre. */
export function fingerprint(rec) {
  return [nameKey(rec.name), rec.email || "", rec.phone || ""].join("|");
}

/** Üres index a meglévő kontaktokhoz. */
export function createIndex() {
  return { byEmail: new Map(), byPhone: new Map(), contacts: new Map() };
}

/** Kontakt (és összes ismert e-mail/telefon) felvétele az indexbe. */
export function addToIndex(index, contact, identifiers = []) {
  index.contacts.set(contact.id, {
    id: contact.id,
    nameKey: contact.name_key ?? nameKey(contact.name),
    orgKey: orgKey(contact.org),
  });
  const ids = [...identifiers];
  if (contact.email) ids.push({ kind: "email", value: contact.email });
  if (contact.phone) ids.push({ kind: "phone", value: contact.phone });
  for (const { kind, value } of ids) {
    const map = kind === "email" ? index.byEmail : index.byPhone;
    if (value && !map.has(value)) map.set(value, contact.id);
  }
}

/**
 * Egy egységesített rekord besorolása a meglévő kontaktokhoz képest.
 * @param rec {name, email, phone, org}
 * @param index createIndex()/addToIndex() eredménye
 * @param decisions Map: `${fingerprint}|${contactId}` -> 'ugyanaz' | 'külön' | 'kihagy'
 * @returns {{kind: 'biztos'|'bizonytalan'|'új'|'kihagy'|'üres', contactId?: number, reason: string}}
 */
export function findMatch(rec, index, decisions = new Map()) {
  if (!rec.name && !rec.email && !rec.phone) return { kind: "üres", reason: "nincs név, e-mail és telefon" };

  if (rec.email && index.byEmail.has(rec.email)) {
    return { kind: "biztos", contactId: index.byEmail.get(rec.email), reason: "azonos e-mail" };
  }
  if (rec.phone && index.byPhone.has(rec.phone)) {
    return { kind: "biztos", contactId: index.byPhone.get(rec.phone), reason: "azonos telefonszám" };
  }

  const fp = fingerprint(rec);
  const key = nameKey(rec.name);
  const org = orgKey(rec.org);
  const candidates = [];
  for (const c of index.contacts.values()) {
    if (!key || !c.nameKey) continue;
    let reason = null;
    if (c.nameKey === key) reason = org && org === c.orgKey ? "azonos név és szervezet" : "azonos név";
    else if (org && org === c.orgKey && similarNames(key, c.nameKey)) reason = "hasonló név, azonos szervezet";
    if (!reason) continue;
    const decision = decisions.get(`${fp}|${c.id}`);
    if (decision === "ugyanaz") return { kind: "biztos", contactId: c.id, reason: "korábbi döntés: ugyanaz" };
    if (decision === "kihagy") return { kind: "kihagy", contactId: c.id, reason: "korábbi döntés: kihagyva" };
    if (decision === "külön") continue;
    candidates.push({ id: c.id, reason, exact: c.nameKey === key });
  }
  if (candidates.length) {
    candidates.sort((a, b) => Number(b.exact) - Number(a.exact) || a.id - b.id);
    return { kind: "bizonytalan", contactId: candidates[0].id, reason: candidates[0].reason };
  }
  return { kind: "új", reason: "nincs hasonló kontakt" };
}
