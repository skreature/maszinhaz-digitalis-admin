-- MáSzínház admin – alap adatmodell (terv 5. fejezet).
-- Minden fő táblában: létrehozás/módosítás ideje és a módosító neve.

-- Mesterlista: mindenki egyszer szerepel.
CREATE TABLE contact (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,            -- ékezet nélküli, kisbetűs, rendezett névkulcs
  email TEXT,                        -- elsődleges e-mail (egységesítve)
  phone TEXT,                        -- elsődleges telefon (+36... alakban)
  org TEXT,
  tags TEXT NOT NULL DEFAULT '',     -- vesszővel elválasztott címkék
  consent_newsletter INTEGER NOT NULL DEFAULT 0,
  consent_date TEXT,
  consent_source TEXT,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE INDEX contact_name_key ON contact(name_key);

-- Egy személy összes ismert e-mail címe és telefonszáma (összevonáskor egyik sem vész el).
CREATE TABLE contact_identifier (
  contact_id INTEGER NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'phone')),
  value TEXT NOT NULL,
  PRIMARY KEY (kind, value)
);
CREATE INDEX contact_identifier_contact ON contact_identifier(contact_id);

-- Feltöltött lista.
CREATE TABLE upload (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  headers TEXT NOT NULL,             -- JSON tömb
  mapping TEXT,                      -- JSON: oszlopindex -> mező
  status TEXT NOT NULL DEFAULT 'párosításra vár',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);

-- A feltöltött lista egy sora, változatlanul (nyers adat) + feldolgozott mezők.
CREATE TABLE source_record (
  id INTEGER PRIMARY KEY,
  upload_id INTEGER NOT NULL REFERENCES upload(id) ON DELETE CASCADE,
  row_no INTEGER NOT NULL,
  raw TEXT NOT NULL,                 -- JSON tömb, a sor eredeti cellái
  name TEXT, email TEXT, phone TEXT, org TEXT,
  suggested_tags TEXT NOT NULL DEFAULT '',
  consent_date TEXT,
  contact_id INTEGER REFERENCES contact(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'feldolgozatlan'
    -- feldolgozatlan | új | összevonva | ellenőrzésre vár | kihagyva | üres
);
CREATE INDEX source_record_upload ON source_record(upload_id);
CREATE INDEX source_record_contact ON source_record(contact_id);

-- Megjegyzett oszlop-párosítás: azonos fejlécű fájlnál újra felajánljuk.
CREATE TABLE mapping_memory (
  header_signature TEXT PRIMARY KEY,
  mapping TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bizonytalan pár: egy forrásrekord és egy meglévő kontakt.
CREATE TABLE review_item (
  id INTEGER PRIMARY KEY,
  source_record_id INTEGER NOT NULL REFERENCES source_record(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'nyitott',  -- nyitott | lezárva
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Emberi döntések: ugyanazt a párt nem kérdezzük újra.
-- fingerprint = a forrásrekord egységesített név+e-mail+telefon kulcsa.
CREATE TABLE match_decision (
  fingerprint TEXT NOT NULL,
  contact_id INTEGER NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('ugyanaz', 'külön', 'kihagy')),
  decided_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by TEXT,
  PRIMARY KEY (fingerprint, contact_id)
);

-- Fizetési terv, pl. „Felnőtt csoport – havi bérlet”.
CREATE TABLE fee_plan (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,           -- forint
  frequency TEXT NOT NULL DEFAULT 'havi',
  due_day INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Tag = egy kontakt, aki a színház tagja.
CREATE TABLE member (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL UNIQUE REFERENCES contact(id),
  member_code TEXT NOT NULL UNIQUE,
  group_name TEXT,
  joined_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktív',   -- aktív | szünetel | kilépett
  fee_plan_id INTEGER REFERENCES fee_plan(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Esedékesség: ennek a tagnak ebben a hónapban ennyit kell fizetnie.
CREATE TABLE charge (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  period TEXT NOT NULL,              -- ÉÉÉÉ-HH
  amount INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nyitott', -- nyitott | fizetve | elengedve
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, period)
);

-- Befizetés (csak nyilvántartás: nincs bank, nincs kártya).
CREATE TABLE payment (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  paid_on TEXT NOT NULL,
  method TEXT NOT NULL,              -- készpénz | átutalás | egyéb
  period TEXT,                       -- melyik időszakra (tájékoztató)
  note TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX payment_member ON payment(member_id);

-- Előadások, jegytípusok, kézzel rögzített eladások.
CREATE TABLE performance (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,           -- ÉÉÉÉ-HH-NNTÓÓ:PP
  venue TEXT,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE ticket_type (
  id INTEGER PRIMARY KEY,
  performance_id INTEGER NOT NULL REFERENCES performance(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL
);

CREATE TABLE ticket_sale (
  id INTEGER PRIMARY KEY,
  ticket_type_id INTEGER NOT NULL REFERENCES ticket_type(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  sold_on TEXT NOT NULL,
  note TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
