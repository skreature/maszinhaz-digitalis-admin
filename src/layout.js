import { html, raw } from "./lib/html.js";

const NAV = [
  ["/", "Kezdőlap"],
  ["/tagok", "Tagok"],
  ["/befizetes", "Befizetés"],
  ["/eloadasok", "Előadások"],
  ["/kontaktok", "Kontaktok"],
  ["/feltoltes", "Lista feltöltése"],
  ["/beallitasok", "Beállítások"],
];

const CSS = `
:root{--bg:#f6f4f1;--card:#fff;--ink:#1f1d1a;--muted:#6b665f;--line:#e2ddd5;--accent:#8a1c2b;--accent-ink:#fff;--ok:#1d6b3a;--warn:#9a5b00;--bad:#a3192b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
header{background:var(--accent);color:var(--accent-ink)}
header .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem;padding:.6rem 1rem}
header .brand{font-weight:700;color:#fff;text-decoration:none;margin-right:auto}
header nav{display:flex;flex-wrap:wrap;gap:.15rem}
header nav a{color:#fff;text-decoration:none;padding:.35rem .6rem;border-radius:6px;font-size:.95rem}
header nav a.on,header nav a:hover{background:rgba(255,255,255,.18)}
header .user{font-size:.8rem;opacity:.85}
main{max-width:1100px;margin:0 auto;padding:1rem}
h1{font-size:1.5rem;margin:.2rem 0 1rem}
h2{font-size:1.15rem;margin:1.4rem 0 .6rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1rem;margin-bottom:1rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));margin-bottom:1rem}
.grid .card{margin-bottom:0}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:var(--card)}
th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.85rem;color:var(--muted);font-weight:600}
td.num,th.num{text-align:right;white-space:nowrap}
form.stack{display:grid;gap:.75rem;max-width:520px}
label{display:grid;gap:.25rem;font-size:.9rem;color:var(--muted)}
input,select,textarea{font:inherit;padding:.6rem .65rem;border:1px solid #c9c2b8;border-radius:8px;background:#fff;color:var(--ink);width:100%}
input[type=checkbox]{width:auto}
label.check{display:flex;align-items:center;gap:.5rem;color:var(--ink)}
button,.btn{font:inherit;display:inline-block;padding:.6rem 1rem;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);cursor:pointer;text-decoration:none;min-height:44px}
.btn.secondary,button.secondary{background:#fff;color:var(--accent)}
.btn.small,button.small{padding:.3rem .65rem;min-height:0;font-size:.9rem}
.actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.flash{background:#e8f4ec;border:1px solid #b9dcc6;color:var(--ok);padding:.7rem 1rem;border-radius:8px;margin-bottom:1rem}
.flash.err{background:#fbeaec;border-color:#efc1c7;color:var(--bad)}
.muted{color:var(--muted);font-size:.9rem}
.tag{display:inline-block;background:#f1e6e8;color:var(--accent);border-radius:999px;padding:.05rem .55rem;font-size:.8rem;margin:0 .2rem .2rem 0}
.status-nyitott{color:var(--bad);font-weight:600}.status-fizetve{color:var(--ok)}.status-elengedve{color:var(--muted)}
.big{font-size:1.6rem;font-weight:700}
.pair{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.pair dl{display:grid;grid-template-columns:auto 1fr;gap:.3rem .8rem;margin:0}
.pair dt{color:var(--muted);font-size:.85rem}.pair dd{margin:0;overflow-wrap:anywhere}
.diff{background:#fff5d6}
.search{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}.search input{flex:1 1 200px;width:auto}.search select{width:auto}
@media (max-width:640px){
  main{padding:.75rem}
  header nav a{padding:.4rem .5rem;font-size:.9rem}
  table.cards thead{display:none}
  table.cards,table.cards tbody,table.cards tr,table.cards td{display:block;width:100%}
  table.cards tr{border:1px solid var(--line);border-radius:10px;margin-bottom:.6rem;background:var(--card);padding:.3rem 0}
  table.cards td{border:0;padding:.25rem .8rem}
  table.cards td[data-l]::before{content:attr(data-l) ": ";color:var(--muted);font-size:.85rem}
  table.cards td.num{text-align:left}
}
`;

export function layout({ title, body, user, path = "/", flash, error }) {
  const active = (href) => (href === "/" ? path === "/" : path.startsWith(href));
  return html`<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} – MáSzínház admin</title>
<style>${raw(CSS)}</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/">MáSzínház admin</a>
  <nav>${NAV.map(([href, label]) => html`<a href="${href}" class="${active(href) ? "on" : ""}">${label}</a>`)}</nav>
  <span class="user">${user}</span>
</div></header>
<main>
${flash ? html`<div class="flash">${flash}</div>` : ""}
${error ? html`<div class="flash err">${error}</div>` : ""}
${body}
</main>
</body>
</html>`;
}
