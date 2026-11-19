import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeText, parseCsv } from "../src/lib/csv.js";
import {
  effectiveStatus, entryList, fitsCapacity, mapSalesHeaders, normalizeChannel, occupancy, parseHuf, parseSalesRows,
  parseYes, saleLine, typesFromTemplates,
} from "../src/lib/tickets.js";

const TYPES = [
  { id: 1, name: "Normál", price: 6500, is_gift: 0 },
  { id: 2, name: "Kedvezményes", price: 5000, is_gift: 0 },
  { id: 3, name: "Pedagógus – ingyenes", price: 0, is_gift: 0 },
  { id: 4, name: "Ajándékjegy", price: 7000, is_gift: 1 },
  { id: 5, name: "Támogatói", price: 10000, is_gift: 0 },
];

test("eladás-sor: az egységár a sorba mentődik, egyedi ár és 0 Ft is lehet", () => {
  assert.deepEqual(saleLine({ price: 6500 }, 3), { quantity: 3, unit_price: 6500, amount: 19500 });
  assert.deepEqual(saleLine({ price: 6500 }, "2", "6000"), { quantity: 2, unit_price: 6000, amount: 12000 });
  assert.deepEqual(saleLine({ price: 0 }, 4), { quantity: 4, unit_price: 0, amount: 0 });
  assert.throws(() => saleLine({ price: 6500 }, 0));
  assert.throws(() => saleLine({ price: 6500 }, 1, -5));
});

test("foglaltság: az ajándékjegy nem foglal helyet; kapacitás nélkül nincs teltház", () => {
  const sales = [{ ticket_type_id: 1, quantity: 30 }, { ticket_type_id: 3, quantity: 5 }, { ticket_type_id: 4, quantity: 10 }];
  const occ = occupancy(40, TYPES, sales);
  assert.deepEqual(occ, { seats: 35, capacity: 40, free: 5, percent: 88, full: false });
  assert.equal(fitsCapacity(occ, 5), true);
  assert.equal(fitsCapacity(occ, 6), false);
  assert.equal(fitsCapacity(occ, 6, true), true); // ajándékjegy
  const none = occupancy(null, TYPES, sales);
  assert.equal(none.full, false);
  assert.equal(fitsCapacity(none, 999), true);
  assert.equal(occupancy(35, TYPES, sales).full, true);
});

test("állapot: lezajlott → lezárt, betelt → teltház, egyébként a rögzített", () => {
  const free = { full: false };
  assert.equal(effectiveStatus({ starts_at: "2026-11-01T19:00", status: "elérhető" }, free, "2026-11-19"), "lezárt");
  assert.equal(effectiveStatus({ starts_at: "2026-11-19T19:00", status: "elérhető" }, free, "2026-11-19"), "elérhető");
  assert.equal(effectiveStatus({ starts_at: "2026-12-01T19:00", status: "elérhető" }, { full: true }, "2026-11-19"), "teltház");
  assert.equal(effectiveStatus({ starts_at: "2026-12-01T19:00", status: "utolsó előadás" }, free, "2026-11-19"), "utolsó előadás");
  assert.equal(effectiveStatus({ starts_at: "2026-12-01T19:00", status: "lezárt" }, free, "2026-11-19"), "lezárt");
});

test("sablonokból csak a hiányzó, aktív típusok kerülnek az előadáshoz", () => {
  const templates = [
    { id: 1, name: "Normál", base_price: 6500, active: 1 },
    { id: 2, name: "Támogatói", base_price: 10000, active: 1 },
    { id: 3, name: "Kedvezményes", base_price: 5000, eligibility: "IX. ker.", check_at_entry: 1, active: 1 },
    { id: 6, name: "Ajándékjegy", base_price: 7000, is_gift: 1, active: 0 },
  ];
  const out = typesFromTemplates(templates, [{ template_id: 1, name: "Normál" }, { template_id: null, name: "támogatói" }]);
  assert.deepEqual(out, [{ template_id: 3, name: "Kedvezményes", price: 5000, eligibility: "IX. ker.", check_at_entry: 1, is_gift: 0 }]);
});

test("csatorna, igen/nem, forint értelmezése", () => {
  assert.equal(normalizeChannel("Tixa"), "partner");
  assert.equal(normalizeChannel("pénztár"), "helyszíni");
  assert.equal(normalizeChannel("online / SimplePay"), "saját webshop");
  assert.equal(normalizeChannel("tiszteletjegy"), "meghívó");
  assert.equal(normalizeChannel("valami"), null);
  assert.equal(parseYes("Igen"), true);
  assert.equal(parseYes(""), false);
  assert.equal(parseYes("nem"), false);
  assert.equal(parseHuf("6 500 Ft"), 6500);
  assert.equal(parseHuf("10.000"), 10000);
  assert.equal(parseHuf("0"), 0);
  assert.equal(parseHuf(""), null);
  assert.equal(parseHuf("sok"), null);
});

test("CSV-fejléc felismerése", () => {
  assert.deepEqual(
    mapSalesHeaders(["Rendelésszám", "Dátum", "Jegytípus", "Darab", "Egységár", "Csatorna", "Vevő neve", "E-mail", "Telefon", "Hírlevél"]),
    ["external_ref", "sold_on", "type", "quantity", "unit_price", "channel", "name", "email", "phone", "newsletter"],
  );
});

test("CSV-import: típus egyeztetés, alapértelmezések, hírlevél alapból nem, hibás sorok külön", () => {
  const rows = parseCsv(decodeText(readFileSync(new URL("../mintaadatok/jegyeladas_webshop.csv", import.meta.url))));
  const { sales, errors } = parseSalesRows(rows, TYPES, { channel: "saját webshop", sold_on: "2026-11-19" });
  assert.equal(sales.length, 5);
  assert.deepEqual(errors.map((e) => e.row), [7]); // „Diák” nincs az előadásnál
  const [a, b, c, d, e] = sales;
  assert.deepEqual([a.ticket_type_id, a.quantity, a.unit_price, a.amount, a.sold_on, a.newsletter_consent], [1, 2, 6500, 13000, "2026-11-18", 1]);
  assert.equal(a.buyer_email, "anna.kovacs@example.org");
  assert.equal(a.channel, "saját webshop");
  assert.equal(b.buyer_phone, "+36300000301");
  assert.equal(b.newsletter_consent, 0); // üres → nem
  assert.equal(c.newsletter_consent, 0); // „nem” → nem
  assert.equal(d.unit_price, 6500); // üres ár → a jegytípus mostani ára
  assert.deepEqual([e.unit_price, e.amount], [0, 0]);
  assert.equal(a.external_ref, "W-2001");
});

test("CSV-import: jegytípus oszlop nélkül hiba; ismeretlen csatorna hiba", () => {
  assert.equal(parseSalesRows([["Név"], ["X"]], TYPES, { channel: "partner", sold_on: "2026-11-19" }).errors.length, 1);
  const r = parseSalesRows([["Jegytípus", "Csatorna"], ["normál", "Tixa"], ["Normál", "???"]], TYPES, { channel: "saját webshop", sold_on: "2026-11-19" });
  assert.equal(r.sales[0].channel, "partner");
  assert.equal(r.sales[0].quantity, 1);
  assert.equal(r.errors[0].row, 3);
});

test("belépési lista: név szerint, névtelen sorok a végén, ajándékjegy nélkül", () => {
  const list = entryList([
    { id: 1, buyer_name: "Zsigmond Éva", is_gift: 0 },
    { id: 2, buyer_name: null, is_gift: 0 },
    { id: 3, buyer_name: "Ádám Bence", is_gift: 0 },
    { id: 4, buyer_name: "Bárány Kata", is_gift: 1 },
  ]);
  assert.deepEqual(list.map((s) => s.id), [3, 1, 2]);
});
