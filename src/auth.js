// Belépés.
//
// HELYI FUTTATÁS: nincs belépés, mindenki „helyi admin”-ként dolgozik.
//
// ÉLESBEN: a teljes alkalmazás elé Cloudflare Access kerül (e-mailes egyszer használatos kód,
// csak az engedélyezett címek léphetnek be – terv 2.3). Az Access minden kéréshez hozzáteszi a
// `Cf-Access-Authenticated-User-Email` fejlécet; ezt írjuk a módosítási naplóba („ki módosította”).
// Éles telepítésnél állítsd be a REQUIRE_ACCESS="1" változót, így fejléc nélkül a kérés elutasításra
// kerül (védelem arra az esetre, ha az Access-szabály véletlenül lekerülne). Erősebb ellenőrzéshez
// a `Cf-Access-Jwt-Assertion` JWT aláírását is ellenőrizni kell – ez a bevezetési szakasz feladata.

export function currentUser(request, env) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) return email;
  if (env.REQUIRE_ACCESS === "1") return null;
  return "helyi admin";
}
