// Jegyek: adatbázis-műveletek (előadás betöltése, eladás mentése, vevők a kontakt-mesterlistába).
import { occupancy } from "../lib/tickets.js";
import { processUpload } from "./contacts.js";

/** Előadás + jegytípusok + eladások + foglaltság. Nincs ilyen → null. */
export async function loadPerformance(db, id) {
  const p = await db.prepare("SELECT * FROM performance WHERE id = ?").bind(id).first();
  if (!p) return null;
  const { results: types } = await db.prepare(
    `SELECT t.*, COALESCE(SUM(s.quantity), 0) AS sold, COALESCE(SUM(s.amount), 0) AS revenue, COUNT(s.id) AS sale_rows
     FROM ticket_type t LEFT JOIN ticket_sale s ON s.ticket_type_id = t.id WHERE t.performance_id = ?
     GROUP BY t.id ORDER BY t.is_gift, t.price DESC, t.id`,
  ).bind(id).all();
  const { results: sales } = await db.prepare(
    `SELECT s.*, t.name AS type_name, t.is_gift, t.check_at_entry, t.eligibility, r.contact_id, r.status AS contact_status
     FROM ticket_sale s JOIN ticket_type t ON t.id = s.ticket_type_id LEFT JOIN source_record r ON r.id = s.source_record_id
     WHERE t.performance_id = ? ORDER BY s.sold_on DESC, s.id DESC`,
  ).bind(id).all();
  return { p, types, sales, occ: occupancy(p.capacity, types, sales) };
}

/** Eladás-sorok mentése. Visszaadja az új sorok azonosítóit (a bemenet sorrendjében). */
export async function insertSales(db, sales, user) {
  const ids = [];
  for (const s of sales) {
    const res = await db.prepare(
      `INSERT INTO ticket_sale (ticket_type_id, quantity, unit_price, amount, sold_on, channel, buyer_name, buyer_email,
         buyer_phone, newsletter_consent, external_ref, note, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(s.ticket_type_id, s.quantity, s.unit_price, s.amount, s.sold_on, s.channel, s.buyer_name || null,
      s.buyer_email || null, s.buyer_phone || null, s.newsletter_consent ? 1 : 0, s.external_ref || null, s.note || null, user).run();
    ids.push(res.meta.last_row_id);
  }
  return ids;
}

/**
 * Vevők felvétele a kontakt-mesterlistába a MEGLÉVŐ összefésülő folyamaton át: a vevőkből egy „feltöltés” lesz,
 * így ugyanúgy működik az automatikus összevonás, a bizonytalan párok ellenőrzése és a nyers sor megőrzése.
 * Hírlevél-hozzájárulás csak akkor kerül át, ha a vevő külön igent mondott (alapból nem).
 * @param sales [{id, buyer_name, buyer_email, buyer_phone, newsletter_consent, sold_on}]
 * @returns a processUpload statisztikája, vagy null, ha nem volt név/e-mail/telefon egyik sorban sem
 */
export async function addBuyersToContacts(db, perf, sales, user) {
  const buyers = sales.filter((s) => s.buyer_name || s.buyer_email || s.buyer_phone);
  if (!buyers.length) return null;
  const headers = ["Név", "E-mail", "Telefon", "Címke", "Hírlevél-hozzájárulás dátuma"];
  const filename = `jegyvasarlok – ${perf.title} (${String(perf.starts_at).slice(0, 10)})`;
  const up = await db.prepare("INSERT INTO upload (filename, headers, created_by) VALUES (?, ?, ?)")
    .bind(filename, JSON.stringify(headers), user).run();
  const uploadId = up.meta.last_row_id;
  for (const [i, s] of buyers.entries()) {
    const raw = [s.buyer_name ?? "", s.buyer_email ?? "", s.buyer_phone ?? "", "néző", s.newsletter_consent ? s.sold_on : ""];
    const rec = await db.prepare("INSERT INTO source_record (upload_id, row_no, raw) VALUES (?, ?, ?)")
      .bind(uploadId, i + 2, JSON.stringify(raw)).run();
    await db.prepare("UPDATE ticket_sale SET source_record_id = ? WHERE id = ?").bind(rec.meta.last_row_id, s.id).run();
  }
  const stats = await processUpload(db, uploadId, ["name", "email", "phone", "tags", "consent_date"], user);
  return { ...stats, uploadId };
}
