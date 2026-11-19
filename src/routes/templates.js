// Jegytípus-sablonok: ebből kap minden új előadás egy saját, felülírható jegytípus-listát.
import { html, money, raw } from "../lib/html.js";

function fields(f) {
  const price = Math.round(Number(f.get("base_price")));
  const name = String(f.get("name") ?? "").trim();
  if (!name || f.get("base_price") === "" || !(price >= 0)) return null;
  return {
    name, base_price: price, eligibility: String(f.get("eligibility") ?? "").trim() || null,
    check_at_entry: f.get("check_at_entry") ? 1 : 0, is_gift: f.get("is_gift") ? 1 : 0,
    active: f.get("active") ? 1 : 0, sort: Math.round(Number(f.get("sort"))) || 0,
  };
}

const form = (t, action, button) => html`<form class="stack" method="post" action="${action}">
  <label>Név<input name="name" value="${t.name ?? ""}" required></label>
  <label>Alapár (Ft, 0 = ingyenes / meghívó)<input name="base_price" type="number" inputmode="numeric" min="0" step="1" value="${t.base_price ?? ""}" required></label>
  <label>Jogosultsági feltétel (pl. „IX. kerületi lakos, lakcímkártyával”)<input name="eligibility" value="${t.eligibility ?? ""}"></label>
  <label class="check"><input type="checkbox" name="check_at_entry" value="1"${t.check_at_entry ? raw(" checked") : ""}> Belépéskor ellenőrizendő</label>
  <label class="check"><input type="checkbox" name="is_gift" value="1"${t.is_gift ? raw(" checked") : ""}> Ajándékjegy / utalvány (nem foglal helyet az előadáson)</label>
  <label class="check"><input type="checkbox" name="active" value="1"${t.active ?? 1 ? raw(" checked") : ""}> Aktív (új előadásnál felajánljuk)</label>
  <label>Sorrend<input name="sort" type="number" step="1" value="${t.sort ?? 0}"></label>
  <button class="small">${button}</button>
</form>`;

async function page(ctx) {
  const { results } = await ctx.db.prepare(
    "SELECT t.*, (SELECT COUNT(*) FROM ticket_type x WHERE x.template_id = t.id) AS used FROM ticket_template t ORDER BY t.active DESC, t.sort, t.id",
  ).all();
  return ctx.page("Jegytípus-sablonok", html`<h1>Jegytípus-sablonok</h1>
<p class="muted">Szabad lista, nem fix hármas. Új előadásnál az aktív sablonok átmásolódnak, és ott előadásonként átírhatók
(ár, név, feltétel). A sablon módosítása a már létrehozott előadásokat és a rögzített eladásokat nem változtatja meg.</p>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Név</th><th class="num">Alapár</th><th>Jogosultság</th><th class="num">Előadásnál</th><th></th></tr></thead>
<tbody>${results.map((t) => html`<tr><td data-l="Név"><strong>${t.name}</strong>${t.active ? "" : " (inaktív)"}
${t.is_gift ? html` <span class="tag">ajándék</span>` : ""}${t.check_at_entry ? html` <span class="tag">belépéskor ellenőrizendő</span>` : ""}</td>
<td class="num" data-l="Alapár">${money(t.base_price)}</td><td data-l="Jogosultság">${t.eligibility ?? "–"}</td>
<td class="num" data-l="Használva">${t.used}</td>
<td><details><summary class="btn small secondary">Módosítás</summary>${form(t, `/jegytipusok/${t.id}`, "Mentés")}</details></td></tr>`)}</tbody></table></div>
<h2>Új sablon</h2>
<div class="card">${form({}, "/jegytipusok", "Hozzáadás")}</div>`);
}

async function create(ctx) {
  const t = fields(await ctx.form());
  if (!t) return ctx.redirect("/jegytipusok", { hiba: "Adj meg nevet és alapárat (0 Ft is lehet)." });
  await ctx.db.prepare(
    "INSERT INTO ticket_template (name, base_price, eligibility, check_at_entry, is_gift, active, sort, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(t.name, t.base_price, t.eligibility, t.check_at_entry, t.is_gift, t.active, t.sort, ctx.user).run();
  return ctx.redirect("/jegytipusok", { ok: "Sablon hozzáadva." });
}

async function update(ctx) {
  const t = fields(await ctx.form());
  if (!t) return ctx.redirect("/jegytipusok", { hiba: "Adj meg nevet és alapárat (0 Ft is lehet)." });
  await ctx.db.prepare(
    `UPDATE ticket_template SET name = ?, base_price = ?, eligibility = ?, check_at_entry = ?, is_gift = ?, active = ?, sort = ?,
     updated_at = datetime('now'), updated_by = ? WHERE id = ?`,
  ).bind(t.name, t.base_price, t.eligibility, t.check_at_entry, t.is_gift, t.active, t.sort, ctx.user, ctx.params.id).run();
  return ctx.redirect("/jegytipusok", { ok: "Sablon mentve." });
}

export const routes = [
  ["GET", "/jegytipusok", page],
  ["POST", "/jegytipusok", create],
  ["POST", "/jegytipusok/:id", update],
];
