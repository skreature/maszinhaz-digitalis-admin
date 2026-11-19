import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, formatPhone, nameKey, normalizeDate, normalizeEmail, normalizePhone, normalizeRecord, normalizeTags, orgKey } from "../src/lib/normalize.js";

test("e-mail: kisbetű, szóköz és mailto nélkül; érvénytelenből üres", () => {
  assert.equal(normalizeEmail("  Anna.Kovacs@Example.ORG "), "anna.kovacs@example.org");
  assert.equal(normalizeEmail("mailto:x@y.hu"), "x@y.hu");
  assert.equal(normalizeEmail("nincs email"), "");
  assert.equal(normalizeEmail(""), "");
});

test("telefon: minden magyar formából +36 alak", () => {
  for (const raw of ["06-30/000-0201", "+36 30 000 0201", "0630 000 0201", "36300000201", "30 000 0201", "0036 30 000 0201"]) {
    assert.equal(normalizePhone(raw), "+36300000201", raw);
  }
  assert.equal(normalizePhone("06 1 000 0301"), "+3610000301");
  assert.equal(normalizePhone("+44 20 7946 0000"), "+442079460000");
  assert.equal(normalizePhone("123"), "");
  assert.equal(normalizePhone(""), "");
});

test("telefon olvasható alakban", () => {
  assert.equal(formatPhone("+36300000201"), "+36 30 000 0201");
  assert.equal(formatPhone("+3610000301"), "+36 1 000 0301");
});

test("név: szóközök, CSUPA NAGY betűs nevek rendbetétele", () => {
  assert.equal(cleanName("  Péterfi   Judit "), "Péterfi Judit");
  assert.equal(cleanName("LENGYEL MÁRTON"), "Lengyel Márton");
  assert.equal(cleanName("kovács anna-mária"), "Kovács Anna-Mária");
  assert.equal(cleanName("McArthur Éva"), "McArthur Éva");
});

test("névkulcs: ékezet, kis/nagybetű, sorrend és titulus nem számít", () => {
  assert.equal(nameKey("Nagy Éva"), nameKey("NAGY EVA"));
  assert.equal(nameKey("Kovács Anna"), nameKey("Anna Kovacs"));
  assert.equal(nameKey("Dr. Kiss Péter"), nameKey("Kiss Peter"));
  assert.notEqual(nameKey("Kiss Péter"), nameKey("Kis Péter"));
});

test("szervezetkulcs: jogi forma és ékezet nélkül", () => {
  assert.equal(orgKey("Kultúrportál Kft."), orgKey("kulturportal"));
});

test("dátum és címkék egységesítése", () => {
  assert.equal(normalizeDate("2024.11.02"), "2024-11-02");
  assert.equal(normalizeDate("2024-1-5 10:00"), "2024-01-05");
  assert.equal(normalizeDate("tegnap"), "");
  assert.deepEqual(normalizeTags("Sajtó, partner;sajtó"), ["partner", "sajtó"]);
});

test("rekord: vezeték- és keresztnévből teljes név", () => {
  const r = normalizeRecord({ last_name: "Tóth", first_name: "Eszter", email: "ESZTER@example.net", phone: "06300000103" });
  assert.equal(r.name, "Tóth Eszter");
  assert.equal(r.email, "eszter@example.net");
  assert.equal(r.phone, "+36300000103");
});
