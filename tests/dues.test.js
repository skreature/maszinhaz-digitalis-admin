import { test } from "node:test";
import assert from "node:assert/strict";
import { allocatePayments, balanceOn, missingCharges, transferReference } from "../src/lib/dues.js";
import { nextPeriod, periodsBetween, todayBudapest } from "../src/lib/dates.js";

const plans = new Map([[1, { amount: 12000, due_day: 10, frequency: "havi" }], [2, { amount: 8000, due_day: 31, frequency: "havi" }]]);

test("időszakok: évváltás", () => {
  assert.equal(nextPeriod("2026-12"), "2027-01");
  assert.deepEqual(periodsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
});

test("havi esedékesség a belépés hónapjától, csak aktív, tervvel rendelkező tagnak", () => {
  const members = [
    { id: 1, joined_on: "2026-09-15", status: "aktív", fee_plan_id: 1 },
    { id: 2, joined_on: "2026-09-01", status: "szünetel", fee_plan_id: 1 },
    { id: 3, joined_on: "2026-09-01", status: "aktív", fee_plan_id: null },
    { id: 4, joined_on: "2027-01-01", status: "aktív", fee_plan_id: 1 },
  ];
  const out = missingCharges(members, plans, new Set(), "2026-11");
  assert.deepEqual(out.map((c) => `${c.member_id}|${c.period}|${c.amount}|${c.due_date}`),
    ["1|2026-09|12000|2026-09-10", "1|2026-10|12000|2026-10-10", "1|2026-11|12000|2026-11-10"]);
});

test("idempotens: a már meglévő hónapot nem hozza létre újra", () => {
  const members = [{ id: 1, joined_on: "2026-10-01", status: "aktív", fee_plan_id: 1 }];
  const out = missingCharges(members, plans, new Set(["1|2026-10"]), "2026-11");
  assert.deepEqual(out.map((c) => c.period), ["2026-11"]);
});

test("a határidő a hónap utolsó napjánál nem lehet később (február)", () => {
  const out = missingCharges([{ id: 9, joined_on: "2027-02-01", status: "aktív", fee_plan_id: 2 }], plans, new Set(), "2027-02");
  assert.equal(out[0].due_date, "2027-02-28");
});

test("befizetések szétosztása: legrégebbi először, elengedett kimarad", () => {
  const charges = [
    { id: 3, period: "2026-11", amount: 12000, status: "nyitott" },
    { id: 1, period: "2026-09", amount: 12000, status: "nyitott" },
    { id: 2, period: "2026-10", amount: 12000, status: "elengedve" },
  ];
  const { statuses, credit } = allocatePayments(charges, 15000);
  assert.equal(statuses.get(1), "fizetve");
  assert.equal(statuses.get(2), "elengedve");
  assert.equal(statuses.get(3), "nyitott");
  assert.equal(credit, 3000);
});

test("tartozás: csak a lejárt határidejű, nem elengedett tételek számítanak", () => {
  const charges = [
    { amount: 12000, due_date: "2026-10-10", status: "nyitott" },
    { amount: 12000, due_date: "2026-11-10", status: "nyitott" },
    { amount: 12000, due_date: "2026-12-10", status: "nyitott" },
    { amount: 12000, due_date: "2026-09-10", status: "elengedve" },
  ];
  assert.equal(balanceOn(charges, [{ amount: 12000 }], "2026-11-19"), 12000);
  assert.equal(balanceOn(charges, [{ amount: 30000 }], "2026-11-19"), -6000);
});

test("átutalási közlemény és budapesti dátum", () => {
  assert.equal(transferReference("MSZ-007", "2026-11"), "MSZ-007 2026-11");
  assert.equal(todayBudapest(new Date("2026-11-19T23:30:00Z")), "2026-11-20");
});
