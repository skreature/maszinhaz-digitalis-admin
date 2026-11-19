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

-- Jegytípus-sablonok: a mai webshop három fix típusa (6 500 / 10 000 / 5 000 Ft) + szabad lista (0 Ft, ajándék).
INSERT INTO ticket_template (id, name, base_price, eligibility, check_at_entry, is_gift, active, sort, updated_by) VALUES
  (1, 'Normál', 6500, NULL, 0, 0, 1, 1, 'mintaadat'),
  (2, 'Támogatói', 10000, 'Aki a jegyárral a színházat is támogatná', 0, 0, 1, 2, 'mintaadat'),
  (3, 'Kedvezményes', 5000, 'IX. kerületi lakos (lakcímkártya bemutatásával vehető igénybe)', 1, 0, 1, 3, 'mintaadat'),
  (4, 'Pedagógus – ingyenes', 0, 'IX. kerületi pedagógus (pedagógusigazolvánnyal)', 1, 0, 0, 4, 'mintaadat'),
  (5, 'Meghívó', 0, 'Alkotók vendégei, sajtó, partnerek', 0, 0, 0, 5, 'mintaadat'),
  (6, 'Ajándékjegy', 7000, 'Utalvány dátum nélkül, bármelyik előadásra beváltható', 0, 1, 0, 6, 'mintaadat');

-- Kitalált előadások. A dátum, az állapot és a kapacitás külön mező (nem a címben).
INSERT INTO performance (id, title, starts_at, venue, capacity, status, note, updated_by) VALUES
  (1, 'Csendes vasárnap', '2026-10-18T19:00', 'Nagyterem', 40, 'elérhető', NULL, 'mintaadat'),
  (2, 'Mozdulj rá! – mozgásszínházi workshop', '2026-11-22T10:00', 'Próbaterem', 16, 'elérhető', 'workshop', 'mintaadat'),
  (3, 'Hajnali vendégek', '2026-11-28T19:00', 'Nagyterem', 40, 'elérhető', 'bemutató', 'mintaadat'),
  (4, 'Hajnali vendégek', '2026-12-06T19:00', 'Nagyterem', 40, 'elérhető', NULL, 'mintaadat'),
  (5, 'Mese a hetedik szobáról', '2026-12-14T10:00', 'Kisterem (párnás nézőtér)', 25, 'elérhető', 'gyerekelőadás', 'mintaadat'),
  (6, 'Csendes vasárnap', '2026-12-20T17:00', 'Nagyterem', 40, 'utolsó előadás', NULL, 'mintaadat');

INSERT INTO ticket_type (id, performance_id, template_id, name, price, eligibility, check_at_entry, is_gift) VALUES
  (1, 1, 1, 'Normál', 6500, NULL, 0, 0),
  (2, 1, 2, 'Támogatói', 10000, 'Aki a jegyárral a színházat is támogatná', 0, 0),
  (3, 1, 3, 'Kedvezményes', 5000, 'IX. kerületi lakos (lakcímkártya bemutatásával vehető igénybe)', 1, 0),
  (4, 2, 1, 'Normál', 5000, NULL, 0, 0),
  (5, 2, 2, 'Támogatói', 10000, 'Aki a jegyárral a színházat is támogatná', 0, 0),
  (6, 3, 1, 'Normál', 7500, NULL, 0, 0),
  (7, 3, 2, 'Támogatói', 10000, 'Aki a jegyárral a színházat is támogatná', 0, 0),
  (8, 3, 5, 'Meghívó', 0, 'Alkotók vendégei, sajtó, partnerek', 0, 0),
  (9, 4, 1, 'Normál', 6500, NULL, 0, 0),
  (10, 4, 2, 'Támogatói', 10000, 'Aki a jegyárral a színházat is támogatná', 0, 0),
  (11, 4, 3, 'Kedvezményes', 5000, 'IX. kerületi lakos (lakcímkártya bemutatásával vehető igénybe)', 1, 0),
  (12, 4, 4, 'Pedagógus – ingyenes', 0, 'IX. kerületi pedagógus (pedagógusigazolvánnyal)', 1, 0),
  (13, 5, 1, 'Normál', 5500, NULL, 0, 0),
  (14, 5, 3, 'Kedvezményes', 5000, 'IX. kerületi lakos (lakcímkártya bemutatásával vehető igénybe)', 1, 0),
  (15, 6, 1, 'Normál', 6500, NULL, 0, 0),
  (16, 6, 2, 'Támogatói', 10000, 'Aki a jegyárral a színházat is támogatná', 0, 0),
  (17, 6, 3, 'Kedvezményes', 5000, 'IX. kerületi lakos (lakcímkártya bemutatásával vehető igénybe)', 1, 0),
  (18, 6, 6, 'Ajándékjegy', 7000, 'Utalvány dátum nélkül, bármelyik előadásra beváltható', 0, 1);

-- Eladás-sorok: csatorna + a rögzítéskori egységár. Az 1. előadás korai elővétele még a régi, 6 000 Ft-os áron ment.
INSERT INTO ticket_sale (ticket_type_id, quantity, unit_price, amount, sold_on, channel, buyer_name, buyer_email, buyer_phone, newsletter_consent, external_ref, checked_in, note, recorded_by) VALUES
  (1, 6,  6000, 36000, '2026-08-30', 'saját webshop', 'Pálfi Noémi', 'palfi.noemi@example.net', NULL, 1, 'W-1001', 1, 'régi ár', 'mintaadat'),
  (1, 14, 6500, 91000, '2026-10-10', 'saját webshop', NULL, NULL, NULL, 0, NULL, 1, 'összesítve a webshop-exportból', 'mintaadat'),
  (2, 3, 10000, 30000, '2026-10-12', 'saját webshop', 'Bodnár Klára', 'bodnar.klara@example.net', '+36300000201', 0, 'W-1012', 1, NULL, 'mintaadat'),
  (3, 9,  5000, 45000, '2026-10-18', 'helyszíni', NULL, NULL, NULL, 0, NULL, 1, 'pénztár', 'mintaadat'),
  (4, 9,  5000, 45000, '2026-11-12', 'saját webshop', NULL, NULL, NULL, 0, NULL, 0, NULL, 'mintaadat'),
  (5, 2, 10000, 20000, '2026-11-14', 'saját webshop', 'Erdős Tamás', 'erdos.tamas@example.net', NULL, 1, 'W-1040', 0, NULL, 'mintaadat'),
  (6, 2,  7500, 15000, '2026-11-02', 'saját webshop', 'Jakab Petra', 'jakab.petra@example.net', '+36300000202', 0, 'W-1031', 0, NULL, 'mintaadat'),
  (6, 22, 7500, 165000, '2026-11-15', 'saját webshop', NULL, NULL, NULL, 0, NULL, 0, 'összesítve a webshop-exportból', 'mintaadat'),
  (6, 4,  7500, 30000, '2026-11-16', 'partner', 'Lengyel Bálint', NULL, NULL, 0, 'TX-77', 0, 'közös produkció, partnerjegy', 'mintaadat'),
  (7, 3, 10000, 30000, '2026-11-03', 'saját webshop', 'Fodor Judit', 'fodor.judit@example.net', NULL, 1, 'W-1033', 0, NULL, 'mintaadat'),
  (8, 4,  0,    0,     '2026-11-01', 'meghívó', 'Sárközi Ádám', NULL, NULL, 0, NULL, 0, 'sajtó', 'mintaadat'),
  (9, 8,  6500, 52000, '2026-11-17', 'saját webshop', NULL, NULL, NULL, 0, NULL, 0, NULL, 'mintaadat'),
  (11, 2, 5000, 10000, '2026-11-18', 'saját webshop', 'Rácz Mónika', 'racz.monika@example.net', NULL, 0, 'W-1052', 0, NULL, 'mintaadat'),
  (12, 3, 0,    0,     '2026-11-18', 'meghívó', 'Kiss Botond', 'kiss.botond@example.net', NULL, 0, NULL, 0, 'pedagógus, 3 fő', 'mintaadat'),
  (13, 20, 5500, 110000, '2026-11-10', 'saját webshop', NULL, NULL, NULL, 0, NULL, 0, 'összesítve a webshop-exportból', 'mintaadat'),
  (14, 5, 5000, 25000, '2026-11-11', 'saját webshop', 'Halász Vera', 'halasz.vera@example.net', NULL, 1, 'W-1047', 0, NULL, 'mintaadat'),
  (15, 6, 6500, 39000, '2026-11-18', 'saját webshop', NULL, NULL, NULL, 0, NULL, 0, NULL, 'mintaadat'),
  (18, 2, 7000, 14000, '2026-11-19', 'saját webshop', 'Mészáros Ilona', 'meszaros.ilona@example.net', NULL, 0, 'W-1060', 0, 'ajándékba', 'mintaadat');
