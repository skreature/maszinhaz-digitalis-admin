-- KITALÁLT mintaadatok a helyi futtatáshoz. Valódi személyes adat ide soha nem kerülhet!
-- Az e-mail-domainek a szabványosan fenntartott example.org / example.net tartományba esnek.

INSERT INTO fee_plan (id, name, amount, frequency, due_day, updated_by) VALUES
  (1, 'Felnőtt csoport – havi bérlet', 12000, 'havi', 10, 'mintaadat'),
  (2, 'Ifjúsági csoport – havi bérlet', 8000, 'havi', 10, 'mintaadat');

INSERT INTO contact (id, name, name_key, email, phone, org, tags, updated_by) VALUES
  (1, 'Kovács Anna',   'anna kovacs',   'anna.kovacs@example.org',  '+36300000101', NULL, 'tag', 'mintaadat'),
  (2, 'Szabó Gábor',   'gabor szabo',   'gabor.szabo@example.org',  '+36300000102', NULL, 'tag', 'mintaadat'),
  (3, 'Tóth Eszter',   'eszter toth',   NULL,                       '+36300000103', NULL, 'tag', 'mintaadat'),
  (4, 'Horváth Bence', 'bence horvath', 'horvath.bence@example.org','+36300000104', NULL, 'tag', 'mintaadat'),
  (5, 'Varga Lili',    'lili varga',    'varga.lili@example.org',   NULL,           NULL, 'tag', 'mintaadat'),
  (6, 'Molnár Dávid',  'david molnar',  'molnar.david@example.org', '+36300000106', NULL, 'tag', 'mintaadat'),
  (7, 'Farkas Réka',   'farkas reka',   'farkas.reka@example.org',  '+36300000107', NULL, 'tag', 'mintaadat'),
  (8, 'Balogh Zsófia', 'balogh zsofia', 'balogh.zsofia@example.org','+36300000108', NULL, 'tag', 'mintaadat');

INSERT INTO contact_identifier (contact_id, kind, value)
  SELECT id, 'email', email FROM contact WHERE email IS NOT NULL;
INSERT INTO contact_identifier (contact_id, kind, value)
  SELECT id, 'phone', phone FROM contact WHERE phone IS NOT NULL;

INSERT INTO member (id, contact_id, member_code, group_name, joined_on, status, fee_plan_id, updated_by) VALUES
  (1, 1, 'MSZ-001', 'felnőtt',   '2026-09-01', 'aktív',    1, 'mintaadat'),
  (2, 2, 'MSZ-002', 'felnőtt',   '2026-09-01', 'aktív',    1, 'mintaadat'),
  (3, 3, 'MSZ-003', 'felnőtt',   '2026-09-01', 'aktív',    1, 'mintaadat'),
  (4, 4, 'MSZ-004', 'ifjúsági',  '2026-09-01', 'aktív',    2, 'mintaadat'),
  (5, 5, 'MSZ-005', 'ifjúsági',  '2026-09-01', 'aktív',    2, 'mintaadat'),
  (6, 6, 'MSZ-006', 'felnőtt',   '2026-10-01', 'aktív',    1, 'mintaadat'),
  (7, 7, 'MSZ-007', 'felnőtt',   '2026-11-01', 'aktív',    1, 'mintaadat'),
  (8, 8, 'MSZ-008', 'felnőtt',   '2026-09-01', 'szünetel', 1, 'mintaadat');

-- Az esedékességeket (charge) nem kell itt megadni: az alkalmazás a kezdőlap első megnyitásakor legenerálja őket.
INSERT INTO payment (member_id, amount, paid_on, method, period, note, recorded_by) VALUES
  (1, 12000, '2026-09-05', 'átutalás', '2026-09', NULL, 'mintaadat'),
  (1, 12000, '2026-10-06', 'átutalás', '2026-10', NULL, 'mintaadat'),
  (1, 12000, '2026-11-04', 'átutalás', '2026-11', NULL, 'mintaadat'),
  (2, 12000, '2026-09-09', 'készpénz', '2026-09', 'próbán', 'mintaadat'),
  (2, 12000, '2026-10-12', 'készpénz', '2026-10', 'próbán', 'mintaadat'),
  (4, 8000,  '2026-09-08', 'átutalás', '2026-09', NULL, 'mintaadat'),
  (4, 8000,  '2026-10-08', 'átutalás', '2026-10', NULL, 'mintaadat'),
  (5, 24000, '2026-09-02', 'átutalás', '2026-09', 'három hónapra előre', 'mintaadat'),
  (6, 12000, '2026-10-10', 'készpénz', '2026-10', NULL, 'mintaadat');

INSERT INTO performance (id, title, starts_at, venue, note, updated_by) VALUES
  (1, 'Nyári éjek', '2026-10-18T19:00', 'Közösségi ház, nagyterem', NULL, 'mintaadat'),
  (2, 'Hajnali vendégek', '2026-12-05T19:00', 'Közösségi ház, nagyterem', 'bemutató', 'mintaadat'),
  (3, 'Mese a hetedik szobáról', '2026-12-14T16:00', 'Kisszínpad', 'gyerekelőadás', 'mintaadat');

INSERT INTO ticket_type (id, performance_id, name, price) VALUES
  (1, 1, 'felnőtt', 3000), (2, 1, 'diák / nyugdíjas', 2000), (3, 1, 'támogatói jegy', 6000),
  (4, 2, 'felnőtt', 3500), (5, 2, 'diák / nyugdíjas', 2500),
  (6, 3, 'gyerek', 1500), (7, 3, 'kísérő felnőtt', 2000), (8, 3, 'családi (2+2)', 6000);

INSERT INTO ticket_sale (ticket_type_id, quantity, amount, sold_on, note, recorded_by) VALUES
  (1, 42, 126000, '2026-10-18', 'pénztár', 'mintaadat'),
  (2, 18, 36000,  '2026-10-18', 'pénztár', 'mintaadat'),
  (3, 5,  30000,  '2026-10-10', 'elővétel', 'mintaadat'),
  (4, 12, 42000,  '2026-11-15', 'elővétel', 'mintaadat'),
  (8, 3,  18000,  '2026-11-16', 'elővétel', 'mintaadat');
