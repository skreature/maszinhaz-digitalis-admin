import { html, money, options, raw } from "../lib/html.js";
import { decodeText, parseCsv } from "../lib/csv.js";
import { cleanName, normalizeEmail, normalizePhone } from "../lib/normalize.js";
import {
  CHANNELS, STATUSES, effectiveStatus, entryList, fitsCapacity, occupancy, parseSalesRows, saleLine, typesFromTemplates,
} from "../lib/tickets.js";
import { addBuyersToContacts, insertSales, loadPerformance } from "../services/tickets.js";

const MAX_ROWS = 2000;
const when = (s) => String(s).replace("T", " ");
const statusBadge = (st) => html`<span class="badge st-${st.replace(/\s/g, "-")}">${st}</span>`;
const occLabel = (o) => (o.capacity === null ? `${o.seats} fő` : `${o.seats} / ${o.capacity} (${o.percent}%)`);

function capacityOf(v) {
  const n = Math.round(Number(v));
  return v === null || v === "" || !(n > 0) ? null : n;
}

async function list(ctx) {
  const { results } = await ctx.db.prepare(
    `SELECT p.*, COALESCE(SUM(CASE WHEN t.is_gift THEN 0 ELSE s.quantity END), 0) AS seats,
       COALESCE(SUM(s.quantity), 0) AS sold, COALESCE(SUM(s.amount), 0) AS revenue
     FROM performance p LEFT JOIN ticket_type t ON t.performance_id = p.id LEFT JOIN ticket_sale s ON s.ticket_type_id = t.id
     GROUP BY p.id ORDER BY p.starts_at DESC`,
  ).all();
  const rows = results.map((p) => {
    const occ = occupancy(p.capacity, [], [{ ticket_type_id: 0, quantity: p.seats }]);
    return { ...p, occ, st: effectiveStatus(p, occ, ctx.today) };
  });
  return ctx.page("Előadások", html`<h1>Előadások</h1>
<p class="actions"><a class="btn secondary small" href="/jegytipusok">Jegytípus-sablonok</a>
<span class="muted">Az admin nem árul jegyet: a webshop, a partnerek és a helyszín eladásait gyűjti egy helyre.</span></p>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Időpont</th><th>Cím</th><th>Állapot</th><th class="num">Foglaltság</th><th class="num">Eladott jegy</th><th class="num">Bevétel</th></tr></thead>
<tbody>${rows.map((p) => html`<tr><td data-l="Időpont">${when(p.starts_at)}</td>
<td data-l="Cím"><a href="/eloadasok/${p.id}">${p.title}</a> <span class="muted">${p.venue}</span></td>
<td data-l="Állapot">${statusBadge(p.st)}</td><td class="num" data-l="Foglaltság">${occLabel(p.occ)}</td>
<td class="num" data-l="Eladott">${p.sold} db</td><td class="num" data-l="Bevétel">${money(p.revenue)}</td></tr>`)}</tbody></table></div>
<h2>Új előadás</h2>
<form class="stack card" method="post" action="/eloadasok">
  <label>Cím (dátum, „teltház”, „utolsó előadás” nélkül – ezek külön mezők)<input name="title" required></label>
  <label>Időpont<input name="starts_at" type="datetime-local" required></label>
  <label>Helyszín<input name="venue"></label>
  <label>Kapacitás (fő, üresen: nincs megadva)<input name="capacity" type="number" inputmode="numeric" min="1" step="1" value="40"></label>
  <label>Állapot<select name="status">${options(STATUSES.map((s) => [s, s]), "elérhető")}</select></label>
  <label>Megjegyzés<input name="note"></label>
  <label class="check"><input type="checkbox" name="from_templates" value="1" checked> Jegytípusok az aktív sablonokból</label>
  <button>Mentés</button>
</form>`);
}

async function addTemplateTypes(db, perfId) {
  const { results: templates } = await db.prepare("SELECT * FROM ticket_template ORDER BY sort, id").all();
  const { results: existing } = await db.prepare("SELECT * FROM ticket_type WHERE performance_id = ?").bind(perfId).all();
  const add = typesFromTemplates(templates, existing);
  if (add.length) {
    await db.batch(add.map((t) => db.prepare(
      "INSERT INTO ticket_type (performance_id, template_id, name, price, eligibility, check_at_entry, is_gift) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(perfId, t.template_id, t.name, t.price, t.eligibility, t.check_at_entry, t.is_gift)));
  }
  return add.length;
}

async function create(ctx) {
  const f = await ctx.form();
  if (!f.get("title") || !f.get("starts_at")) return ctx.redirect("/eloadasok", { hiba: "A cím és az időpont kötelező." });
  const status = STATUSES.includes(f.get("status")) ? f.get("status") : "elérhető";
  const res = await ctx.db.prepare(
    "INSERT INTO performance (title, starts_at, venue, capacity, status, note, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(f.get("title").trim(), f.get("starts_at"), f.get("venue") || null, capacityOf(f.get("capacity")), status,
    f.get("note") || null, ctx.user).run();
  const id = res.meta.last_row_id;
  const n = f.get("from_templates") ? await addTemplateTypes(ctx.db, id) : 0;
  return ctx.redirect(`/eloadasok/${id}`, { ok: `Előadás létrehozva${n ? `, ${n} jegytípus a sablonokból` : ""}. A jegytípusok itt átírhatók.` });
}

async function update(ctx) {
  const f = await ctx.form();
  if (!f.get("title") || !f.get("starts_at")) return ctx.redirect(`/eloadasok/${ctx.params.id}`, { hiba: "A cím és az időpont kötelező." });
  const status = STATUSES.includes(f.get("status")) ? f.get("status") : "elérhető";
  await ctx.db.prepare(
    `UPDATE performance SET title = ?, starts_at = ?, venue = ?, capacity = ?, status = ?, note = ?,
     updated_at = datetime('now'), updated_by = ? WHERE id = ?`,
  ).bind(f.get("title").trim(), f.get("starts_at"), f.get("venue") || null, capacityOf(f.get("capacity")), status,
    f.get("note") || null, ctx.user, ctx.params.id).run();
  return ctx.redirect(`/eloadasok/${ctx.params.id}`, { ok: "Előadás mentve." });
}

function typeRow(p, t) {
  return html`<tr><td data-l="Típus"><strong>${t.name}</strong>${t.is_gift ? html` <span class="tag">ajándék</span>` : ""}
${t.check_at_entry ? html` <span class="tag">belépéskor ellenőrizendő</span>` : ""}
${t.eligibility ? html`<div class="muted">${t.eligibility}</div>` : ""}</td>
<td class="num" data-l="Ár">${money(t.price)}</td><td class="num" data-l="Eladva">${t.sold} db</td><td class="num" data-l="Bevétel">${money(t.revenue)}</td>
<td><details><summary class="btn small secondary">Módosítás</summary>
<form class="stack" method="post" action="/eloadasok/${p.id}/jegytipus/${t.id}" style="margin-top:.5rem">
  <label>Név<input name="name" value="${t.name}" required></label>
  <label>Ár ennél az előadásnál (Ft)<input name="price" type="number" inputmode="numeric" min="0" step="1" value="${t.price}" required></label>
  <label>Jogosultság<input name="eligibility" value="${t.eligibility ?? ""}"></label>
  <label class="check"><input type="checkbox" name="check_at_entry" value="1"${t.check_at_entry ? raw(" checked") : ""}> Belépéskor ellenőrizendő</label>
  <label class="check"><input type="checkbox" name="is_gift" value="1"${t.is_gift ? raw(" checked") : ""}> Ajándékjegy / utalvány (nem foglal helyet)</label>
  <p class="muted">Az ár átírása a már rögzített eladásokat nem változtatja meg: azok a saját egységárukat őrzik.</p>
  <div class="actions"><button class="small">Mentés</button>
  ${t.sale_rows ? "" : html`<button class="small secondary" name="torles" value="1">Törlés</button>`}</div>
</form></details></td></tr>`;
}

async function show(ctx) {
  const data = await loadPerformance(ctx.db, ctx.params.id);
  if (!data) return ctx.redirect("/eloadasok", { hiba: "Nincs ilyen előadás." });
  const { p, types, sales, occ } = data;
  const st = effectiveStatus(p, occ, ctx.today);
  const revenue = sales.reduce((s, x) => s + x.amount, 0);
  const sold = sales.reduce((s, x) => s + x.quantity, 0);
  const byChannel = CHANNELS.map((c) => {
    const rows = sales.filter((s) => s.channel === c);
    return { c, qty: rows.reduce((n, s) => n + s.quantity, 0), amount: rows.reduce((n, s) => n + s.amount, 0) };
  }).filter((x) => x.qty);
  const tplCount = await ctx.db.prepare("SELECT COUNT(*) AS n FROM ticket_template WHERE active = 1").first("n");

  return ctx.page(p.title, html`<h1>${p.title} ${statusBadge(st)}</h1>
<p class="muted">${when(p.starts_at)} · ${p.venue} ${p.note ? html`· ${p.note}` : ""}
${st !== p.status ? html`<br>Rögzített állapot: ${p.status}; a kijelzett állapot ${String(p.starts_at).slice(0, 10) < ctx.today ? "azért lezárt, mert az előadás lezajlott" : "azért teltház, mert betelt a kapacitás"}.` : ""}</p>
<div class="grid">
  <div class="card brand"><div class="muted">Foglaltság</div><div class="big">${occLabel(occ)}</div>
    ${occ.capacity === null ? html`<div class="muted">Nincs megadva kapacitás.</div>`
      : html`<div class="meter"><span style="width:${Math.min(100, occ.percent)}%"></span></div><div class="muted">${occ.free >= 0 ? `${occ.free} szabad hely` : `${-occ.free} fővel túlfoglalva`}</div>`}</div>
  <div class="card brand"><div class="muted">Eladott jegy / bevétel</div><div class="big">${sold} db · ${money(revenue)}</div>
    <div class="muted">${byChannel.map((x) => `${x.c}: ${x.qty} db, ${money(x.amount)}`).join(" · ") || "Még nincs eladás."}</div></div>
  <div class="card"><div class="muted">Belépés</div>
    <div class="actions" style="margin-top:.5rem"><a class="btn accent" href="/eloadasok/${p.id}/belepes">Belépési lista</a></div></div>
</div>

<h2>Jegytípusok ennél az előadásnál</h2>
${types.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Jegytípus</th><th class="num">Ár</th><th class="num">Eladva</th><th class="num">Bevétel</th><th></th></tr></thead>
<tbody>${types.map((t) => typeRow(p, t))}</tbody></table></div>` : html`<p class="muted">Még nincs jegytípus.</p>`}
<div class="grid" style="margin-top:1rem">
<form class="stack card" method="post" action="/eloadasok/${p.id}/jegytipus">
  <strong>Új jegytípus csak ennél az előadásnál</strong>
  <label>Név (pl. pedagógus – ingyenes, szakmai jegy, meghívó)<input name="name" required></label>
  <label>Ár (Ft, lehet 0)<input name="price" type="number" inputmode="numeric" min="0" step="1" required></label>
  <label>Jogosultság (nem kötelező)<input name="eligibility"></label>
  <label class="check"><input type="checkbox" name="check_at_entry" value="1"> Belépéskor ellenőrizendő</label>
  <label class="check"><input type="checkbox" name="is_gift" value="1"> Ajándékjegy / utalvány</label>
  <button class="secondary">Hozzáadás</button>
</form>
<form class="stack card" method="post" action="/eloadasok/${p.id}/sablonbol">
  <strong>Jegytípusok a sablonokból</strong>
  <p class="muted">${tplCount} aktív sablon. Ami már szerepel az előadásnál, azt nem veszi fel újra. A sablonok a
  <a href="/jegytipusok">Jegytípus-sablonok</a> oldalon szerkeszthetők.</p>
  <button class="secondary">Hiányzók hozzáadása</button>
</form>
</div>

${types.length ? html`<h2>Eladás rögzítése</h2>
<div class="grid">
<form class="stack card" method="post" action="/eloadasok/${p.id}/eladas">
  <strong>Kézi rögzítés</strong>
  <label>Jegytípus<select name="ticket_type_id" required>${options(types.map((t) => [t.id, `${t.name} – ${money(t.price)}`]))}</select></label>
  <label>Darab<input name="quantity" type="number" inputmode="numeric" min="1" step="1" value="1" required></label>
  <label>Egységár (Ft) – üresen: a jegytípus mostani ára<input name="unit_price" type="number" inputmode="numeric" min="0" step="1"></label>
  <label>Csatorna<select name="channel">${options(CHANNELS.map((c) => [c, c]), "helyszíni")}</select></label>
  <label>Dátum<input name="sold_on" type="date" value="${ctx.today}" required></label>
  <label>Vevő neve (a belépési listához)<input name="buyer_name" autocomplete="off"></label>
  <label>E-mail<input name="buyer_email" type="email" autocomplete="off"></label>
  <label>Telefon<input name="buyer_phone" type="tel" autocomplete="off"></label>
  <label class="check"><input type="checkbox" name="to_contacts" value="1"> Vevő felvétele a kontakt-mesterlistába (összefésüléssel)</label>
  <label class="check"><input type="checkbox" name="newsletter_consent" value="1"> Kifejezetten hozzájárult a hírlevélhez</label>
  <label>Megjegyzés<input name="note"></label>
  ${occ.capacity !== null ? html`<label class="check"><input type="checkbox" name="over_capacity" value="1"> Túlfoglalás engedélyezése</label>` : ""}
  <button>Rögzítés</button>
</form>
<form class="stack card" method="post" action="/eloadasok/${p.id}/import" enctype="multipart/form-data">
  <strong>Import CSV-ből (webshop-export, partnerlista)</strong>
  <p class="muted">Fejléc: <code>Dátum; Jegytípus; Darab; Egységár; Csatorna; Név; E-mail; Telefon; Hírlevél; Rendelésszám</code>.
  Csak a Jegytípus kötelező; a jegytípus neve egyezzen az előadáséval. Üres ár → a jegytípus mostani ára, üres darab → 1.
  Hírlevél csak „igen” esetén. Az azonos rendelésszámú sort újraimportnál kihagyja. Minta: <code>mintaadatok/jegyeladas_webshop.csv</code>.</p>
  <label>CSV fájl<input type="file" name="file" accept=".csv,.txt,text/csv" required></label>
  <label>Csatorna, ha a fájlban nincs<select name="channel">${options(CHANNELS.map((c) => [c, c]), "saját webshop")}</select></label>
  <label class="check"><input type="checkbox" name="to_contacts" value="1"> Vevők felvétele a kontakt-mesterlistába (összefésüléssel)</label>
  <button class="secondary">Import</button>
</form>
</div>` : ""}

<h2>Rögzített eladások</h2>
${sales.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Dátum</th><th>Jegytípus</th><th class="num">Darab</th><th class="num">Egységár</th><th class="num">Összeg</th><th>Csatorna</th><th>Vevő</th><th>Rögzítette</th></tr></thead>
<tbody>${sales.map((s) => html`<tr><td data-l="Dátum">${s.sold_on}</td><td data-l="Típus">${s.type_name}</td><td class="num" data-l="Darab">${s.quantity}</td>
<td class="num" data-l="Egységár">${money(s.unit_price ?? s.amount / s.quantity)}</td><td class="num" data-l="Összeg">${money(s.amount)}</td>
<td data-l="Csatorna">${s.channel}</td>
<td data-l="Vevő">${s.contact_id ? html`<a href="/kontaktok/${s.contact_id}">${s.buyer_name || s.buyer_email}</a>` : s.buyer_name}
${s.contact_status === "ellenőrzésre vár" ? html` <a class="muted" href="/ellenorzes">(egyezés ellenőrzésre vár)</a>` : ""}
${s.newsletter_consent ? html` <span class="tag">hírlevél: igen</span>` : ""}
${s.external_ref ? html` <span class="muted">#${s.external_ref}</span>` : ""}${s.note ? html` <span class="muted">${s.note}</span>` : ""}</td>
<td data-l="Rögzítette">${s.recorded_by}</td></tr>`)}</tbody></table></div>`
  : html`<p class="muted">Még nincs rögzített eladás.</p>`}

<h2>Előadás adatai</h2>
<form class="stack card" method="post" action="/eloadasok/${p.id}">
  <label>Cím<input name="title" value="${p.title}" required></label>
  <label>Időpont<input name="starts_at" type="datetime-local" value="${p.starts_at}" required></label>
  <label>Helyszín<input name="venue" value="${p.venue ?? ""}"></label>
  <label>Kapacitás (fő)<input name="capacity" type="number" inputmode="numeric" min="1" step="1" value="${p.capacity ?? ""}"></label>
  <label>Állapot<select name="status">${options(STATUSES.map((s) => [s, s]), p.status)}</select></label>
  <label>Megjegyzés<input name="note" value="${p.note ?? ""}"></label>
  <button class="secondary">Mentés</button>
</form>`);
}

function typeFields(f) {
  const price = Math.round(Number(f.get("price")));
  const name = String(f.get("name") ?? "").trim();
  if (!name || f.get("price") === "" || !(price >= 0)) return null;
  return { name, price, eligibility: String(f.get("eligibility") ?? "").trim() || null,
    check_at_entry: f.get("check_at_entry") ? 1 : 0, is_gift: f.get("is_gift") ? 1 : 0 };
}

async function addType(ctx) {
  const t = typeFields(await ctx.form());
  if (!t) return ctx.redirect(`/eloadasok/${ctx.params.id}`, { hiba: "Adj meg nevet és árat (0 Ft is lehet)." });
  await ctx.db.prepare("INSERT INTO ticket_type (performance_id, name, price, eligibility, check_at_entry, is_gift) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(ctx.params.id, t.name, t.price, t.eligibility, t.check_at_entry, t.is_gift).run();
  return ctx.redirect(`/eloadasok/${ctx.params.id}`, { ok: "Jegytípus hozzáadva." });
}

async function editType(ctx) {
  const f = await ctx.form();
  const back = `/eloadasok/${ctx.params.id}`;
  const existing = await ctx.db.prepare(
    "SELECT t.*, (SELECT COUNT(*) FROM ticket_sale s WHERE s.ticket_type_id = t.id) AS n FROM ticket_type t WHERE t.id = ? AND t.performance_id = ?",
  ).bind(ctx.params.tid, ctx.params.id).first();
  if (!existing) return ctx.redirect(back, { hiba: "Nincs ilyen jegytípus." });
  if (f.get("torles")) {
    if (existing.n) return ctx.redirect(back, { hiba: "Eladással rendelkező jegytípus nem törölhető." });
    await ctx.db.prepare("DELETE FROM ticket_type WHERE id = ?").bind(existing.id).run();
    return ctx.redirect(back, { ok: "Jegytípus törölve." });
  }
  const t = typeFields(f);
  if (!t) return ctx.redirect(back, { hiba: "Adj meg nevet és árat (0 Ft is lehet)." });
  await ctx.db.prepare("UPDATE ticket_type SET name = ?, price = ?, eligibility = ?, check_at_entry = ?, is_gift = ? WHERE id = ?")
    .bind(t.name, t.price, t.eligibility, t.check_at_entry, t.is_gift, existing.id).run();
  return ctx.redirect(back, { ok: "Jegytípus mentve. A korábbi eladások egységára nem változott." });
}

async function fromTemplates(ctx) {
  const p = await ctx.db.prepare("SELECT id FROM performance WHERE id = ?").bind(ctx.params.id).first();
  if (!p) return ctx.redirect("/eloadasok", { hiba: "Nincs ilyen előadás." });
  const n = await addTemplateTypes(ctx.db, p.id);
  return ctx.redirect(`/eloadasok/${p.id}`, n ? { ok: `${n} jegytípus hozzáadva a sablonokból.` } : { hiba: "Nincs hiányzó sablon." });
}

async function addSale(ctx) {
  const f = await ctx.form();
  const back = `/eloadasok/${ctx.params.id}`;
  const data = await loadPerformance(ctx.db, ctx.params.id);
  if (!data) return ctx.redirect("/eloadasok", { hiba: "Nincs ilyen előadás." });
  const t = data.types.find((x) => String(x.id) === String(f.get("ticket_type_id")));
  if (!t) return ctx.redirect(back, { hiba: "Válassz jegytípust." });
  let line;
  try {
    line = saleLine(t, f.get("quantity"), f.get("unit_price") === "" ? null : f.get("unit_price"));
  } catch (e) {
    return ctx.redirect(back, { hiba: e.message });
  }
  if (!fitsCapacity(data.occ, line.quantity, t.is_gift) && !f.get("over_capacity")) {
    return ctx.redirect(back, { hiba: `Nincs elég hely: ${data.occ.free} szabad hely van. Túlfoglaláshoz jelöld be a „Túlfoglalás engedélyezése” mezőt.` });
  }
  const sale = {
    ticket_type_id: t.id, ...line,
    channel: CHANNELS.includes(f.get("channel")) ? f.get("channel") : "helyszíni",
    sold_on: f.get("sold_on") || ctx.today,
    buyer_name: cleanName(f.get("buyer_name")), buyer_email: normalizeEmail(f.get("buyer_email")),
    buyer_phone: normalizePhone(f.get("buyer_phone")),
    newsletter_consent: f.get("newsletter_consent") ? 1 : 0, note: f.get("note") || null,
  };
  const [id] = await insertSales(ctx.db, [sale], ctx.user);
  let extra = "";
  if (f.get("to_contacts")) {
    const stats = await addBuyersToContacts(ctx.db, data.p, [{ ...sale, id }], ctx.user);
    extra = !stats ? " A vevőnek nincs neve/elérhetősége, így nem került a kontaktlistára."
      : stats["ellenőrzésre vár"] ? " A vevő hasonlít egy meglévő kontaktra: az Ellenőrzés oldalon dönts róla."
      : stats["összevonva"] ? " A vevő egy meglévő kontakthoz került." : " A vevő új kontaktként került a mesterlistára.";
  }
  return ctx.redirect(back, { ok: `${line.quantity} db ${t.name} jegy rögzítve (${money(line.amount)}).${extra}` });
}

async function importSales(ctx) {
  const f = await ctx.form();
  const back = `/eloadasok/${ctx.params.id}`;
  const data = await loadPerformance(ctx.db, ctx.params.id);
  if (!data) return ctx.redirect("/eloadasok", { hiba: "Nincs ilyen előadás." });
  const file = f.get("file");
  if (!file || typeof file === "string" || !file.size) return ctx.redirect(back, { hiba: "Válassz ki egy fájlt." });
  if (/\.xlsx?$/i.test(file.name)) return ctx.redirect(back, { hiba: "Excel-fájlt előbb ments CSV-be (Fájl → Mentés másként → CSV UTF-8)." });
  const rows = parseCsv(decodeText(new Uint8Array(await file.arrayBuffer())));
  if (rows.length < 2) return ctx.redirect(back, { hiba: "A fájlban nincs fejléc + adatsor." });
  if (rows.length - 1 > MAX_ROWS) return ctx.redirect(back, { hiba: `Túl sok sor (legfeljebb ${MAX_ROWS}).` });
  const channel = CHANNELS.includes(f.get("channel")) ? f.get("channel") : "saját webshop";
  const { sales, errors } = parseSalesRows(rows, data.types, { channel, sold_on: ctx.today });
  if (errors.length && !sales.length) return ctx.redirect(back, { hiba: errors.slice(0, 3).map((e) => `${e.row}. sor: ${e.message}`).join(" ") });

  const seen = new Set(data.sales.map((s) => s.external_ref).filter(Boolean));
  const fresh = sales.filter((s) => {
    if (!s.external_ref) return true;
    if (seen.has(s.external_ref)) return false;
    seen.add(s.external_ref);
    return true;
  });
  const ids = await insertSales(ctx.db, fresh, ctx.user);
  const after = occupancy(data.p.capacity, data.types, [...data.sales, ...fresh]);
  let extra = "";
  if (f.get("to_contacts")) {
    const stats = await addBuyersToContacts(ctx.db, data.p, fresh.map((s, i) => ({ ...s, id: ids[i] })), ctx.user);
    if (stats) extra = ` Kontaktok: ${stats["új"]} új, ${stats["összevonva"]} összevonva, ${stats["ellenőrzésre vár"]} ellenőrzésre vár.`;
  }
  const msg = `${fresh.length} sor importálva (${fresh.reduce((n, s) => n + s.quantity, 0)} jegy).`
    + (sales.length - fresh.length ? ` ${sales.length - fresh.length} már rögzített rendelés kihagyva.` : "")
    + (after.capacity !== null && after.seats > after.capacity ? ` Figyelem: ${after.seats - after.capacity} fővel túllépi a kapacitást.` : "")
    + extra;
  const err = errors.length ? `${errors.length} sor hibás, kimaradt: ` + errors.slice(0, 3).map((e) => `${e.row}. sor: ${e.message}`).join(" ") : undefined;
  return ctx.redirect(back, { ok: msg, hiba: err });
}

async function entryPage(ctx) {
  const data = await loadPerformance(ctx.db, ctx.params.id);
  if (!data) return ctx.redirect("/eloadasok", { hiba: "Nincs ilyen előadás." });
  const { p, occ } = data;
  const list = entryList(data.sales);
  const people = list.reduce((n, s) => n + s.quantity, 0);
  const inside = list.filter((s) => s.checked_in).reduce((n, s) => n + s.quantity, 0);
  return ctx.page(`Belépési lista – ${p.title}`, html`<h1>Belépési lista – ${p.title}</h1>
<p class="muted">${when(p.starts_at)} · ${p.venue} · ${people} fő a listán${occ.capacity !== null ? `, kapacitás ${occ.capacity}` : ""} ·
<span class="noprint">${inside} fő bent</span></p>
<p class="actions noprint"><a class="btn secondary small" href="/eloadasok/${p.id}">Vissza az előadáshoz</a>
<button class="small secondary" onclick="window.print()">Nyomtatás</button></p>
<p class="muted">A <strong>!</strong> jelű jegytípusnál a jogosultságot a belépéskor ellenőrizni kell (pl. lakcímkártya).</p>
${list.length ? html`<div class="table-wrap"><table class="entry">
<thead><tr><th>✓</th><th>Név</th><th>Jegytípus</th><th class="num">Db</th></tr></thead>
<tbody>${list.map((s) => html`<tr class="${s.checked_in ? "in" : ""}">
<td><form method="post" action="/eloadasok/${p.id}/belepes/${s.id}"><button class="tick" aria-label="Belépett">${s.checked_in ? "☑" : "☐"}</button></form></td>
<td>${s.buyer_name || html`<span class="muted">(név nélkül – ${s.channel})</span>`}</td>
<td>${s.type_name}${s.check_at_entry ? html` <strong title="${s.eligibility ?? "ellenőrizendő"}">!</strong><div class="muted">${s.eligibility}</div>` : ""}</td>
<td class="num">${s.quantity}</td></tr>`)}</tbody></table></div>`
  : html`<p class="muted">Még nincs rögzített belépő.</p>`}`);
}

async function toggleEntry(ctx) {
  const s = await ctx.db.prepare(
    "SELECT s.id, s.checked_in FROM ticket_sale s JOIN ticket_type t ON t.id = s.ticket_type_id WHERE s.id = ? AND t.performance_id = ?",
  ).bind(ctx.params.sid, ctx.params.id).first();
  if (s) await ctx.db.prepare("UPDATE ticket_sale SET checked_in = ? WHERE id = ?").bind(s.checked_in ? 0 : 1, s.id).run();
  return ctx.redirect(`/eloadasok/${ctx.params.id}/belepes`);
}

export const routes = [
  ["GET", "/eloadasok", list],
  ["POST", "/eloadasok", create],
  ["GET", "/eloadasok/:id", show],
  ["POST", "/eloadasok/:id", update],
  ["POST", "/eloadasok/:id/sablonbol", fromTemplates],
  ["POST", "/eloadasok/:id/jegytipus", addType],
  ["POST", "/eloadasok/:id/jegytipus/:tid", editType],
  ["POST", "/eloadasok/:id/eladas", addSale],
  ["POST", "/eloadasok/:id/import", importSales],
  ["GET", "/eloadasok/:id/belepes", entryPage],
  ["POST", "/eloadasok/:id/belepes/:sid", toggleEntry],
];
