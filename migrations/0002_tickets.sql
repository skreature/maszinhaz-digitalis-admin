-- Jegyes rész (jegykutatás 6. fejezet): az admin NEM árul jegyet, hanem a máshol történt eladásokat gyűjti egy helyre.

-- Jegytípus-sablon: ebből kap minden előadás egy saját, felülírható listát.
CREATE TABLE ticket_template (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  base_price INTEGER NOT NULL CHECK (base_price >= 0),   -- 0 Ft: ingyenes / meghívó
  eligibility TEXT,                                       -- jogosultság, pl. „IX. kerületi lakos (lakcímkártyával)”
  check_at_entry INTEGER NOT NULL DEFAULT 0,              -- a belépésnél ellenőrizendő
  is_gift INTEGER NOT NULL DEFAULT 0,                     -- ajándékjegy / utalvány: nem foglal helyet
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Az előadás időpontja eddig is külön mező volt; most az állapot és a kapacitás is az.
ALTER TABLE performance ADD COLUMN status TEXT NOT NULL DEFAULT 'elérhető'
  CHECK (status IN ('elérhető', 'teltház', 'utolsó előadás', 'lezárt'));
ALTER TABLE performance ADD COLUMN capacity INTEGER;

-- Az előadás saját jegytípusai (sablonból másolva, eseményenként felülírhatók).
ALTER TABLE ticket_type ADD COLUMN template_id INTEGER REFERENCES ticket_template(id) ON DELETE SET NULL;
ALTER TABLE ticket_type ADD COLUMN eligibility TEXT;
ALTER TABLE ticket_type ADD COLUMN check_at_entry INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_type ADD COLUMN is_gift INTEGER NOT NULL DEFAULT 0;

-- Eladás-sor: csatorna, a rögzítéskori egységár, vevő (opcionális), külön hírlevél-hozzájárulás, belépési pipa.
ALTER TABLE ticket_sale ADD COLUMN channel TEXT NOT NULL DEFAULT 'saját webshop'
  CHECK (channel IN ('saját webshop', 'partner', 'helyszíni', 'meghívó'));
ALTER TABLE ticket_sale ADD COLUMN unit_price INTEGER;
ALTER TABLE ticket_sale ADD COLUMN buyer_name TEXT;
ALTER TABLE ticket_sale ADD COLUMN buyer_email TEXT;
ALTER TABLE ticket_sale ADD COLUMN buyer_phone TEXT;
ALTER TABLE ticket_sale ADD COLUMN newsletter_consent INTEGER NOT NULL DEFAULT 0;
-- a kontakt-mesterlistába a meglévő összefésülő folyamaton át kerül (feltöltés → forrásrekord → kontakt)
ALTER TABLE ticket_sale ADD COLUMN source_record_id INTEGER REFERENCES source_record(id) ON DELETE SET NULL;
ALTER TABLE ticket_sale ADD COLUMN external_ref TEXT;   -- pl. webshop-rendelésszám: újraimportnál nem duplikál
ALTER TABLE ticket_sale ADD COLUMN checked_in INTEGER NOT NULL DEFAULT 0;

UPDATE ticket_sale SET unit_price = amount / quantity WHERE unit_price IS NULL AND quantity > 0;
CREATE INDEX ticket_sale_type ON ticket_sale(ticket_type_id);
CREATE INDEX ticket_type_performance ON ticket_type(performance_id);
