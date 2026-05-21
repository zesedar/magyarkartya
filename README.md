# Magyar Passziánsz PWA

Egy működő MVP magyar kártyás passziánszhoz, 32 lapos paklival, valódi magyar kártyalap képekkel, offline PWA támogatással és localStorage mentéssel.

## Mobilra optimalizált verzió

Ez a csomag a korábbi kártyaképes verzió mobilra igazított változata.

Fő változások:

- a 6 oszlop álló mobilképernyőn is egy sorban marad;
- a kártyaképek arányosan kicsinyednek, nincs fix nagy minimummagasság;
- a felső sáv rövidebb: `Új`, `Vissza`, `Auto`, `?`;
- a hosszú leírás mobilon el van rejtve;
- a statisztika kompaktabb;
- a húzó, dobó és gyűjtőpaklik rövid címkéket kaptak;
- a húzópakli üres állapotban közvetlenül a paklihelyre koppintva visszaforgatható;
- a PWA cache verziója frissült: `magyar-passziansz-v4-mobile-card-images-20260521`.

## Szabályok

- 6 oszlopos kezdő leosztás: 1, 2, 3, 4, 5, 6 lap.
- A maradék 11 lap a húzópakliba kerül.
- Gyűjtőpaklik: színenként VII-től Ászig.
- Oszlopok: csökkenő sorrendben rakhatók, például Ász → Király → Felső → Alsó → X.
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
- `app.js` – teljes játéklogika
- `manifest.webmanifest` – PWA manifest
- `sw.js` – offline cache service worker
- `assets/icon-192.png`, `assets/icon-512.png` – PWA ikonok
- `assets/cards-large/*.png` – a magyar kártyalapok képei és a hátlap

## Kártyaképek

A program a `assets/cards-large/` mappában lévő PNG-kre hivatkozik.

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

A `sw.js` ezeket a képeket is cache-eli, ezért a játék offline is valódi kártyaképekkel működik.

## Következő fejlesztési ötletek

- Álló/fekvő mobilnézet finomhangolása külön.
- Nagyított kijelölési előnézet mobilon.
- Drag & drop érintőképernyőn.
- Nehézségi mód: piros/tök kontra zöld/makk váltott színszabály.
- Statisztikák: nyert játszmák, átlagidő, legkevesebb lépés.
