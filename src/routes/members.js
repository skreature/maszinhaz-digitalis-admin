import { html, money, options } from "../lib/html.js";
import { nextPeriod, periodLabel, periodOf } from "../lib/dates.js";
import { transferReference } from "../lib/dues.js";
import { formatPhone, nameKey, normalizeRecord } from "../lib/normalize.js";
import { findMatch } from "../lib/match.js";
import { createContact, loadDecisions, loadIndex } from "../services/contacts.js";
import { debtors, ensureCharges, memberBalance, nextMemberCode, recomputeStatuses } from "../services/members.js";

const STATUSES = [["aktív", "aktív"], ["szünetel", "szünetel"], ["kilépett", "kilépett"]];
const METHODS = [["készpénz", "készpénz"], ["átutalás", "átutalás"], ["egyéb", "egyéb"]];

async function plans(ctx) {
  const { results } = await ctx.db.prepare("SELECT id, name, amount FROM fee_plan WHERE active = 1 ORDER BY name").all();
  return [["", "– nincs –"], ...results.map((p) => [p.id, `${p.name} (${money(p.amount)}/hó)`])];
}

async function list(ctx) {
  const q = (ctx.url.searchParams.get("q") ?? "").trim();
  const { results } = await ctx.db.prepare(
    `SELECT m.*, c.name, c.email, c.phone, p.name AS plan FROM member m JOIN contact c ON c.id = m.contact_id
     LEFT JOIN fee_plan p ON p.id = m.fee_plan_id
     WHERE (? = '' OR c.name LIKE ? OR c.name_key LIKE ? OR m.member_code LIKE ? OR m.group_name LIKE ?)
`,
  ).bind(q, `%${q}%`, `%${nameKey(q)}%`, `%${q}%`, `%${q}%`).all();
  results.sort((a, b) => a.name.localeCompare(b.name, "hu"));
  const owed = new Map((await debtors(ctx.db, ctx.today)).map((d) => [d.member_id, d.owed]));
  const period = periodOf(ctx.today);
  return ctx.page("Tagok", html`<h1>Tagok</h1>
<form class="search" method="get">
  <input name="q" value="${q}" placeholder="Keresés: név, tagkód, csoport">
  <button>Keresés</button>
  <a class="btn secondary" href="/tagok/uj">Új tag</a>
</form>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Név</th><th>Tagkód</th><th>Csoport</th><th>Fizetési terv</th><th>Állapot</th><th class="num">Tartozás</th></tr></thead>
<tbody>${results.map((m) => html`<tr>
<td data-l="Név"><a href="/tagok/${m.id}">${m.name}</a></td><td data-l="Tagkód">${m.member_code}</td>
<td data-l="Csoport">${m.group_name}</td><td data-l="Terv">${m.plan ?? "–"}</td><td data-l="Állapot">${m.status}</td>
<td class="num" data-l="Tartozás">${owed.get(m.id) ? html`<span class="status-nyitott">${money(owed.get(m.id))}</span>` : "–"}</td></tr>`)}
</tbody></table></div>
<form method="post" action="/esedekessegek" class="actions card" style="margin-top:1rem">
  <span class="muted">Az esedékességek minden hónapban automatikusan létrejönnek. Előre is legenerálhatod a következő hónapot:</span>
  <input type="hidden" name="ig" value="${nextPeriod(period)}">
  <button class="secondary small">Esedékességek generálása ${periodLabel(nextPeriod(period))} végéig</button>
</form>`);
}

async function generate(ctx) {
  const f = await ctx.form();
  const upTo = /^\d{4}-\d{2}$/.test(f.get("ig") ?? "") ? f.get("ig") : periodOf(ctx.today);
  const n = await ensureCharges(ctx.db, upTo);
  return ctx.redirect("/tagok", { ok: `${n} új esedékesség jött létre (${periodLabel(upTo)} végéig).` });
}

function memberFields(m, planOpts, today) {
  return html`
  <label>Csoport<input name="group_name" value="${m.group_name ?? ""}" placeholder="pl. felnőtt, ifjúsági"></label>
  <label>Belépés dátuma<input name="joined_on" type="date" required value="${m.joined_on ?? today}"></label>
  <label>Fizetési terv<select name="fee_plan_id">${options(planOpts, m.fee_plan_id)}</select></label>
  <label>Állapot<select name="status">${options(STATUSES, m.status ?? "aktív")}</select></label>`;
}

async function newForm(ctx) {
  const contactId = ctx.url.searchParams.get("kontakt");
  const contact = contactId ? await ctx.db.prepare("SELECT * FROM contact WHERE id = ?").bind(contactId).first() : null;
  return ctx.page("Új tag", html`<h1>Új tag</h1>
<form class="stack card" method="post" action="/tagok/uj">
  ${contact ? html`<input type="hidden" name="contact_id" value="${contact.id}"><p>Kontakt: <strong>${contact.name}</strong> ${contact.email}</p>`
    : html`<label>Név<input name="name" required></label><label>E-mail<input name="email" type="email"></label><label>Telefon<input name="phone" type="tel"></label>`}
  ${memberFields({}, await plans(ctx), ctx.today)}
  <button>Mentés</button>
</form>`);
}

async function create(ctx) {
  const f = await ctx.form();
  let contactId = Number(f.get("contact_id")) || null;
  if (!contactId) {
    const rec = normalizeRecord({ name: f.get("name"), email: f.get("email"), phone: f.get("phone") });
    if (!rec.name) return ctx.redirect("/tagok/uj", { hiba: "A név kötelező." });
    const match = findMatch(rec, await loadIndex(ctx.db), await loadDecisions(ctx.db));
    // Biztos egyezésnél a meglévő kontaktot tesszük taggá, nem hozunk létre duplikátumot.
    contactId = match.kind === "biztos" ? match.contactId : await createContact(ctx.db, rec, ctx.user, "tagfelvétel");
  }
  const existing = await ctx.db.prepare("SELECT id FROM member WHERE contact_id = ?").bind(contactId).first("id");
  if (existing) return ctx.redirect(`/tagok/${existing}`, { hiba: "Ez a személy már tag." });
  const res = await ctx.db.prepare(
    "INSERT INTO member (contact_id, member_code, group_name, joined_on, status, fee_plan_id, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(contactId, await nextMemberCode(ctx.db), f.get("group_name") || null, f.get("joined_on") || ctx.today,
    f.get("status") || "aktív", Number(f.get("fee_plan_id")) || null, ctx.user).run();
  await ctx.db.prepare(
    "UPDATE contact SET tags = CASE WHEN (',' || tags || ',') LIKE '%,tag,%' THEN tags WHEN tags = '' THEN 'tag' ELSE tags || ',tag' END WHERE id = ?",
  ).bind(contactId).run();
  await ensureCharges(ctx.db, periodOf(ctx.today));
  return ctx.redirect(`/tagok/${res.meta.last_row_id}`, { ok: "Tag felvéve." });
}

async function show(ctx) {
  const m = await ctx.db.prepare(
    `SELECT m.*, c.name, c.email, c.phone, p.name AS plan, p.amount AS plan_amount FROM member m
     JOIN contact c ON c.id = m.contact_id LEFT JOIN fee_plan p ON p.id = m.fee_plan_id WHERE m.id = ?`,
  ).bind(ctx.params.id).first();
  if (!m) return ctx.redirect("/tagok", { hiba: "Nincs ilyen tag." });
  const { results: charges } = await ctx.db.prepare("SELECT * FROM charge WHERE member_id = ? ORDER BY period DESC").bind(m.id).all();
  const { results: payments } = await ctx.db.prepare("SELECT * FROM payment WHERE member_id = ? ORDER BY paid_on DESC, id DESC").bind(m.id).all();
  const balance = await memberBalance(ctx.db, m.id, ctx.today);
  const period = periodOf(ctx.today);

  return ctx.page(m.name, html`<h1>${m.name} <span class="muted">${m.member_code}</span></h1>
<div class="grid">
  <div class="card brand">
    <div class="muted">${balance > 0 ? "Tartozás" : balance < 0 ? "Előre befizetve" : "Egyenleg"}</div>
    <div class="big ${balance > 0 ? "status-nyitott" : "status-fizetve"}">${money(Math.abs(balance))}</div>
    <p class="muted">Átutalási közlemény: <strong>${transferReference(m.member_code, period)}</strong></p>
    <a class="btn accent" href="/befizetes?tag=${m.id}">Befizetés rögzítése</a>
  </div>
  <div class="card">
    <p><a href="/kontaktok/${m.contact_id}">Kontakt adatlap</a><br>${m.email}<br>${formatPhone(m.phone)}</p>
    <p class="muted">Fizetési terv: ${m.plan ? `${m.plan}, ${money(m.plan_amount)}/hó` : "nincs"}</p>
  </div>
</div>

<h2>Esedékességek</h2>
${charges.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Hónap</th><th>Határidő</th><th class="num">Összeg</th><th>Állapot</th><th></th></tr></thead>
<tbody>${charges.map((c) => html`<tr><td data-l="Hónap">${periodLabel(c.period)}</td><td data-l="Határidő">${c.due_date}</td>
<td class="num" data-l="Összeg">${money(c.amount)}</td><td data-l="Állapot"><span class="status-${c.status}">${c.status}</span></td>
<td><form method="post" action="/esedekesseg/${c.id}/elengedes"><button class="secondary small">${c.status === "elengedve" ? "Visszavonás" : "Elengedés"}</button></form></td></tr>`)}
</tbody></table></div>` : html`<p class="muted">Nincs esedékesség (nincs fizetési terv, vagy még nem lépett be).</p>`}

<h2>Befizetések</h2>
${payments.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Dátum</th><th class="num">Összeg</th><th>Mód</th><th>Időszak</th><th>Megjegyzés</th><th>Rögzítette</th></tr></thead>
<tbody>${payments.map((p) => html`<tr><td data-l="Dátum">${p.paid_on}</td><td class="num" data-l="Összeg">${money(p.amount)}</td>
<td data-l="Mód">${p.method}</td><td data-l="Időszak">${p.period ? periodLabel(p.period) : "–"}</td><td data-l="Megjegyzés">${p.note}</td>
<td data-l="Rögzítette">${p.recorded_by}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Még nincs befizetés.</p>`}

<h2>Tagsági adatok</h2>
<form class="stack card" method="post" action="/tagok/${m.id}">
  ${memberFields(m, await plans(ctx), ctx.today)}
  <button>Mentés</button>
</form>
<p class="muted">Módosítva: ${m.updated_at} – ${m.updated_by}</p>`);
}

async function update(ctx) {
  const f = await ctx.form();
  await ctx.db.prepare(
    `UPDATE member SET group_name = ?, joined_on = ?, fee_plan_id = ?, status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`,
  ).bind(f.get("group_name") || null, f.get("joined_on"), Number(f.get("fee_plan_id")) || null, f.get("status") || "aktív",
    ctx.user, ctx.params.id).run();
  await ensureCharges(ctx.db, periodOf(ctx.today));
  return ctx.redirect(`/tagok/${ctx.params.id}`, { ok: "Mentve." });
}

async function toggleWaive(ctx) {
  const c = await ctx.db.prepare("SELECT * FROM charge WHERE id = ?").bind(ctx.params.id).first();
  if (!c) return ctx.redirect("/tagok", { hiba: "Nincs ilyen esedékesség." });
  await ctx.db.prepare("UPDATE charge SET status = ? WHERE id = ?").bind(c.status === "elengedve" ? "nyitott" : "elengedve", c.id).run();
  await recomputeStatuses(ctx.db, c.member_id);
  return ctx.redirect(`/tagok/${c.member_id}`, { ok: c.status === "elengedve" ? "Elengedés visszavonva." : "Esedékesség elengedve." });
}

async function paymentForm(ctx) {
  const selected = ctx.url.searchParams.get("tag") ?? "";
  const { results: members } = await ctx.db.prepare(
    "SELECT m.id, m.member_code, c.name FROM member m JOIN contact c ON c.id = m.contact_id WHERE m.status != 'kilépett'",
  ).all();
  members.sort((a, b) => a.name.localeCompare(b.name, "hu"));
  const owed = selected ? await memberBalance(ctx.db, selected, ctx.today) : 0;
  const period = periodOf(ctx.today);
  return ctx.page("Befizetés", html`<h1>Befizetés rögzítése</h1>
<form class="stack card" method="post" action="/befizetes">
  <label>Tag<select name="member_id" required>${options([["", "– válassz –"], ...members.map((m) => [m.id, `${m.name} (${m.member_code})`])], selected)}</select></label>
  <label>Összeg (Ft)<input name="amount" type="number" inputmode="numeric" min="1" step="1" required value="${owed > 0 ? owed : ""}"></label>
  <label>Mód<select name="method">${options(METHODS, "készpénz")}</select></label>
  <label>Dátum<input name="paid_on" type="date" required value="${ctx.today}"></label>
  <label>Melyik hónapra<input name="period" type="month" value="${period}"></label>
  <label>Megjegyzés<input name="note"></label>
  <button>Rögzítés</button>
</form>
<p class="muted">Csak nyilvántartás: a rendszer nem kezel bankkártyát és nem kapcsolódik bankhoz. A befizetés a legrégebbi nyitott hónapot egyenlíti ki először.</p>`);
}

async function recordPayment(ctx) {
  const f = await ctx.form();
  const memberId = Number(f.get("member_id"));
  const amount = Math.round(Number(f.get("amount")));
  const method = METHODS.some(([v]) => v === f.get("method")) ? f.get("method") : "egyéb";
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(f.get("paid_on") ?? "") ? f.get("paid_on") : ctx.today;
  if (!memberId || !(amount > 0)) return ctx.redirect(`/befizetes?tag=${memberId || ""}`, { hiba: "Válassz tagot és adj meg pozitív összeget." });
  const exists = await ctx.db.prepare("SELECT id FROM member WHERE id = ?").bind(memberId).first("id");
  if (!exists) return ctx.redirect("/befizetes", { hiba: "Nincs ilyen tag." });
  await ctx.db.prepare(
    "INSERT INTO payment (member_id, amount, paid_on, method, period, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(memberId, amount, paidOn, method, /^\d{4}-\d{2}$/.test(f.get("period") ?? "") ? f.get("period") : null,
    f.get("note") || null, ctx.user).run();
  await recomputeStatuses(ctx.db, memberId);
  return ctx.redirect(`/tagok/${memberId}`, { ok: `${money(amount)} befizetés rögzítve (${method}).` });
}

export const routes = [
  ["GET", "/tagok", list],
  ["GET", "/tagok/uj", newForm],
  ["POST", "/tagok/uj", create],
  ["GET", "/tagok/:id", show],
  ["POST", "/tagok/:id", update],
  ["POST", "/esedekessegek", generate],
  ["POST", "/esedekesseg/:id/elengedes", toggleWaive],
  ["GET", "/befizetes", paymentForm],
  ["POST", "/befizetes", recordPayment],
];
