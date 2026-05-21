# Magyar Passziánsz PWA

Egy működő MVP magyar kártyás passziánszhoz, 32 lapos paklival, offline PWA támogatással és localStorage mentéssel.

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
python -m http.server 5173
```

Ezután nyisd meg:

```text
http://localhost:5173
```

## Fájlok

- `index.html` – belépési pont
- `styles.css` – teljes reszponzív megjelenés
- `app.js` – teljes játéklogika
- `manifest.webmanifest` – PWA manifest
- `sw.js` – offline cache service worker
- `assets/icon-192.png`, `assets/icon-512.png` – PWA ikonok

## Következő fejlesztési ötletek

- Nehézségi mód: piros/tök kontra zöld/makk váltott színszabály.
- Statisztikák: nyert játszmák, átlagidő, legkevesebb lépés.
- Animált lapmozgatás.
- Saját magyar kártya grafikák importálása.
