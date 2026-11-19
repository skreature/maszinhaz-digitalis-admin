import { html, money } from "../lib/html.js";
import { toCsv } from "../lib/csv.js";
import { makeZip } from "../lib/zip.js";

// A teljes mentésbe kerülő táblák (minden adat, szabványos CSV-ben – terv 2.4).
const BACKUP_TABLES = ["contact", "contact_identifier", "upload", "source_record", "mapping_memory", "review_item",
  "match_decision", "fee_plan", "member", "charge", "payment", "performance", "ticket_template", "ticket_type", "ticket_sale"];

async function page(ctx) {
  const { results: plans } = await ctx.db.prepare(
    "SELECT p.*, (SELECT COUNT(*) FROM member m WHERE m.fee_plan_id = p.id) AS members FROM fee_plan p ORDER BY p.name",
  ).all();
  return ctx.page("Beállítások", html`<h1>Beállítások</h1>
<h2>Díjtételek (fizetési tervek)</h2>
<div class="table-wrap"><table class="cards">
<thead><tr><th>Név</th><th class="num">Összeg</th><th>Gyakoriság</th><th class="num">Esedékesség napja</th><th class="num">Tagok</th></tr></thead>
<tbody>${plans.map((p) => html`<tr><td data-l="Név">${p.name}${p.active ? "" : " (inaktív)"}</td><td class="num" data-l="Összeg">${money(p.amount)}</td>
<td data-l="Gyakoriság">${p.frequency}</td><td class="num" data-l="Nap">${p.due_day}.</td><td class="num" data-l="Tagok">${p.members}</td></tr>`)}</tbody></table></div>
<form class="stack card" method="post" action="/beallitasok/dijtetel" style="margin-top:1rem">
  <strong>Új díjtétel</strong>
  <label>Név (pl. „Felnőtt csoport – havi bérlet”)<input name="name" required></label>
  <label>Havi összeg (Ft)<input name="amount" type="number" inputmode="numeric" min="0" step="1" required></label>
  <label>Esedékesség napja a hónapban<input name="due_day" type="number" min="1" max="28" value="10" required></label>
  <button class="secondary">Hozzáadás</button>
</form>

<h2>Teljes mentés</h2>
<div class="card">
  <p>Egy ZIP-fájl, benne minden tábla külön CSV-ben (Excelben megnyitható). Havonta egyszer töltsd le, és tedd a szervezet saját, zárt tárhelyére.</p>
  <p class="muted">A mentés személyes adatot tartalmaz: ne küldd e-mailben, ne tedd nyilvános helyre, a régieket rendszeresen töröld.</p>
  <a class="btn" href="/mentes">Teljes mentés letöltése</a>
</div>

<h2>Belépők</h2>
<div class="card muted">Helyi futtatáskor nincs belépés. Élesben a belépést a Cloudflare Access védi (e-mailes egyszer használatos kód);
az engedélyezett e-mail-címek listáját a Cloudflare Zero Trust felületén kell karbantartani – lásd <code>src/auth.js</code>.</div>`);
}

async function addPlan(ctx) {
  const f = await ctx.form();
  const amount = Math.round(Number(f.get("amount")));
  const day = Math.min(28, Math.max(1, Math.round(Number(f.get("due_day")) || 10)));
  if (!f.get("name") || !(amount >= 0)) return ctx.redirect("/beallitasok", { hiba: "Adj meg nevet és összeget." });
  await ctx.db.prepare("INSERT INTO fee_plan (name, amount, due_day, updated_by) VALUES (?, ?, ?, ?)").bind(f.get("name"), amount, day, ctx.user).run();
  return ctx.redirect("/beallitasok", { ok: "Díjtétel hozzáadva." });
}

async function backup(ctx) {
  const files = [];
  for (const table of BACKUP_TABLES) {
    const { results } = await ctx.db.prepare(`SELECT * FROM ${table}`).all();
    const cols = (await ctx.db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all()).results.map((r) => r.name);
    files.push({ name: `${table}.csv`, data: toCsv([cols, ...results.map((r) => cols.map((c) => r[c]))]) });
  }
  const zip = makeZip(files);
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="maszinhaz-mentes-${ctx.today}.zip"`,
      "cache-control": "no-store",
    },
  });
}

export const routes = [
  ["GET", "/beallitasok", page],
  ["POST", "/beallitasok/dijtetel", addPlan],
  ["GET", "/mentes", backup],
];
