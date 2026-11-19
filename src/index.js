// MáSzínház admin – belépési pont (Cloudflare Worker). Egyszerű útválasztó, szerveroldali HTML.
import { currentUser } from "./auth.js";
import { layout } from "./layout.js";
import { periodOf, todayBudapest } from "./lib/dates.js";
import { ensureCharges } from "./services/members.js";
import * as home from "./routes/home.js";
import * as contacts from "./routes/contacts.js";
import * as uploads from "./routes/uploads.js";
import * as members from "./routes/members.js";
import * as performances from "./routes/performances.js";
import * as settings from "./routes/settings.js";

const ROUTES = [
  ...home.routes, ...contacts.routes, ...uploads.routes,
  ...members.routes, ...performances.routes, ...settings.routes,
].map(([method, pattern, handler]) => {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  return { method, re, keys, handler };
});

function makeCtx(request, env, url, user, params) {
  return {
    request, env, url, user, params,
    db: env.DB,
    today: todayBudapest(),
    form: () => request.formData(),
    page(title, body, opts = {}) {
      const doc = layout({
        title, body, user, path: url.pathname,
        flash: opts.flash ?? url.searchParams.get("ok"),
        error: opts.error ?? url.searchParams.get("hiba"),
      });
      return new Response(String(doc), {
        status: opts.status ?? 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
    redirect(path, { ok, hiba } = {}) {
      const target = new URL(path, url);
      if (ok) target.searchParams.set("ok", ok);
      if (hiba) target.searchParams.set("hiba", hiba);
      return new Response(null, { status: 303, headers: { location: target.pathname + target.search } });
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const user = currentUser(request, env);
    if (!user) return new Response("Belépés szükséges (Cloudflare Access).", { status: 403 });
    for (const r of ROUTES) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const ctx = makeCtx(request, env, url, user, params);
      try {
        return await r.handler(ctx);
      } catch (err) {
        console.error(err);
        return ctx.page("Hiba", "", { error: "Váratlan hiba történt: " + err.message, status: 500 });
      }
    }
    const ctx = makeCtx(request, env, url, user, {});
    return ctx.page("Nem található", "", { error: "Ez az oldal nem található.", status: 404 });
  },

  // Napi ütemezett futás (élesben): a hónap esedékességeinek létrehozása.
  async scheduled(_event, env) {
    await ensureCharges(env.DB, periodOf(todayBudapest()));
  },
};
