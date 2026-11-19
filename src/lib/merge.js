// Két adat összevonása: a meglévő kontakt üres mezőit kitölti, a címkéket egyesíti. Tiszta függvény.
import { nameKey, normalizeTags, stripAccents } from "./normalize.js";

// Ugyanannak a névnek az ékezetes alakját részesítjük előnyben („Nagy Eva” → „Nagy Éva”).
function betterName(current, incoming) {
  if (!current) return incoming;
  if (!incoming || nameKey(current) !== nameKey(incoming)) return current;
  const accents = (s) => [...s].filter((ch) => stripAccents(ch) !== ch).length;
  return accents(incoming) > accents(current) ? incoming : current;
}

/**
 * @param contact meglévő kontakt (adatbázis-sor)
 * @param rec egységesített forrásrekord {name, email, phone, org, tags[], consent_date}
 * @param source a forrás neve (fájlnév) – hozzájárulásnál ezt rögzítjük
 * @returns a kontakt frissítendő mezői
 */
export function mergeFields(contact, rec, source) {
  const out = {
    name: betterName(contact.name, rec.name),
    email: contact.email || rec.email || null,
    phone: contact.phone || rec.phone || null,
    org: contact.org || rec.org || null,
    tags: normalizeTags([...normalizeTags(contact.tags), ...(rec.tags ?? [])]).join(","),
    consent_newsletter: contact.consent_newsletter ? 1 : 0,
    consent_date: contact.consent_date ?? null,
    consent_source: contact.consent_source ?? null,
  };
  if (!out.consent_newsletter && rec.consent_date) {
    out.consent_newsletter = 1;
    out.consent_date = rec.consent_date;
    out.consent_source = source;
  }
  return out;
}
