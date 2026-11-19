import { html, options } from "../lib/html.js";
import { KNOWN_TAGS } from "../lib/classify.js";
import { formatPhone, nameKey, normalizeRecord, normalizeTags } from "../lib/normalize.js";
import { findMatch } from "../lib/match.js";
import { createContact, loadDecisions, loadIndex } from "../services/contacts.js";

const tagChips = (tags) => normalizeTags(tags).map((t) => html`<span class="tag">${t}</span>`);

async function list(ctx) {
  const q = (ctx.url.searchParams.get("q") ?? "").trim();
  const tag = ctx.url.searchParams.get("cimke") ?? "";
  const where = [];
  const args = [];
  if (q) {
    where.push("(name LIKE ? OR name_key LIKE ? OR email LIKE ? OR org LIKE ? OR phone LIKE ?)");
    const like = `%${q}%`;
    args.push(like, `%${nameKey(q)}%`, like, like, `%${q.replace(/\D/g, "") || q}%`);
  }
  if (tag) { where.push("(',' || tags || ',') LIKE ?"); args.push(`%,${tag},%`); }
  const { results } = await ctx.db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM source_record s WHERE s.contact_id = c.id) AS sources
     FROM contact c ${where.length ? "WHERE " + where.join(" AND ") : ""} LIMIT 1000`,
  ).bind(...args).all();
  results.sort((a, b) => a.name.localeCompare(b.name, "hu"));
  const total = await ctx.db.prepare("SELECT COUNT(*) AS n FROM contact").first("n");

  return ctx.page("Kontaktok", html`
<h1>Kontaktok – mesterlista</h1>
<form class="search" method="get">
  <input name="q" value="${q}" placeholder="Keresés: név, e-mail, szervezet, telefon">
  <select name="cimke"><option value="">minden címke</option>${options(KNOWN_TAGS.map((t) => [t, t]), tag)}</select>
  <button>Keresés</button>
  <a class="btn secondary" href="/kontaktok/uj">Új kontakt</a>
</form>
<p class="muted">${results.length} találat / összesen ${total} kontakt.</p>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Név</th><th>E-mail</th><th>Telefon</th><th>Szervezet</th><th>Címkék</th><th class="num">Források</th></tr></thead>
<tbody>${results.map((c) => html`<tr>
  <td data-l="Név"><a href="/kontaktok/${c.id}">${c.name}</a>${c.consent_newsletter ? html` <span class="tag" title="hírlevél-hozzájárulás">✉</span>` : ""}</td>
  <td data-l="E-mail">${c.email}</td><td data-l="Telefon" style="white-space:nowrap">${formatPhone(c.phone)}</td>
  <td data-l="Szervezet">${c.org}</td><td data-l="Címkék">${tagChips(c.tags)}</td>
  <td class="num" data-l="Források">${c.sources}</td></tr>`)}</tbody></table></div>`);
}

function contactForm(c = {}, action, button) {
  return html`<form class="stack card" method="post" action="${action}">
  <label>Név<input name="name" required value="${c.name ?? ""}"></label>
  <label>E-mail<input name="email" type="email" value="${c.email ?? ""}"></label>
  <label>Telefon<input name="phone" type="tel" value="${formatPhone(c.phone ?? "")}"></label>
  <label>Szervezet<input name="org" value="${c.org ?? ""}"></label>
  <label>Címkék (vesszővel: ${KNOWN_TAGS.join(", ")})<input name="tags" value="${normalizeTags(c.tags).join(", ")}"></label>
  <label class="check"><input type="checkbox" name="consent" value="1"${c.consent_newsletter ? " checked" : ""}> Hírlevélhez hozzájárult</label>
  <label>Megjegyzés<textarea name="note" rows="2">${c.note ?? ""}</textarea></label>
  ${button}
</form>`;
}

async function newForm(ctx) {
  return ctx.page("Új kontakt", html`<h1>Új kontakt</h1>
<p class="muted">Új kontakt csak itt vehető fel – ugyanaz a duplikátumszűrés fut le, mint feltöltéskor.</p>
${contactForm({}, "/kontaktok/uj", html`<button>Mentés</button>`)}`);
}

async function create(ctx) {
  const f = await ctx.form();
  const rec = normalizeRecord({ name: f.get("name"), email: f.get("email"), phone: f.get("phone"), org: f.get("org"), tags: f.get("tags"), note: f.get("note") });
  if (!rec.name) return ctx.redirect("/kontaktok/uj", { hiba: "A név kötelező." });
  if (f.get("consent")) rec.consent_date = ctx.today;
  const match = findMatch(rec, await loadIndex(ctx.db), await loadDecisions(ctx.db));
  if (match.kind === "biztos") {
    return ctx.redirect(`/kontaktok/${match.contactId}`, { hiba: `Már létezik ilyen kontakt (${match.reason}) – nem hoztunk létre újat.` });
  }
  if (match.kind === "bizonytalan" && !f.get("megis")) {
    const other = await ctx.db.prepare("SELECT * FROM contact WHERE id = ?").bind(match.contactId).first();
    return ctx.page("Új kontakt", html`<h1>Új kontakt</h1>
<div class="flash err">Hasonló kontakt már van: <a href="/kontaktok/${other.id}">${other.name}</a> (${other.email || "nincs e-mail"}, ${other.org || "nincs szervezet"}) – ${match.reason}.</div>
${contactForm({ ...rec, tags: rec.tags.join(","), consent_newsletter: f.get("consent") }, "/kontaktok/uj",
  html`<input type="hidden" name="megis" value="1"><div class="actions"><button>Mégis új kontaktként mentem</button><a class="btn secondary" href="/kontaktok/${other.id}">A meglévőt nyitom meg</a></div>`)}`);
  }
  const id = await createContact(ctx.db, rec, ctx.user, "kézi felvétel");
  return ctx.redirect(`/kontaktok/${id}`, { ok: "Kontakt létrehozva." });
}

async function show(ctx) {
  const c = await ctx.db.prepare("SELECT * FROM contact WHERE id = ?").bind(ctx.params.id).first();
  if (!c) return ctx.redirect("/kontaktok", { hiba: "Nincs ilyen kontakt." });
  const { results: ids } = await ctx.db.prepare("SELECT kind, value FROM contact_identifier WHERE contact_id = ? ORDER BY kind, value").bind(c.id).all();
  const { results: sources } = await ctx.db.prepare(
    `SELECT s.*, u.filename, u.created_at AS uploaded FROM source_record s JOIN upload u ON u.id = s.upload_id
     WHERE s.contact_id = ? ORDER BY s.id`,
  ).bind(c.id).all();
  const member = await ctx.db.prepare("SELECT id, member_code FROM member WHERE contact_id = ?").bind(c.id).first();

  return ctx.page(c.name, html`<h1>${c.name}</h1>
<div class="grid">
<div>${contactForm(c, `/kontaktok/${c.id}`, html`<button>Mentés</button>`)}</div>
<div>
  <div class="card"><h2 style="margin-top:0">Összes ismert elérhetőség</h2>
    ${ids.length ? html`<ul>${ids.map((i) => html`<li>${i.kind === "email" ? "e-mail" : "telefon"}: ${i.kind === "phone" ? formatPhone(i.value) : i.value}</li>`)}</ul>` : html`<p class="muted">Nincs.</p>`}
    <p class="muted">Hírlevél-hozzájárulás: ${c.consent_newsletter ? `igen (${c.consent_date ?? "?"}, forrás: ${c.consent_source ?? "?"})` : "nincs"}</p>
    <p class="muted">Módosítva: ${c.updated_at} – ${c.updated_by}</p>
    ${member ? html`<p>Tag: <a href="/tagok/${member.id}">${member.member_code}</a></p>`
      : html`<p><a class="btn small secondary" href="/tagok/uj?kontakt=${c.id}">Taggá teszem</a></p>`}
  </div>
  <div class="card"><h2 style="margin-top:0">Források (honnan jött az adat)</h2>
    ${sources.length ? html`<ul>${sources.map((s) => html`<li><a href="/feltoltes/${s.upload_id}">${s.filename}</a>, ${s.row_no}. sor – ${s.status}</li>`)}</ul>` : html`<p class="muted">Kézzel felvett vagy tagként rögzített kontakt.</p>`}
  </div>
</div></div>`);
}

async function update(ctx) {
  const f = await ctx.form();
  const c = await ctx.db.prepare("SELECT * FROM contact WHERE id = ?").bind(ctx.params.id).first();
  if (!c) return ctx.redirect("/kontaktok", { hiba: "Nincs ilyen kontakt." });
  const rec = normalizeRecord({ name: f.get("name"), email: f.get("email"), phone: f.get("phone"), org: f.get("org"), tags: f.get("tags"), note: f.get("note") });
  if (!rec.name) return ctx.redirect(`/kontaktok/${c.id}`, { hiba: "A név kötelező." });
  const consent = f.get("consent") ? 1 : 0;
  const stmts = [ctx.db.prepare(
    `UPDATE contact SET name = ?, name_key = ?, email = ?, phone = ?, org = ?, tags = ?, note = ?, consent_newsletter = ?,
     consent_date = ?, consent_source = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`,
  ).bind(rec.name, nameKey(rec.name), rec.email || null, rec.phone || null, rec.org || null, rec.tags.join(","), rec.note || null,
    consent, consent ? (c.consent_date ?? ctx.today) : null, consent ? (c.consent_source ?? "kézi rögzítés") : null, ctx.user, c.id)];
  if (rec.email) stmts.push(ctx.db.prepare("INSERT OR IGNORE INTO contact_identifier (contact_id, kind, value) VALUES (?, 'email', ?)").bind(c.id, rec.email));
  if (rec.phone) stmts.push(ctx.db.prepare("INSERT OR IGNORE INTO contact_identifier (contact_id, kind, value) VALUES (?, 'phone', ?)").bind(c.id, rec.phone));
  await ctx.db.batch(stmts);
  return ctx.redirect(`/kontaktok/${c.id}`, { ok: "Mentve." });
}

export const routes = [
  ["GET", "/kontaktok", list],
  ["GET", "/kontaktok/uj", newForm],
  ["POST", "/kontaktok/uj", create],
  ["GET", "/kontaktok/:id", show],
  ["POST", "/kontaktok/:id", update],
];
