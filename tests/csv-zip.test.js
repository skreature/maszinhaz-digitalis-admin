import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeText, detectDelimiter, parseCsv, toCsv } from "../src/lib/csv.js";
import { crc32, makeZip } from "../src/lib/zip.js";

test("CSV: elválasztó felismerése, idézőjelek, BOM, üres sorok", () => {
  assert.equal(detectDelimiter("Név;E-mail\n"), ";");
  assert.equal(detectDelimiter("a,b,c\n"), ",");
  const rows = parseCsv('﻿Név,Szervezet\r\n"Fekete Orsolya","Kultúrportál, ""online"""\r\n\r\nX,"két\nsor"\n');
  assert.deepEqual(rows, [["Név", "Szervezet"], ["Fekete Orsolya", 'Kultúrportál, "online"'], ["X", "két\nsor"]]);
});

test("CSV: oda-vissza alakítás", () => {
  const data = [["a", "b;c"], ['"idéz"', null]];
  assert.deepEqual(parseCsv(toCsv(data)), [["a", "b;c"], ['"idéz"', ""]]);
});

test("Windows-1250 kódolású régi export olvasása", () => {
  const bytes = new Uint8Array([0x4e, 0xe9, 0x76]); // „Név” cp1250-ben
  assert.equal(decodeText(bytes), "Név");
  assert.equal(decodeText(new TextEncoder().encode("Mészáros")), "Mészáros");
});

test("ZIP: CRC32 és szerkezet", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const zip = makeZip([{ name: "a.csv", data: "x" }, { name: "b.csv", data: "yy" }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 12, true), 2);
});
