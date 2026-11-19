import { test } from "node:test";
import assert from "node:assert/strict";
import { addToIndex, createIndex, editDistance, findMatch, fingerprint, similarNames } from "../src/lib/match.js";
import { nameKey } from "../src/lib/normalize.js";
import { suggestTags } from "../src/lib/classify.js";
import { mergeFields } from "../src/lib/merge.js";

function index() {
  const ix = createIndex();
  addToIndex(ix, { id: 1, name: "Kovács Anna", email: "anna.kovacs@example.org", phone: "+36300000101" });
  addToIndex(ix, { id: 2, name: "Kiss Péter", email: "kiss.peter@kulturportal.example", org: "Kultúrportál" },
    [{ kind: "email", value: "peter.masik@example.net" }]);
  addToIndex(ix, { id: 3, name: "Szabó Gábor", email: "gabor.szabo@example.org" });
  return ix;
}

test("szerkesztési távolság és hasonló nevek", () => {
  assert.equal(editDistance("kis", "kiss"), 1);
  assert.equal(editDistance("abc", "abc"), 0);
  assert.ok(similarNames(nameKey("Kis Péter"), nameKey("Kiss Péter")));
  assert.ok(!similarNames(nameKey("Kiss Péter"), nameKey("Kiss Pál")));
});

test("biztos egyezés azonos e-mail alapján (a további e-mailekkel is)", () => {
  assert.deepEqual(findMatch({ name: "Anna", email: "anna.kovacs@example.org" }, index()),
    { kind: "biztos", contactId: 1, reason: "azonos e-mail" });
  assert.equal(findMatch({ name: "P", email: "peter.masik@example.net" }, index()).contactId, 2);
});

test("biztos egyezés azonos telefonszám alapján, eltérő e-maillel", () => {
  const m = findMatch({ name: "Kovács A.", email: "masik@example.net", phone: "+36300000101" }, index());
  assert.equal(m.kind, "biztos");
  assert.equal(m.reason, "azonos telefonszám");
});

test("bizonytalan: azonos név eltérő e-maillel", () => {
  const m = findMatch({ name: "Szabo Gabor", email: "gabor.szabo@hirvarosi.example" }, index());
  assert.equal(m.kind, "bizonytalan");
  assert.equal(m.contactId, 3);
});

test("bizonytalan: elírt név azonos szervezetnél; más szervezetnél új", () => {
  const same = findMatch({ name: "Kis Péter", email: "peter.kis@kulturportal.example", org: "Kultúrportál Kft." }, index());
  assert.equal(same.kind, "bizonytalan");
  assert.equal(same.reason, "hasonló név, azonos szervezet");
  assert.equal(findMatch({ name: "Kis Péter", email: "pk@example.net", org: "Másik Lap" }, index()).kind, "új");
});

test("új, ha semmi nem hasonló; üres sor felismerése", () => {
  assert.equal(findMatch({ name: "Vida Zoltán", email: "vida@example.net" }, index()).kind, "új");
  assert.equal(findMatch({ name: "", email: "", phone: "" }, index()).kind, "üres");
});

test("megjegyzett döntés: ugyanazt a párt nem kérdezi újra", () => {
  const rec = { name: "Szabó Gábor", email: "gabor.szabo@hirvarosi.example", phone: "" };
  const fp = fingerprint(rec);
  assert.equal(findMatch(rec, index(), new Map([[`${fp}|3`, "külön"]])).kind, "új");
  assert.deepEqual(findMatch(rec, index(), new Map([[`${fp}|3`, "ugyanaz"]])),
    { kind: "biztos", contactId: 3, reason: "korábbi döntés: ugyanaz" });
  assert.equal(findMatch(rec, index(), new Map([[`${fp}|3`, "kihagy"]])).kind, "kihagy");
});

test("címkejavaslat fájlnév, szervezet és e-mail domain alapján", () => {
  assert.deepEqual(suggestTags({ filename: "sajtolista_regi.csv" }), ["sajtó"]);
  assert.deepEqual(suggestTags({ org: "Rádió Alfa szerkesztőség" }), ["sajtó"]);
  assert.deepEqual(suggestTags({ email: "x@onkormanyzat.example" }), ["partner"]);
  assert.deepEqual(suggestTags({ filename: "partnerek_2023.csv", org: "Zöldliget Általános Iskola" }), ["partner"]);
  assert.deepEqual(suggestTags({ filename: "hirlevel_export.csv", isMember: true }), ["néző", "tag"]);
  assert.deepEqual(suggestTags({ filename: "lista.csv", org: "Valami Kft." }), []);
  assert.deepEqual(suggestTags({ org: "Napfény Alapítvány", email: "x@napfeny-alapitvany.example" }), ["partner"]);
  assert.deepEqual(suggestTags({ email: "x@radio-alfa.example" }), ["sajtó"]);
});

test("összevonás: üres mezőt tölt, címkét egyesít, hozzájárulást forrással rögzít", () => {
  const out = mergeFields(
    { name: "Bodnár Ilona", email: "bodnar.ilona@muvhaz.example", phone: null, org: "Városi Művelődési Ház", tags: "partner", consent_newsletter: 0 },
    { name: "Bodnár Ilona", email: "bodnar.ilona@muvhaz.example", phone: "+3610000301", org: "", tags: ["néző"], consent_date: "2024-11-02" },
    "hirlevel_export.csv",
  );
  assert.equal(out.phone, "+3610000301");
  assert.equal(out.org, "Városi Művelődési Ház");
  assert.equal(out.tags, "néző,partner");
  assert.equal(out.consent_newsletter, 1);
  assert.equal(out.consent_source, "hirlevel_export.csv");
});

test("összevonás: ugyanannak a névnek az ékezetes alakja marad meg", () => {
  assert.equal(mergeFields({ name: "Nagy Eva", tags: "" }, { name: "Nagy Éva", tags: [] }, "x").name, "Nagy Éva");
  assert.equal(mergeFields({ name: "Molnár Dávid", tags: "" }, { name: "Molnar David", tags: [] }, "x").name, "Molnár Dávid");
  assert.equal(mergeFields({ name: "Kiss Péter", tags: "" }, { name: "Kis Péter", tags: [] }, "x").name, "Kiss Péter");
});
