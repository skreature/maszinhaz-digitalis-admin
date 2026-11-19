import { html, options } from "../lib/html.js";
import { decodeText, parseCsv } from "../lib/csv.js";
import { formatPhone, normalizeTags } from "../lib/normalize.js";
import { FIELDS, decideReview, guessField, headerSignature, processUpload } from "../services/contacts.js";

const MAX_ROWS = 5000;

async function uploadPage(ctx) {
  const { results } = await ctx.db.prepare(
    `SELECT u.*, COUNT(s.id) AS rows,
       SUM(s.status = 'új') AS new_n, SUM(s.status = 'összevonva') AS merged_n, SUM(s.status = 'ellenőrzésre vár') AS review_n
     FROM upload u LEFT JOIN source_record s ON s.upload_id = u.id GROUP BY u.id ORDER BY u.id DESC`,
  ).all();
  return ctx.page("Lista feltöltése", html`<h1>Lista feltöltése</h1>
<form class="stack card" method="post" enctype="multipart/form-data">
  <label>CSV fájl (Excelből: Fájl → Mentés másként → CSV UTF-8)<input type="file" name="file" accept=".csv,.txt,text/csv" required></label>
  <p class="muted">A fájl neve forrásként megmarad, és a címkejavaslatot is befolyásolja (pl. „sajtolista” → sajtó). Valódi listát csak a szervezet saját példányába tölts fel.</p>
  <button>Feltöltés</button>
</form>
<h2>Korábbi feltöltések</h2>
${results.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Fájl</th><th>Mikor</th><th>Állapot</th><th class="num">Sorok</th><th class="num">Új</th><th class="num">Összevonva</th><th class="num">Ellenőrzésre</th></tr></thead>
<tbody>${results.map((u) => html`<tr><td data-l="Fájl"><a href="/feltoltes/${u.id}">${u.filename}</a></td><td data-l="Mikor">${u.created_at}</td>
<td data-l="Állapot">${u.status}</td><td class="num" data-l="Sorok">${u.rows}</td><td class="num" data-l="Új">${u.new_n ?? 0}</td>
<td class="num" data-l="Összevonva">${u.merged_n ?? 0}</td><td class="num" data-l="Ellenőrzésre">${u.review_n ?? 0}</td></tr>`)}</tbody></table></div>`
  : html`<p class="muted">Még nem volt feltöltés. Próbáld ki a <code>mintaadatok/</code> mappa kitalált listáival.</p>`}`);
}

async function upload(ctx) {
  const f = await ctx.form();
  const file = f.get("file");
  if (!file || typeof file === "string" || !file.size) return ctx.redirect("/feltoltes", { hiba: "Válassz ki egy fájlt." });
  if (/\.xlsx?$/i.test(file.name)) return ctx.redirect("/feltoltes", { hiba: "Excel-fájlt előbb ments CSV-be (Fájl → Mentés másként → CSV UTF-8)." });
  const rows = parseCsv(decodeText(new Uint8Array(await file.arrayBuffer())));
  if (rows.length < 2) return ctx.redirect("/feltoltes", { hiba: "A fájlban nincs fejléc + adatsor." });
  if (rows.length - 1 > MAX_ROWS) return ctx.redirect("/feltoltes", { hiba: `Túl sok sor (legfeljebb ${MAX_ROWS}).` });
  const [headers, ...data] = rows;
  const res = await ctx.db.prepare("INSERT INTO upload (filename, headers, created_by) VALUES (?, ?, ?)")
    .bind(file.name, JSON.stringify(headers.map((h) => h.trim())), ctx.user).run();
  const uploadId = res.meta.last_row_id;
  const stmts = data.map((row, i) => ctx.db.prepare("INSERT INTO source_record (upload_id, row_no, raw) VALUES (?, ?, ?)")
    .bind(uploadId, i + 2, JSON.stringify(row)));
  for (let i = 0; i < stmts.length; i += 100) await ctx.db.batch(stmts.slice(i, i + 100));
  return ctx.redirect(`/feltoltes/${uploadId}`);
}

async function show(ctx) {
  const u = await ctx.db.prepare("SELECT * FROM upload WHERE id = ?").bind(ctx.params.id).first();
  if (!u) return ctx.redirect("/feltoltes", { hiba: "Nincs ilyen feltöltés." });
  const headers = JSON.parse(u.headers);
  if (!u.mapping) {
    const memory = await ctx.db.prepare("SELECT mapping FROM mapping_memory WHERE header_signature = ?").bind(headerSignature(headers)).first("mapping");
    const mapping = memory ? JSON.parse(memory) : headers.map(guessField);
    const { results: sample } = await ctx.db.prepare("SELECT raw FROM source_record WHERE upload_id = ? ORDER BY row_no LIMIT 5").bind(u.id).all();
    const rows = sample.map((s) => JSON.parse(s.raw));
    return ctx.page("Oszlopok párosítása", html`<h1>Oszlopok párosítása – ${u.filename}</h1>
<p class="muted">${memory ? "Ezt a fejlécet már ismerjük: a korábbi párosítást ajánljuk fel." : "Add meg, melyik oszlop mit tartalmaz. A párosítást megjegyezzük a hasonló fájlokhoz."}</p>
<form method="post" class="card">
<div class="table-wrap"><table>
<thead><tr><th>Oszlop a fájlban</th><th>Mező</th><th>Minta</th></tr></thead>
<tbody>${headers.map((h, i) => html`<tr><td><strong>${h}</strong></td>
<td><select name="col${i}">${options(FIELDS, mapping[i] ?? "")}</select></td>
<td class="muted">${rows.map((r) => r[i]).filter(Boolean).slice(0, 3).join(" · ")}</td></tr>`)}</tbody></table></div>
<p><button>Feldolgozás: egységesítés, besorolás, összefésülés</button></p>
</form>`);
  }

  const { results: recs } = await ctx.db.prepare(
    "SELECT s.*, c.name AS contact_name FROM source_record s LEFT JOIN contact c ON c.id = s.contact_id WHERE upload_id = ? ORDER BY row_no",
  ).bind(u.id).all();
  const count = (st) => recs.filter((r) => r.status === st).length;
  return ctx.page(u.filename, html`<h1>Feltöltés: ${u.filename}</h1>
<div class="grid">
  <div class="card brand"><div class="muted">Új kontakt</div><div class="big">${count("új")}</div></div>
  <div class="card brand"><div class="muted">Biztos egyezés, összevonva</div><div class="big">${count("összevonva")}</div></div>
  <div class="card brand"><div class="muted">Ellenőrzésre vár</div><div class="big">${count("ellenőrzésre vár")}</div>
    ${count("ellenőrzésre vár") ? html`<a class="btn small" href="/ellenorzes">Ellenőrzés</a>` : ""}</div>
  <div class="card brand"><div class="muted">Kihagyva / üres sor</div><div class="big">${count("kihagyva") + count("üres")}</div></div>
</div>
<h2>Sorok</h2>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Sor</th><th>Egységesített adat</th><th>Javasolt címkék</th><th>Eredmény</th></tr></thead>
<tbody>${recs.map((r) => html`<tr><td data-l="Sor">${r.row_no}.</td>
<td data-l="Adat">${r.name} <span class="muted">${[r.email, formatPhone(r.phone), r.org].filter(Boolean).join(" · ")}</span></td>
<td data-l="Címkék">${normalizeTags(r.suggested_tags).map((t) => html`<span class="tag">${t}</span>`)}</td>
<td data-l="Eredmény">${r.status}${r.contact_id ? html` → <a href="/kontaktok/${r.contact_id}">${r.contact_name}</a>` : ""}</td></tr>`)}
</tbody></table></div>`);
}

async function process(ctx) {
  const u = await ctx.db.prepare("SELECT * FROM upload WHERE id = ?").bind(ctx.params.id).first();
  if (!u) return ctx.redirect("/feltoltes", { hiba: "Nincs ilyen feltöltés." });
  if (u.mapping) return ctx.redirect(`/feltoltes/${u.id}`, { hiba: "Ez a feltöltés már fel van dolgozva." });
  const headers = JSON.parse(u.headers);
  const f = await ctx.form();
  const valid = new Set(FIELDS.map(([v]) => v));
  const mapping = headers.map((_, i) => (valid.has(f.get(`col${i}`)) ? f.get(`col${i}`) : ""));
  if (!mapping.some((m) => ["name", "last_name", "first_name", "email", "phone"].includes(m))) {
    return ctx.redirect(`/feltoltes/${u.id}`, { hiba: "Legalább a név, az e-mail vagy a telefon oszlopát párosítsd." });
  }
  await ctx.db.prepare(
    `INSERT INTO mapping_memory (header_signature, mapping) VALUES (?, ?)
     ON CONFLICT (header_signature) DO UPDATE SET mapping = excluded.mapping, updated_at = datetime('now')`,
  ).bind(headerSignature(headers), JSON.stringify(mapping)).run();
  const stats = await processUpload(ctx.db, u.id, mapping, ctx.user);
  return ctx.redirect(`/feltoltes/${u.id}`, {
    ok: `Kész: ${stats["új"]} új, ${stats["összevonva"]} összevonva, ${stats["ellenőrzésre vár"]} ellenőrzésre vár.`,
  });
}

const FIELD_ROWS = [["Név", "name"], ["E-mail", "email"], ["Telefon", "phone"], ["Szervezet", "org"], ["Címkék", "tags"]];

async function reviewPage(ctx) {
  const item = await ctx.db.prepare(
    `SELECT r.id, r.reason, s.name, s.email, s.phone, s.org, s.suggested_tags AS tags, s.row_no, u.filename,
       c.id AS cid, c.name AS cname, c.email AS cemail, c.phone AS cphone, c.org AS corg, c.tags AS ctags
     FROM review_item r JOIN source_record s ON s.id = r.source_record_id JOIN upload u ON u.id = s.upload_id
     JOIN contact c ON c.id = r.contact_id WHERE r.status = 'nyitott' ORDER BY r.id LIMIT 1`,
  ).first();
  const left = await ctx.db.prepare("SELECT COUNT(*) AS n FROM review_item WHERE status = 'nyitott'").first("n");
  if (!item) {
    return ctx.page("Ellenőrzés", html`<h1>Bizonytalan egyezések</h1><p class="card">Nincs ellenőrzésre váró pár. ✔</p>
<p><a class="btn secondary" href="/kontaktok">Mesterlista</a></p>`);
  }
  const fmt = (k, v) => (k === "phone" ? formatPhone(v) : k === "tags" ? normalizeTags(v).join(", ") : v);
  const side = (prefix) => FIELD_ROWS.map(([label, k]) => {
    const a = item[k] ?? "";
    const b = item["c" + k] ?? "";
    const v = prefix === "" ? a : b;
    const differs = k !== "tags" && a && b && String(a).toLowerCase() !== String(b).toLowerCase();
    return html`<dt>${label}</dt><dd class="${differs ? "diff" : ""}">${fmt(k, v) || "–"}</dd>`;
  });
  return ctx.page("Ellenőrzés", html`<h1>Bizonytalan egyezés <span class="muted">(még ${left} pár)</span></h1>
<p>Ok: <strong>${item.reason}</strong>. Ugyanaz az ember?</p>
<div class="pair">
  <div class="card"><h2 style="margin-top:0">Új sor <span class="muted">${item.filename}, ${item.row_no}. sor</span></h2><dl>${side("")}</dl></div>
  <div class="card"><h2 style="margin-top:0">Meglévő kontakt <a class="muted" href="/kontaktok/${item.cid}">#${item.cid}</a></h2><dl>${side("c")}</dl></div>
</div>
<form method="post" action="/ellenorzes/${item.id}" class="actions">
  <button name="dontes" value="ugyanaz" class="accent">Ugyanaz az ember</button>
  <button name="dontes" value="külön" class="secondary">Két külön ember</button>
  <button name="dontes" value="kihagy" class="secondary">Kihagyom</button>
</form>
<p class="muted">A döntést megjegyezzük: ugyanezt a párt egy későbbi feltöltésnél nem kérdezzük újra.</p>`);
}

async function decide(ctx) {
  const f = await ctx.form();
  const d = f.get("dontes");
  if (!["ugyanaz", "külön", "kihagy"].includes(d)) return ctx.redirect("/ellenorzes", { hiba: "Ismeretlen döntés." });
  const ok = await decideReview(ctx.db, Number(ctx.params.id), d, ctx.user);
  return ctx.redirect("/ellenorzes", ok ? { ok: `Rögzítve: ${d}.` } : { hiba: "Ezt a párt már eldöntötték." });
}

export const routes = [
  ["GET", "/feltoltes", uploadPage],
  ["POST", "/feltoltes", upload],
  ["GET", "/feltoltes/:id", show],
  ["POST", "/feltoltes/:id", process],
  ["GET", "/ellenorzes", reviewPage],
  ["POST", "/ellenorzes/:id", decide],
];
