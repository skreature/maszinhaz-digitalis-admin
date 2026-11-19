// Kontakt-mesterlista: adatbázis-műveletek a feltöltéshez, összevonáshoz és jóváhagyáshoz.
import { suggestTags } from "../lib/classify.js";
import { mergeFields } from "../lib/merge.js";
import { nameKey, normalizeRecord, normalizeTags } from "../lib/normalize.js";
import { addToIndex, createIndex, findMatch, fingerprint } from "../lib/match.js";

/** A párosítható mezők (oszlop-párosítás képernyő). */
export const FIELDS = [
  ["", "– kihagy –"],
  ["name", "Teljes név"],
  ["last_name", "Vezetéknév"],
  ["first_name", "Keresztnév"],
  ["email", "E-mail"],
  ["phone", "Telefon"],
  ["org", "Szervezet / szerkesztőség"],
  ["tags", "Címke / kategória"],
  ["consent_date", "Hírlevél-hozzájárulás dátuma"],
  ["note", "Megjegyzés"],
];

/** Fejléc alapján tippel a mezőre (ha még nincs megjegyzett párosítás). */
export function guessField(header) {
  const h = header.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (/e-?mail|email|levelcim/.test(h)) return "email";
  if (/telefon|tel\b|tel\.|mobil|phone/.test(h)) return "phone";
  if (/vezeteknev|csaladnev|last.?name|surname/.test(h)) return "last_name";
  if (/keresztnev|utonev|first.?name/.test(h)) return "first_name";
  if (/^nev$|teljes nev|^name$|kapcsolattarto|^nev /.test(h)) return "name";
  if (/szervezet|intezmeny|ceg|szerkesztoseg|organi|company|lap$|media/.test(h)) return "org";
  if (/cimke|kategoria|tipus/.test(h)) return "tags";
  if (/feliratkoz|hozzajarul|subscribed|consent/.test(h)) return "consent_date";
  if (/megjegyzes|note|comment/.test(h)) return "note";
  return "";
}

export const headerSignature = (headers) =>
  headers.map((h) => h.trim().toLowerCase()).join("|");

/** Az összes kontakt + azonosító betöltése az összevetéshez. */
export async function loadIndex(db) {
  const index = createIndex();
  const { results: contacts } = await db.prepare("SELECT id, name, name_key, email, phone, org FROM contact").all();
  const { results: ids } = await db.prepare("SELECT contact_id, kind, value FROM contact_identifier").all();
  const byContact = new Map();
  for (const i of ids) {
    if (!byContact.has(i.contact_id)) byContact.set(i.contact_id, []);
    byContact.get(i.contact_id).push(i);
  }
  for (const c of contacts) addToIndex(index, c, byContact.get(c.id) ?? []);
  return index;
}

export async function loadDecisions(db) {
  const { results } = await db.prepare("SELECT fingerprint, contact_id, decision FROM match_decision").all();
  return new Map(results.map((r) => [`${r.fingerprint}|${r.contact_id}`, r.decision]));
}

async function memberContactIds(db) {
  const { results } = await db.prepare("SELECT contact_id FROM member").all();
  return new Set(results.map((r) => r.contact_id));
}

function identifierStmts(db, contactId, rec) {
  const out = [];
  if (rec.email) out.push(db.prepare("INSERT OR IGNORE INTO contact_identifier (contact_id, kind, value) VALUES (?, 'email', ?)").bind(contactId, rec.email));
  if (rec.phone) out.push(db.prepare("INSERT OR IGNORE INTO contact_identifier (contact_id, kind, value) VALUES (?, 'phone', ?)").bind(contactId, rec.phone));
  return out;
}

/** Új kontakt létrehozása egy egységesített rekordból. Visszaadja az új id-t. */
export async function createContact(db, rec, user, source = null) {
  const res = await db.prepare(
    `INSERT INTO contact (name, name_key, email, phone, org, tags, consent_newsletter, consent_date, consent_source, note, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    rec.name || rec.email || rec.phone, nameKey(rec.name), rec.email || null, rec.phone || null, rec.org || null,
    normalizeTags(rec.tags).join(","), rec.consent_date ? 1 : 0, rec.consent_date || null,
    rec.consent_date ? source : null, rec.note || null, user,
  ).run();
  const id = res.meta.last_row_id;
  const stmts = identifierStmts(db, id, rec);
  if (stmts.length) await db.batch(stmts);
  return id;
}

/** Rekord összevonása egy meglévő kontaktba (semmi nem vész el: minden e-mail/telefon azonosítóként marad). */
export async function mergeIntoContact(db, contactId, rec, user, source = null) {
  const contact = await db.prepare("SELECT * FROM contact WHERE id = ?").bind(contactId).first();
  if (!contact) throw new Error("A kontakt nem található: " + contactId);
  const m = mergeFields(contact, rec, source);
  await db.batch([
    db.prepare(
      `UPDATE contact SET name = ?, name_key = ?, email = ?, phone = ?, org = ?, tags = ?, consent_newsletter = ?,
       consent_date = ?, consent_source = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`,
    ).bind(m.name, nameKey(m.name), m.email, m.phone, m.org, m.tags, m.consent_newsletter, m.consent_date,
      m.consent_source, user, contactId),
    ...identifierStmts(db, contactId, rec),
  ]);
}

function recordFromRow(row) {
  return {
    name: row.name ?? "", email: row.email ?? "", phone: row.phone ?? "", org: row.org ?? "",
    tags: normalizeTags(row.suggested_tags), consent_date: row.consent_date ?? "",
  };
}

/**
 * Feltöltés feldolgozása a megadott oszlop-párosítással:
 * egységesítés → címkejavaslat → összefésülés (biztos: összevon; bizonytalan: ellenőrzési sor; új: új kontakt).
 */
export async function processUpload(db, uploadId, mapping, user) {
  const upload = await db.prepare("SELECT * FROM upload WHERE id = ?").bind(uploadId).first();
  const { results: rows } = await db.prepare(
    "SELECT id, raw FROM source_record WHERE upload_id = ? AND status = 'feldolgozatlan' ORDER BY row_no",
  ).bind(uploadId).all();
  const index = await loadIndex(db);
  const decisions = await loadDecisions(db);
  const members = await memberContactIds(db);
  const stats = { új: 0, összevonva: 0, "ellenőrzésre vár": 0, kihagyva: 0, üres: 0 };

  for (const row of rows) {
    const cells = JSON.parse(row.raw);
    const fields = {};
    mapping.forEach((field, i) => {
      if (!field) return;
      const v = (cells[i] ?? "").trim();
      fields[field] = fields[field] ? `${fields[field]}, ${v}` : v;
    });
    const rec = normalizeRecord(fields);
    const match = findMatch(rec, index, decisions);
    rec.tags = normalizeTags([
      ...rec.tags,
      ...suggestTags({ filename: upload.filename, org: rec.org, email: rec.email,
        isMember: match.kind === "biztos" && members.has(match.contactId) }),
    ]);

    let status;
    let contactId = null;
    if (match.kind === "üres") status = "üres";
    else if (match.kind === "kihagy") status = "kihagyva";
    else if (match.kind === "biztos") {
      contactId = match.contactId;
      await mergeIntoContact(db, contactId, rec, user, upload.filename);
      addToIndex(index, { id: contactId, name: rec.name, email: rec.email, phone: rec.phone, org: rec.org });
      status = "összevonva";
    } else if (match.kind === "bizonytalan") {
      status = "ellenőrzésre vár";
    } else {
      contactId = await createContact(db, rec, user, upload.filename);
      addToIndex(index, { id: contactId, name: rec.name, email: rec.email, phone: rec.phone, org: rec.org });
      status = "új";
    }
    stats[status]++;

    await db.prepare(
      `UPDATE source_record SET name = ?, email = ?, phone = ?, org = ?, suggested_tags = ?, consent_date = ?,
       contact_id = ?, status = ? WHERE id = ?`,
    ).bind(rec.name, rec.email || null, rec.phone || null, rec.org || null, rec.tags.join(","),
      rec.consent_date || null, contactId, status, row.id).run();
    if (status === "ellenőrzésre vár") {
      await db.prepare("INSERT INTO review_item (source_record_id, contact_id, reason) VALUES (?, ?, ?)")
        .bind(row.id, match.contactId, match.reason).run();
    }
  }
  await db.prepare("UPDATE upload SET mapping = ?, status = 'feldolgozva' WHERE id = ?")
    .bind(JSON.stringify(mapping), uploadId).run();
  return stats;
}

/**
 * Emberi döntés egy bizonytalan párról. A döntést megjegyezzük (match_decision),
 * így ugyanazt a párt egy későbbi feltöltésnél nem kérdezzük újra.
 */
export async function decideReview(db, reviewId, decision, user) {
  const item = await db.prepare(
    `SELECT r.*, s.name, s.email, s.phone, s.org, s.suggested_tags, s.consent_date, u.filename
     FROM review_item r JOIN source_record s ON s.id = r.source_record_id JOIN upload u ON u.id = s.upload_id
     WHERE r.id = ? AND r.status = 'nyitott'`,
  ).bind(reviewId).first();
  if (!item) return false;
  const rec = recordFromRow(item);
  await db.prepare(
    `INSERT INTO match_decision (fingerprint, contact_id, decision, decided_by) VALUES (?, ?, ?, ?)
     ON CONFLICT (fingerprint, contact_id) DO UPDATE SET decision = excluded.decision, decided_by = excluded.decided_by,
     decided_at = datetime('now')`,
  ).bind(fingerprint(rec), item.contact_id, decision, user).run();

  let contactId = null;
  let status;
  if (decision === "ugyanaz") {
    contactId = item.contact_id;
    await mergeIntoContact(db, contactId, rec, user, item.filename);
    status = "összevonva";
  } else if (decision === "külön") {
    // Lehet, hogy egy másik meglévő kontakttal is hasonló – akkor az is kérdés lesz.
    const index = await loadIndex(db);
    const match = findMatch(rec, index, await loadDecisions(db));
    if (match.kind === "bizonytalan") {
      await db.prepare("INSERT INTO review_item (source_record_id, contact_id, reason) VALUES (?, ?, ?)")
        .bind(item.source_record_id, match.contactId, match.reason).run();
      status = "ellenőrzésre vár";
    } else if (match.kind === "biztos") {
      contactId = match.contactId;
      await mergeIntoContact(db, contactId, rec, user, item.filename);
      status = "összevonva";
    } else {
      contactId = await createContact(db, rec, user, item.filename);
      status = "új";
    }
  } else {
    status = "kihagyva";
  }
  await db.batch([
    db.prepare("UPDATE review_item SET status = 'lezárva' WHERE id = ?").bind(reviewId),
    db.prepare("UPDATE source_record SET contact_id = ?, status = ? WHERE id = ?").bind(contactId, status, item.source_record_id),
  ]);
  return true;
}
