// Törli a helyi (wrangler dev) D1 állapotot, hogy tiszta lappal lehessen újraindulni.
import { rmSync } from "node:fs";
rmSync(new URL("../.wrangler/state", import.meta.url), { recursive: true, force: true });
console.log("Helyi adatbázis törölve (.wrangler/state).");
