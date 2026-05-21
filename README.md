# Magyar Passziánsz PWA

32 lapos magyar kártyás passziánsz valódi magyar kártyalap képekkel, offline PWA támogatással és localStorage mentéssel.

## Aktuális fejlesztések

- Javított időmérés visszavonás után: az undo már nem nullázza / torzítja az eltelt időt.
- A győzelmi modal bezárása már nem tölti újra az oldalt.
- Automatikus mentés lapelrejtéskor / bezáráskor: `pagehide` és `visibilitychange` eseményekkel.
- Az oszlopokban csökkenő sorrend mellett azonos szín nem kerülhet egymás alá.
- Ranglista a 10 legjobb idővel, lépésszámmal és dátummal.
- Statisztikák: nyert játszmák, győzelmi arány, legjobb idő, legkevesebb lépés.
- A kártyaképek WebP formátumban kerültek be az optimalizált csomagba; az app ezeket használja.
- Service worker cache javítás: képhibánál már nem ad vissza `index.html`-t képfájlként.
- Mobilon is látható PWA telepítési banner, ha a böngésző támogatja.

## Kivett funkciók

- Seedelt / napi leosztás.
- Tipp gomb.
- Mobil kijelöltlap-előnézet.
- Auto gomb.
- `?` súgópanel.

## Szabályok

- 6 oszlopos kezdő leosztás: 1, 2, 3, 4, 5, 6 lap.
- A maradék 11 lap a húzópakliba kerül.
- Gyűjtőpaklik: színenként VII-től Ászig.
- Oszlopok: csökkenő sorrendben rakhatók, például Ász → Király → Felső → Alsó → X.
- Azonos szín nem kerülhet közvetlenül egymás alá az oszlopokban.
- Üres oszlopra csak Ász kerülhet.
- A dobópakli korlátlanul visszaforgatható.

## Futtatás helyben

A PWA service worker miatt érdemes helyi szerverről futtatni:

```bash
cd magyar-passziansz-pwa
python -m http.server 5174
```

Ezután nyisd meg:

```text
http://localhost:5174
```

Ha régi verziót látsz, töröld az oldal cache-ét:

```text
DevTools → Application → Storage → Clear site data
DevTools → Application → Service Workers → Unregister
```

Utána teljes újratöltés: `Ctrl + Shift + R`.

## Fájlok

- `index.html` – belépési pont
- `styles.css` – teljes reszponzív, mobilra optimalizált megjelenés
- `app.js` – teljes játéklogika egy fájlban
- `manifest.webmanifest` – PWA manifest
- `sw.js` – offline cache service worker
- `assets/icon-192.png`, `assets/icon-512.png` – PWA ikonok
- `assets/cards-webp/*.webp` – optimalizált WebP kártyaképek, ezeket használja az app

## Kártyaképek

Színek megfeleltetése:

- `heart-*` → Piros
- `bell-*` → Tök
- `leaf-*` → Zöld
- `acorn-*` → Makk

Rangok megfeleltetése:

- `seven` → VII
- `eight` → VIII
- `nine` → IX
- `ten` → X
- `unter` → Alsó
- `ober` → Felső
- `king` → Király
- `ace` → Ász
