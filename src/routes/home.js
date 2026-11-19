import { html, money } from "../lib/html.js";
import { periodLabel, periodOf } from "../lib/dates.js";
import { debtors, ensureCharges } from "../services/members.js";

async function homePage(ctx) {
  const period = periodOf(ctx.today);
  await ensureCharges(ctx.db, period); // idempotens: a hónap esedékességei mindig megvannak
  const owing = await debtors(ctx.db, ctx.today);
  const reviews = await ctx.db.prepare("SELECT COUNT(*) AS n FROM review_item WHERE status = 'nyitott'").first("n");
  const { results: upcoming } = await ctx.db.prepare(
    "SELECT id, title, starts_at, venue FROM performance WHERE starts_at >= ? ORDER BY starts_at LIMIT 5",
  ).bind(ctx.today).all();
  const total = owing.reduce((s, d) => s + d.owed, 0);

  return ctx.page("Kezdőlap", html`
<h1>Kezdőlap</h1>
<div class="grid">
  <div class="card"><div class="muted">Tartozó tagok (${periodLabel(period)})</div><div class="big">${owing.length} fő</div><div class="muted">összesen ${money(total)}</div></div>
  <div class="card"><div class="muted">Ellenőrzésre váró kontakt-egyezések</div><div class="big">${reviews}</div>
    ${reviews ? html`<a class="btn small" href="/ellenorzes">Ellenőrzés</a>` : html`<span class="muted">Nincs teendő.</span>`}</div>
  <div class="card"><div class="muted">Gyors műveletek</div>
    <div class="actions" style="margin-top:.5rem"><a class="btn" href="/befizetes">Befizetés rögzítése</a><a class="btn secondary" href="/feltoltes">Lista feltöltése</a></div></div>
</div>

<h2>Ki tartozik?</h2>
${owing.length ? html`<div class="table-wrap"><table class="cards">
  <thead><tr><th>Név</th><th>Tagkód</th><th>Legrégebbi nyitott hónap</th><th class="num">Tartozás</th><th></th></tr></thead>
  <tbody>${owing.map((d) => html`<tr>
    <td data-l="Név"><a href="/tagok/${d.member_id}">${d.name}</a> <span class="muted">${d.group_name}</span></td>
    <td data-l="Tagkód">${d.member_code}</td>
    <td data-l="Legrégebbi">${d.oldest ? periodLabel(d.oldest) : "–"}</td>
    <td class="num" data-l="Tartozás"><strong>${money(d.owed)}</strong></td>
    <td><a class="btn small" href="/befizetes?tag=${d.member_id}">Befizetés</a></td>
  </tr>`)}</tbody></table></div>` : html`<p class="card">Senki nem tartozik. 🎉</p>`}

<h2>Következő előadások</h2>
${upcoming.length ? html`<div class="table-wrap"><table class="cards"><tbody>${upcoming.map((p) => html`<tr>
  <td data-l="Időpont">${p.starts_at.replace("T", " ")}</td>
  <td data-l="Cím"><a href="/eloadasok/${p.id}">${p.title}</a></td><td data-l="Helyszín">${p.venue}</td></tr>`)}
</tbody></table></div>` : html`<p class="muted">Nincs rögzített közelgő előadás.</p>`}
`);
}

export const routes = [["GET", "/", homePage]];
