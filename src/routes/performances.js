import { html, money, options } from "../lib/html.js";

async function list(ctx) {
  const { results } = await ctx.db.prepare(
    `SELECT p.*, COALESCE(SUM(s.quantity), 0) AS sold, COALESCE(SUM(s.amount), 0) AS revenue
     FROM performance p LEFT JOIN ticket_type t ON t.performance_id = p.id LEFT JOIN ticket_sale s ON s.ticket_type_id = t.id
     GROUP BY p.id ORDER BY p.starts_at DESC`,
  ).all();
  return ctx.page("Előadások", html`<h1>Előadások</h1>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Időpont</th><th>Cím</th><th>Helyszín</th><th class="num">Eladott jegy</th><th class="num">Bevétel</th></tr></thead>
<tbody>${results.map((p) => html`<tr><td data-l="Időpont">${p.starts_at.replace("T", " ")}${p.starts_at >= ctx.today ? "" : html` <span class="muted">(lezajlott)</span>`}</td>
<td data-l="Cím"><a href="/eloadasok/${p.id}">${p.title}</a></td><td data-l="Helyszín">${p.venue}</td>
<td class="num" data-l="Eladott">${p.sold} db</td><td class="num" data-l="Bevétel">${money(p.revenue)}</td></tr>`)}</tbody></table></div>
<h2>Új előadás</h2>
<form class="stack card" method="post" action="/eloadasok">
  <label>Cím<input name="title" required></label>
  <label>Időpont<input name="starts_at" type="datetime-local" required></label>
  <label>Helyszín<input name="venue"></label>
  <label>Megjegyzés<input name="note"></label>
  <button>Mentés</button>
</form>`);
}

async function create(ctx) {
  const f = await ctx.form();
  if (!f.get("title") || !f.get("starts_at")) return ctx.redirect("/eloadasok", { hiba: "A cím és az időpont kötelező." });
  const res = await ctx.db.prepare("INSERT INTO performance (title, starts_at, venue, note, updated_by) VALUES (?, ?, ?, ?, ?)")
    .bind(f.get("title"), f.get("starts_at"), f.get("venue") || null, f.get("note") || null, ctx.user).run();
  return ctx.redirect(`/eloadasok/${res.meta.last_row_id}`, { ok: "Előadás létrehozva. Add meg a jegytípusokat." });
}

async function show(ctx) {
  const p = await ctx.db.prepare("SELECT * FROM performance WHERE id = ?").bind(ctx.params.id).first();
  if (!p) return ctx.redirect("/eloadasok", { hiba: "Nincs ilyen előadás." });
  const { results: types } = await ctx.db.prepare(
    `SELECT t.*, COALESCE(SUM(s.quantity), 0) AS sold, COALESCE(SUM(s.amount), 0) AS revenue
     FROM ticket_type t LEFT JOIN ticket_sale s ON s.ticket_type_id = t.id WHERE t.performance_id = ? GROUP BY t.id ORDER BY t.price DESC`,
  ).bind(p.id).all();
  const { results: sales } = await ctx.db.prepare(
    `SELECT s.*, t.name FROM ticket_sale s JOIN ticket_type t ON t.id = s.ticket_type_id WHERE t.performance_id = ? ORDER BY s.sold_on DESC, s.id DESC`,
  ).bind(p.id).all();
  const sold = types.reduce((s, t) => s + t.sold, 0);
  const revenue = types.reduce((s, t) => s + t.revenue, 0);

  return ctx.page(p.title, html`<h1>${p.title}</h1>
<p class="muted">${p.starts_at.replace("T", " ")} · ${p.venue} ${p.note ? html`· ${p.note}` : ""}</p>
<div class="grid">
  <div class="card"><div class="muted">Eladott jegy</div><div class="big">${sold} db</div></div>
  <div class="card"><div class="muted">Bevétel</div><div class="big">${money(revenue)}</div></div>
</div>
<h2>Jegytípusok</h2>
${types.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Jegytípus</th><th class="num">Ár</th><th class="num">Eladva</th><th class="num">Bevétel</th></tr></thead>
<tbody>${types.map((t) => html`<tr><td data-l="Típus">${t.name}</td><td class="num" data-l="Ár">${money(t.price)}</td>
<td class="num" data-l="Eladva">${t.sold} db</td><td class="num" data-l="Bevétel">${money(t.revenue)}</td></tr>`)}</tbody></table></div>`
  : html`<p class="muted">Még nincs jegytípus.</p>`}
<div class="grid" style="margin-top:1rem">
${types.length ? html`<form class="stack card" method="post" action="/eloadasok/${p.id}/eladas">
  <strong>Eladás rögzítése</strong>
  <label>Jegytípus<select name="ticket_type_id" required>${options(types.map((t) => [t.id, `${t.name} – ${money(t.price)}`]))}</select></label>
  <label>Darab<input name="quantity" type="number" inputmode="numeric" min="1" step="1" value="1" required></label>
  <label>Összeg (Ft) – üresen hagyva: darab × ár<input name="amount" type="number" inputmode="numeric" min="0" step="1"></label>
  <label>Dátum<input name="sold_on" type="date" value="${ctx.today}" required></label>
  <label>Megjegyzés (pl. pénztár, online, meghívó)<input name="note"></label>
  <button>Rögzítés</button>
</form>` : ""}
<form class="stack card" method="post" action="/eloadasok/${p.id}/jegytipus">
  <strong>Új jegytípus</strong>
  <label>Név (pl. felnőtt, diák, nyugdíjas, támogatói)<input name="name" required></label>
  <label>Ár (Ft)<input name="price" type="number" inputmode="numeric" min="0" step="1" required></label>
  <button class="secondary">Hozzáadás</button>
</form>
</div>
<h2>Rögzített eladások</h2>
${sales.length ? html`<div class="table-wrap"><table class="cards">
<thead><tr><th>Dátum</th><th>Jegytípus</th><th class="num">Darab</th><th class="num">Összeg</th><th>Megjegyzés</th><th>Rögzítette</th></tr></thead>
<tbody>${sales.map((s) => html`<tr><td data-l="Dátum">${s.sold_on}</td><td data-l="Típus">${s.name}</td><td class="num" data-l="Darab">${s.quantity}</td>
<td class="num" data-l="Összeg">${money(s.amount)}</td><td data-l="Megjegyzés">${s.note}</td><td data-l="Rögzítette">${s.recorded_by}</td></tr>`)}</tbody></table></div>`
  : html`<p class="muted">Még nincs rögzített eladás.</p>`}`);
}

async function addType(ctx) {
  const f = await ctx.form();
  const price = Math.round(Number(f.get("price")));
  if (!f.get("name") || !(price >= 0)) return ctx.redirect(`/eloadasok/${ctx.params.id}`, { hiba: "Adj meg nevet és árat." });
  await ctx.db.prepare("INSERT INTO ticket_type (performance_id, name, price) VALUES (?, ?, ?)").bind(ctx.params.id, f.get("name"), price).run();
  return ctx.redirect(`/eloadasok/${ctx.params.id}`, { ok: "Jegytípus hozzáadva." });
}

async function addSale(ctx) {
  const f = await ctx.form();
  const t = await ctx.db.prepare("SELECT * FROM ticket_type WHERE id = ? AND performance_id = ?").bind(f.get("ticket_type_id"), ctx.params.id).first();
  const qty = Math.round(Number(f.get("quantity")));
  if (!t || !(qty > 0)) return ctx.redirect(`/eloadasok/${ctx.params.id}`, { hiba: "Válassz jegytípust és pozitív darabszámot." });
  const amount = f.get("amount") !== "" && f.get("amount") !== null ? Math.round(Number(f.get("amount"))) : qty * t.price;
  await ctx.db.prepare("INSERT INTO ticket_sale (ticket_type_id, quantity, amount, sold_on, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(t.id, qty, amount, f.get("sold_on") || ctx.today, f.get("note") || null, ctx.user).run();
  return ctx.redirect(`/eloadasok/${ctx.params.id}`, { ok: `${qty} db ${t.name} jegy rögzítve (${money(amount)}).` });
}

export const routes = [
  ["GET", "/eloadasok", list],
  ["POST", "/eloadasok", create],
  ["GET", "/eloadasok/:id", show],
  ["POST", "/eloadasok/:id/jegytipus", addType],
  ["POST", "/eloadasok/:id/eladas", addSale],
];
