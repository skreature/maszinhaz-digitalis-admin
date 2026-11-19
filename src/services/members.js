// Tagok, esedékességek, befizetések – adatbázis-műveletek.
import { allocatePayments, balanceOn, missingCharges } from "../lib/dues.js";

/** Hiányzó havi esedékességek létrehozása a megadott hónapig (idempotens). Visszaadja a létrehozottak számát. */
export async function ensureCharges(db, upTo) {
  const { results: members } = await db.prepare("SELECT id, joined_on, status, fee_plan_id FROM member").all();
  const { results: plans } = await db.prepare("SELECT id, amount, due_day, frequency, active FROM fee_plan").all();
  const { results: existing } = await db.prepare("SELECT member_id, period FROM charge").all();
  const missing = missingCharges(
    members,
    new Map(plans.map((p) => [p.id, p])),
    new Set(existing.map((e) => `${e.member_id}|${e.period}`)),
    upTo,
  );
  const stmts = missing.map((c) =>
    db.prepare("INSERT OR IGNORE INTO charge (member_id, period, amount, due_date) VALUES (?, ?, ?, ?)")
      .bind(c.member_id, c.period, c.amount, c.due_date));
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  const touched = new Set(missing.map((c) => c.member_id));
  for (const id of touched) await recomputeStatuses(db, id);
  return missing.length;
}

/** Az esedékességek állapotának frissítése a befizetések alapján (legrégebbi tétel először). */
export async function recomputeStatuses(db, memberId) {
  const { results: charges } = await db.prepare("SELECT id, period, amount, status FROM charge WHERE member_id = ?").bind(memberId).all();
  const paid = await db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payment WHERE member_id = ?").bind(memberId).first("s");
  const { statuses } = allocatePayments(charges, paid);
  const stmts = charges
    .filter((c) => statuses.get(c.id) !== c.status)
    .map((c) => db.prepare("UPDATE charge SET status = ? WHERE id = ?").bind(statuses.get(c.id), c.id));
  if (stmts.length) await db.batch(stmts);
}

/** Ki tartozik az adott napon? [{member_id, name, member_code, owed, oldest}] csökkenő tartozás szerint. */
export async function debtors(db, today) {
  const { results: members } = await db.prepare(
    `SELECT m.id, m.member_code, m.group_name, c.name FROM member m JOIN contact c ON c.id = m.contact_id
     WHERE m.status != 'kilépett'`,
  ).all();
  const { results: charges } = await db.prepare("SELECT member_id, period, amount, due_date, status FROM charge").all();
  const { results: payments } = await db.prepare("SELECT member_id, amount FROM payment").all();
  const out = [];
  for (const m of members) {
    const ch = charges.filter((c) => c.member_id === m.id);
    const owed = balanceOn(ch, payments.filter((p) => p.member_id === m.id), today);
    if (owed > 0) {
      const oldest = ch.filter((c) => c.status === "nyitott" && c.due_date <= today).map((c) => c.period).sort()[0];
      out.push({ member_id: m.id, name: m.name, member_code: m.member_code, group_name: m.group_name, owed, oldest });
    }
  }
  return out.sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name, "hu"));
}

/** Egy tag egyenlege az adott napon. */
export async function memberBalance(db, memberId, today) {
  const { results: charges } = await db.prepare("SELECT * FROM charge WHERE member_id = ?").bind(memberId).all();
  const { results: payments } = await db.prepare("SELECT * FROM payment WHERE member_id = ?").bind(memberId).all();
  return balanceOn(charges, payments, today);
}

/** Következő szabad tagkód: MSZ-001, MSZ-002, ... */
export async function nextMemberCode(db) {
  const { results } = await db.prepare("SELECT member_code FROM member").all();
  const max = results.reduce((m, r) => Math.max(m, Number(String(r.member_code).replace(/\D/g, "")) || 0), 0);
  return `MSZ-${String(max + 1).padStart(3, "0")}`;
}
