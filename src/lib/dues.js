// Havi esedékességek generálása és a tartozás számítása. Tiszta függvények.
import { daysInMonth, periodOf, periodsBetween } from "./dates.js";

/**
 * Mely esedékességek hiányoznak a megadott időszakig?
 * Minden aktív, fizetési tervvel rendelkező tagnak a belépése hónapjától `upTo`-ig havonta egy tétel.
 * @param members [{id, joined_on, status, fee_plan_id}]
 * @param plans Map(id -> {amount, due_day, frequency, active})
 * @param existing Set a már létező `${member_id}|${period}` kulcsokból
 * @param upTo ÉÉÉÉ-HH
 * @returns [{member_id, period, amount, due_date}]
 */
export function missingCharges(members, plans, existing, upTo) {
  const out = [];
  for (const m of members) {
    if (m.status !== "aktív" || !m.fee_plan_id) continue;
    const plan = plans.get(m.fee_plan_id);
    if (!plan || plan.frequency !== "havi") continue;
    const from = periodOf(m.joined_on);
    if (from > upTo) continue;
    for (const period of periodsBetween(from, upTo)) {
      if (existing.has(`${m.id}|${period}`)) continue;
      const day = Math.min(Math.max(1, plan.due_day || 1), daysInMonth(period));
      out.push({
        member_id: m.id,
        period,
        amount: plan.amount,
        due_date: `${period}-${String(day).padStart(2, "0")}`,
      });
    }
  }
  return out;
}

/**
 * Befizetések szétosztása az esedékességekre időrendben (a legrégebbi nyitottal kezdve).
 * Az elengedett tételekre nem jut pénz.
 * @param charges [{id, period, amount, status}]
 * @param totalPaid a tag összes befizetése
 * @returns {statuses: Map(id -> 'fizetve'|'nyitott'|'elengedve'), credit: number}
 */
export function allocatePayments(charges, totalPaid) {
  const statuses = new Map();
  let left = totalPaid;
  for (const c of [...charges].sort((a, b) => a.period.localeCompare(b.period))) {
    if (c.status === "elengedve") { statuses.set(c.id, "elengedve"); continue; }
    if (left >= c.amount) { left -= c.amount; statuses.set(c.id, "fizetve"); }
    else statuses.set(c.id, "nyitott");
  }
  return { statuses, credit: left };
}

/**
 * Tartozás egy adott napon: a határidőig esedékes (nem elengedett) tételek összege mínusz az összes befizetés.
 * Negatív érték = előre fizetett összeg (túlfizetés).
 */
export function balanceOn(charges, payments, today) {
  const due = charges
    .filter((c) => c.status !== "elengedve" && c.due_date <= today)
    .reduce((s, c) => s + c.amount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return due - paid;
}

/** Átutalási közlemény javaslat: tagkód + hónap, pl. „MSZ-007 2026-11”. */
export function transferReference(memberCode, period) {
  return `${memberCode} ${period}`;
}
