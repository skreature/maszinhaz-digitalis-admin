# MáSzínház - digitális adminisztráció

Nyílt tár a MáSzínház működési és adminisztrációs kihívásának megoldásához: kevesebb kézi adminisztráció, egységesebb résztvevői, vásárlói és kapcsolati adatkezelés.

**Állapot:** működő MVP (helyben futtatható admin felület, kitalált mintaadatokkal). A tár egy hackathon keretében jön létre, a tényleges megvalósítás később egy valós szervezetnél történik.

**Licenc:** egyelőre nincs, később döntünk róla.

## A feladat

A kiinduló leírás változtatás nélkül itt olvasható: [docs/kihivas.md](docs/kihivas.md).

Röviden, négy terület:

1. **Foglalkozások díjfizetése** - átállás havi, előrefizetős bérletrendszerre.
2. **Színházjegy-értékesítés** - sokféle jegytípus és egyedi kedvezmény kezelése.
3. **Vásárlói adatok és hírlevél-feliratkozások** - egységes kezelés.
4. **Közös Drive és kontaktadatbázisok** - sajtó-, partner- és egyéb kontaktlisták rendbetétele, egy állapotban.

## Az MVP: egykapus admin felület

Egyetlen, böngészőben futó admin felület saját adatbázissal, Windows-gépen és telefonon is használható.
Technika: Cloudflare Workers + D1 (SQLite) adatbázis, sima szerveroldali HTML-űrlapok és táblázatok,
keretrendszer nélkül; az egyetlen fejlesztői függőség a `wrangler`.

Ami benne van:

- **Kezdőlap:** ki tartozik, következő előadások, ellenőrzésre váró kontakt-egyezések száma.
- **Tagok:** taglista és adatlap fizetési tervvel; a havi esedékességek automatikusan létrejönnek
  (a belépés hónapjától); befizetés rögzítése telefonról (összeg, mód: készpénz/átutalás, dátum);
  elengedés; átutalási közlemény javaslat. Csak nyilvántartás – nincs kártya, nincs bankkapcsolat.
- **Előadások:** lista és adatlap jegytípusokkal, kézzel rögzített eladások és bevétel.
- **Kontaktok – mesterlista:** CSV feltöltése → oszlopok párosítása (a rendszer megjegyzi) →
  egységesítés (e-mail kisbetű, telefon +36 alak, nevek) → szabályalapú címkejavaslat
  (sajtó / partner / támogató / tag / néző) → összefésülés: azonos e-mail vagy telefon esetén
  automatikus összevonás, hasonló névnél ellenőrzési sor. Az ellenőrző képernyőn egymás mellett a két
  rekord, „Ugyanaz az ember / Két külön ember / Kihagyom” gombokkal; a döntést megjegyzi.
  A nyers sor mindig megmarad, így visszakereshető, honnan jött egy adat.
- **Beállítások:** díjtételek, **teljes mentés letöltése** (ZIP, benne minden tábla CSV-ben).

Ami szándékosan kimaradt: kártyás fizetés, tagi önkiszolgáló belépés, hírlevélküldés, banki kivonat
importja, éles telepítés.

## Futtatás helyben

Kell hozzá: [Node.js](https://nodejs.org/) 20 vagy újabb (Windows, macOS, Linux). Fiók, regisztráció nem kell.

```sh
npm install        # a wrangler telepítése (egyszer)
npm run setup      # helyi adatbázis létrehozása + kitalált mintaadatok betöltése
npm run dev        # indítás: http://localhost:8787
```

Telefonról ugyanazon a hálózaton: `npx wrangler dev --local --ip 0.0.0.0`, majd a gép IP-címén, a 8787-es porton.

Hasznos parancsok:

- `npm test` – tesztek (egységesítés, összefésülés, esedékesség-generálás, CSV, mentés).
- `npm run db:reset` – a helyi adatbázis törlése és újratöltése a mintaadatokkal.

**Bemutató a kontakt-mesterlistára:** a „Lista feltöltése” oldalon töltsd fel egymás után a
[`mintaadatok/`](mintaadatok) mappa kitalált listáit (`sajtolista_regi.csv` – régi, Windows-1250
kódolású export; `partnerek_2023.csv`; `hirlevel_export.csv`; `tagok.csv`). Szándékosan vannak
bennük duplikátumok, ékezet- és formátumeltérések, elírások. Excel-fájlt előbb CSV-be kell menteni.

**Belépés:** helyben nincs belépés („helyi admin”). Élesben a felület elé Cloudflare Access kerülne
(e-mailes egyszer használatos kód, csak engedélyezett címek) – lásd `src/auth.js`.

**Felépítés:**

| Hely | Mi van benne |
|---|---|
| `src/index.js` | útválasztó, napi ütemezett esedékesség-generálás |
| `src/routes/` | képernyők (kezdőlap, tagok, előadások, kontaktok, feltöltés, beállítások) |
| `src/lib/` | tiszta logika: egységesítés, összefésülés, címkejavaslat, díjszámítás, CSV, ZIP |
| `src/services/` | adatbázis-műveletek (feltöltés feldolgozása, esedékességek) |
| `migrations/` | adatbázis-séma |
| `seed/seed.sql` | kitalált minta tagok, díjtételek, előadások |
| `tests/` | `node --test` tesztek |

A megoldási terv részletei (adatmodell, adatvédelem, későbbi szakaszok) a hackathon-előkészítő
tervben vannak; a következő lépés a valós listák feltöltése a szervezet saját példányába.

## Megjegyzés

Ebbe a nyilvános tárba valódi vásárlói, résztvevői vagy kontaktadat nem kerülhet.
