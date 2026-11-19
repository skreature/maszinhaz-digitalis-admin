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
/* Design system: docs/design-system (colours sampled from mas-zinhaz.hu). */
:root{
--purple:#8e2680;--purple-dark:#741f69;--purple-tint:#f9f5f8;--purple-soft:#efe1ec;
--orange:#f29321;--orange-dark:#d97c0c;--orange-tint:#fdeedd;--navy:#272b5b;
--bg:#f5f5f5;--card:#fff;--ink:var(--navy);--muted:#6c6f8a;--line:#dee2e6;
--accent:var(--purple);--accent-ink:#fff;
--ok:#1d6b3a;--ok-bg:#e8f4ec;--ok-line:#b9dcc6;--warn:#a85f05;
--bad:#c40e2b;--bad-bg:#fbe7ea;--bad-line:#f2b8c1;
--closed-bg:#ececef;--diff:#fff6bf;--checked-in:#eef7f1;
--font:"Roboto",system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 var(--font)}
a{color:var(--purple);text-underline-offset:2px}a:hover{color:var(--orange-dark)}
header{background:#fff;color:var(--navy);border-bottom:1px solid var(--line)}
header .wrap{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:2rem;padding:0 1.5rem;min-height:64px}
header .brand{font-weight:700;font-size:1.3rem;letter-spacing:.01em;color:var(--navy);text-decoration:none;white-space:nowrap}
header .brand span{color:var(--purple);font-weight:400}
header nav{display:flex;flex-wrap:nowrap;gap:1.5rem;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
header nav::-webkit-scrollbar{display:none}
header nav a{white-space:nowrap;flex:0 0 auto;color:var(--navy);text-decoration:none;padding:1.15rem 0 1rem;border-bottom:3px solid transparent}
header nav a:hover{color:var(--purple)}
header nav a.on{color:var(--purple);border-bottom-color:var(--orange)}
header .user{font-size:.85rem;color:var(--muted);white-space:nowrap;flex:0 0 auto}
main{max-width:1280px;margin:0 auto;padding:1.75rem 1.5rem 3rem}
h1{font-size:2rem;font-weight:400;color:var(--purple);line-height:1.2;margin:.25rem 0 1.25rem}
h2{font-size:1.375rem;font-weight:500;color:var(--purple);margin:2rem 0 .75rem}
h1 .muted,h2 .muted{font-size:1rem;font-weight:400}
strong{font-weight:500}
code{font-size:.9em}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1.25rem;margin-bottom:1.25rem}
.card.brand{background:var(--purple-tint);border:2px solid var(--purple)}
.card>:first-child{margin-top:0}.card>:last-child{margin-bottom:0}
.grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));margin-bottom:1.25rem}
.grid>.card,.grid>div>.card:last-child{margin-bottom:0}
.table-wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:16px}
table{width:100%;border-collapse:collapse;background:var(--card)}
th,td{text-align:left;padding:.7rem .9rem;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:var(--purple-tint)}
th{font-size:.8rem;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.04em;background:#fafafa}
td.num,th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td a{text-decoration:none;font-weight:500}td a:hover{text-decoration:underline}
td a.btn{font-weight:500;text-decoration:none}
.card .table-wrap{border-radius:8px}
form.stack{display:grid;gap:1rem;max-width:560px;align-content:start}
.grid form.stack{max-width:none}
label{display:grid;gap:.4rem;font-size:.95rem;color:var(--navy)}
input,select,textarea{font:inherit;padding:.6rem .75rem;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--navy);width:100%}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(142,38,128,.15)}
input[type=checkbox]{width:18px;height:18px;margin:0;padding:0;accent-color:var(--purple);flex:0 0 auto}
input[type=file]{padding:.45rem .75rem}
label.check{display:flex;align-items:center;gap:.6rem}
button,.btn{font:inherit;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;padding:.6rem 1.1rem;border-radius:4px;border:1px solid var(--purple);background:var(--purple);color:#fff;cursor:pointer;text-decoration:none;min-height:44px;transition:background .15s,border-color .15s,color .15s}
button:hover,.btn:hover{background:var(--purple-dark);border-color:var(--purple-dark);color:#fff}
form.stack>button{justify-self:start}
.btn.secondary,button.secondary{background:#fff;color:var(--purple)}
.btn.secondary:hover,button.secondary:hover{background:var(--purple-tint);color:var(--purple)}
.btn.accent,button.accent{background:var(--orange);border-color:var(--orange);border-radius:999px;padding-left:1.25rem;padding-right:1.25rem}
.btn.accent:hover,button.accent:hover{background:var(--orange-dark);border-color:var(--orange-dark)}
.btn.small,button.small{padding:.3rem .75rem;min-height:0;font-size:.9rem}
.actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.flash{background:var(--ok-bg);border:1px solid var(--ok-line);color:var(--ok);padding:.8rem 1.1rem;border-radius:8px;margin-bottom:1.25rem}
.flash.err{background:var(--bad-bg);border-color:var(--bad-line);color:var(--bad)}
.muted{color:var(--muted);font-size:.9rem}
.tag{display:inline-block;background:var(--purple-soft);color:var(--purple);border-radius:999px;padding:.1rem .6rem;font-size:.8rem;margin:0 .2rem .2rem 0}
.status-nyitott{color:var(--bad);font-weight:500}.status-fizetve{color:var(--ok)}.status-elengedve{color:var(--muted)}
.big{font-size:2rem;font-weight:400;color:var(--purple);line-height:1.2;margin:.15rem 0;overflow-wrap:anywhere}
.big.status-nyitott{color:var(--bad)}.big.status-fizetve{color:var(--ok)}
.pair{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.pair .card{margin-bottom:0}.pair h2{font-size:1.15rem}
.pair dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem;margin:0}
.pair dt{color:var(--muted);font-size:.85rem}.pair dd{margin:0;overflow-wrap:anywhere}
.diff{background:var(--diff);border-radius:3px;padding:0 .2rem}
.search{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.25rem}.search input{flex:1 1 240px;width:auto}.search select{width:auto;flex:0 0 auto}
.badge{display:inline-block;border-radius:999px;padding:.1rem .65rem;font-size:.8rem;font-weight:500;vertical-align:middle;background:var(--ok-bg);color:var(--ok)}
.badge.st-teltház{background:var(--bad-bg);color:var(--bad)}.badge.st-utolsó-előadás{background:var(--orange-tint);color:var(--warn)}.badge.st-lezárt{background:var(--closed-bg);color:var(--muted)}
.meter{height:.5rem;background:var(--purple-soft);border-radius:999px;overflow:hidden;margin:.5rem 0}.meter span{display:block;height:100%;background:var(--purple);border-radius:999px}
details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}
details[open]>form{background:var(--purple-tint);border-radius:8px;padding:1rem;min-width:260px}
table.entry td{vertical-align:middle}table.entry tr.in td{background:var(--checked-in)}
button.tick{background:#fff;color:var(--purple);border:1px solid var(--line);border-radius:6px;font-size:1.4rem;line-height:1;padding:.3rem .55rem;min-height:44px;min-width:44px}
button.tick:hover{background:var(--purple-tint);color:var(--purple);border-color:var(--purple)}
@media print{header,.noprint,.flash,button.tick{display:none}main{max-width:none;padding:0}body{background:#fff;font-size:12pt}
  h1{color:#000}.table-wrap{overflow:visible;border:0;border-radius:0}th{background:none}
  table.entry td:first-child::before{content:"☐";font-size:14pt}table.entry tr.in td:first-child::before{content:"☑"}
  table.entry tr.in td{background:none}table.entry th,table.entry td{border-bottom:1px solid #999;padding:.3rem .4rem}}
@media (max-width:1100px){header .wrap{gap:1.25rem}header nav{gap:1.1rem}}
@media (max-width:640px){
  header .wrap{flex-wrap:wrap;gap:0 1rem;padding:0 1rem}
  header .brand{font-size:1.15rem;padding:.75rem 0 .25rem}
  header .user{margin-left:auto;padding-top:.5rem}
  header nav{order:3;flex:1 0 100%;gap:1.1rem}
  header nav a{padding:.6rem 0 .5rem}
  main{padding:1.25rem 1rem 2.5rem}
  h1{font-size:1.6rem}
  .table-wrap:has(table.cards){background:none;border:0;border-radius:0;overflow:visible}
  table.cards{background:none}
  table.cards thead{display:none}
  table.cards,table.cards tbody,table.cards tr,table.cards td{display:block;width:100%}
  table.cards tr{border:1px solid var(--line);border-radius:12px;margin-bottom:.6rem;background:var(--card);padding:.4rem 0}
  table.cards tbody tr:hover td{background:none}
  table.cards td{border:0;padding:.25rem .9rem}
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap">
<style>${raw(CSS)}</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/">MáSzínház <span>admin</span></a>
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
