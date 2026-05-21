const STORAGE_KEY = "magyar-passziansz-v3";
const HISTORY_LIMIT = 80;

const APP_VERSION = "mobilra optimalizált v4";
const CARD_ASSET_DIR = "assets/cards-large";

const SUITS = [
  { id: "piros", name: "Piros", icon: "♥", className: "red-suit", assetSuit: "heart" },
  { id: "tok", name: "Tök", icon: "♦", className: "bell-suit", assetSuit: "bell" },
  { id: "zold", name: "Zöld", icon: "♣", className: "green-suit", assetSuit: "leaf" },
  { id: "makk", name: "Makk", icon: "♠", className: "neutral-suit", assetSuit: "acorn" },
];

const RANKS = ["VII", "VIII", "IX", "X", "Alsó", "Felső", "Király", "Ász"];
const RANK_ASSET_NAMES = ["seven", "eight", "nine", "ten", "unter", "ober", "king", "ace"];
const CARD_BACK_IMAGE = `${CARD_ASSET_DIR}/back.png`;
const FOUNDATION_START = 0;
const ACE_INDEX = 7;

const app = document.querySelector("#app");
let deferredInstallPrompt = null;
let state = loadGame() ?? createNewGame();
let selected = null;
let message = "Válassz egy lapot, majd kattints a célhelyre.";
let helpOpen = false;

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank, rankIndex) => ({
      id: `${suit.id}-${rankIndex}`,
      suit: suit.id,
      rank,
      rankIndex,
      faceUp: true,
    }))
  );
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createNewGame() {
  const deck = shuffle(createDeck());
  const tableau = Array.from({ length: 6 }, () => []);
  let cursor = 0;

  for (let column = 0; column < 6; column += 1) {
    const count = column + 1;
    for (let i = 0; i < count; i += 1) {
      const card = { ...deck[cursor], faceUp: i === count - 1 };
      tableau[column].push(card);
      cursor += 1;
    }
  }

  return {
    tableau,
    stock: deck.slice(cursor).map((card) => ({ ...card, faceUp: false })),
    waste: [],
    foundations: Object.fromEntries(SUITS.map((suit) => [suit.id, []])),
    moves: 0,
    startedAt: Date.now(),
    elapsedBeforeLoad: 0,
    history: [],
    won: false,
  };
}

function cloneState(game) {
  return JSON.parse(JSON.stringify(game));
}

function saveHistory() {
  const snapshot = cloneState({ ...state, history: [] });
  state.history = [...state.history.slice(-(HISTORY_LIMIT - 1)), snapshot];
}

function commit(nextMessage) {
  state.moves += 1;
  message = nextMessage;
  state.won = checkWin();
  selected = null;
  saveGame();
  render();
}

function saveGame() {
  const toSave = {
    ...state,
    elapsedBeforeLoad: getElapsedSeconds(),
    startedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.tableau || !parsed.stock || !parsed.foundations) return null;
    parsed.startedAt = Date.now();
    parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
    parsed.won = Boolean(parsed.won);
    return parsed;
  } catch {
    return null;
  }
}

function getElapsedSeconds() {
  return Math.floor((Date.now() - state.startedAt) / 1000) + (state.elapsedBeforeLoad || 0);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function suitMeta(suitId) {
  return SUITS.find((suit) => suit.id === suitId);
}

function cardImagePath(card) {
  const suit = suitMeta(card.suit);
  const rankAsset = RANK_ASSET_NAMES[card.rankIndex];
  return `${CARD_ASSET_DIR}/${suit.assetSuit}-${rankAsset}.png`;
}

function canPlaceOnTableau(movingCard, targetCard) {
  if (!targetCard) return movingCard.rankIndex === ACE_INDEX;
  return targetCard.rankIndex === movingCard.rankIndex + 1;
}

function canMoveStack(stack) {
  if (!stack.length || stack.some((card) => !card.faceUp)) return false;
  for (let i = 1; i < stack.length; i += 1) {
    if (stack[i - 1].rankIndex !== stack[i].rankIndex + 1) return false;
  }
  return true;
}

function canPlaceOnFoundation(card) {
  const foundation = state.foundations[card.suit];
  const expectedRank = foundation.length === 0
    ? FOUNDATION_START
    : foundation[foundation.length - 1].rankIndex + 1;
  return card.rankIndex === expectedRank;
}

function flipTopIfNeeded(column) {
  if (!column.length) return;
  const top = column[column.length - 1];
  if (!top.faceUp) top.faceUp = true;
}

function drawFromStock() {
  if (state.won) return;
  if (state.stock.length === 0) {
    if (state.waste.length === 0) {
      showMessage("Nincs mit visszaforgatni.");
      return;
    }
    saveHistory();
    state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
    commit("A dobópaklit visszaforgattad a húzópakliba.");
    return;
  }

  saveHistory();
  const card = state.stock.pop();
  state.waste.push({ ...card, faceUp: true });
  commit("Húztál egy lapot.");
}

function undoMove() {
  const previous = state.history.pop();
  if (!previous) {
    showMessage("Még nincs visszavonható lépés.");
    return;
  }
  const currentHistory = state.history;
  state = { ...previous, history: currentHistory, startedAt: Date.now() };
  message = "Visszavontad az előző lépést.";
  selected = null;
  saveGame();
  render();
}

function restartGame() {
  const ok = confirm("Új játékot indítasz? A jelenlegi állás elveszik.");
  if (!ok) return;
  state = createNewGame();
  selected = null;
  message = "Új játék indult. Sok sikert!";
  saveGame();
  render();
}

function selectFromTableau(columnIndex, cardIndex) {
  if (state.won) return;
  const column = state.tableau[columnIndex];
  const stack = column.slice(cardIndex);
  if (!stack[0]?.faceUp) return;
  if (!canMoveStack(stack)) {
    showMessage("Ezt a sort nem lehet együtt mozgatni: csak csökkenő, felfordított sor mozgatható.");
    return;
  }
  selected = { source: "tableau", columnIndex, cardIndex, cards: stack.map((card) => card.id) };
  showMessage(`${cardName(stack[0])} kijelölve${stack.length > 1 ? `, ${stack.length} lapos sorral` : ""}.`);
}

function selectFromWaste() {
  if (state.won) return;
  const card = state.waste[state.waste.length - 1];
  if (!card) return;
  selected = { source: "waste", cards: [card.id] };
  showMessage(`${cardName(card)} kijelölve a dobópakliból.`);
}

function selectFromFoundation(suitId) {
  if (state.won) return;
  const foundation = state.foundations[suitId];
  const card = foundation[foundation.length - 1];
  if (!card) return;
  selected = { source: "foundation", suitId, cards: [card.id] };
  showMessage(`${cardName(card)} kijelölve a gyűjtőpakliból.`);
}

function getSelectedCards() {
  if (!selected) return [];
  if (selected.source === "waste") {
    const card = state.waste[state.waste.length - 1];
    return card ? [card] : [];
  }
  if (selected.source === "foundation") {
    const pile = state.foundations[selected.suitId];
    const card = pile[pile.length - 1];
    return card ? [card] : [];
  }
  return state.tableau[selected.columnIndex].slice(selected.cardIndex);
}

function clearSelection() {
  selected = null;
  showMessage("Kijelölés törölve.");
}

function removeSelectedCards() {
  if (selected.source === "waste") {
    return [state.waste.pop()];
  }
  if (selected.source === "foundation") {
    return [state.foundations[selected.suitId].pop()];
  }
  const column = state.tableau[selected.columnIndex];
  const moving = column.splice(selected.cardIndex);
  flipTopIfNeeded(column);
  return moving;
}

function moveToTableau(targetColumnIndex) {
  if (!selected) {
    showMessage("Előbb jelölj ki egy felfordított lapot vagy sort.");
    return;
  }
  if (selected.source === "tableau" && selected.columnIndex === targetColumnIndex) {
    clearSelection();
    return;
  }

  const moving = getSelectedCards();
  if (!moving.length) return;
  const targetColumn = state.tableau[targetColumnIndex];
  const targetCard = targetColumn[targetColumn.length - 1];

  if (!canMoveStack(moving)) {
    showMessage("Ez a kijelölt sor nem mozgatható.");
    return;
  }
  if (!canPlaceOnTableau(moving[0], targetCard)) {
    showMessage(targetCard
      ? `${cardName(moving[0])} nem tehető erre: ${cardName(targetCard)}.`
      : "Üres oszlopra csak Ász kerülhet.");
    return;
  }

  saveHistory();
  const removed = removeSelectedCards();
  state.tableau[targetColumnIndex].push(...removed.map((card) => ({ ...card, faceUp: true })));
  commit("Sikeres mozgatás az oszlopok között.");
}

function moveToFoundation(suitId) {
  if (!selected) {
    showMessage("Előbb jelölj ki egy lapot.");
    return;
  }
  const moving = getSelectedCards();
  if (moving.length !== 1) {
    showMessage("Gyűjtőpakliba egyszerre csak egy lap tehető.");
    return;
  }
  const card = moving[0];
  if (card.suit !== suitId) {
    showMessage(`${cardName(card)} csak a saját színének gyűjtőpaklijába kerülhet.`);
    return;
  }
  if (!canPlaceOnFoundation(card)) {
    const expected = state.foundations[suitId].length === 0
      ? RANKS[FOUNDATION_START]
      : RANKS[state.foundations[suitId][state.foundations[suitId].length - 1].rankIndex + 1];
    showMessage(`Ide most ${suitMeta(suitId).name} ${expected} kellene.`);
    return;
  }

  saveHistory();
  const [removed] = removeSelectedCards();
  state.foundations[suitId].push({ ...removed, faceUp: true });
  commit(`${cardName(card)} a gyűjtőpakliba került.`);
}

function autoMovePossibleFoundations() {
  if (state.won) return;
  let moved = 0;
  saveHistory();

  let changed = true;
  while (changed) {
    changed = false;

    for (const column of state.tableau) {
      const card = column[column.length - 1];
      if (card?.faceUp && canPlaceOnFoundation(card)) {
        state.foundations[card.suit].push({ ...column.pop(), faceUp: true });
        flipTopIfNeeded(column);
        moved += 1;
        changed = true;
      }
    }

    const wasteCard = state.waste[state.waste.length - 1];
    if (wasteCard && canPlaceOnFoundation(wasteCard)) {
      state.foundations[wasteCard.suit].push({ ...state.waste.pop(), faceUp: true });
      moved += 1;
      changed = true;
    }
  }

  if (moved === 0) {
    state.history.pop();
    showMessage("Most nincs automatikusan gyűjtőbe tehető lap.");
    return;
  }
  commit(`${moved} lap automatikusan a gyűjtőpakliba került.`);
}

function checkWin() {
  return SUITS.every((suit) => state.foundations[suit.id].length === RANKS.length);
}

function cardName(card) {
  const suit = suitMeta(card.suit);
  return `${suit.name} ${card.rank}`;
}

function showMessage(nextMessage) {
  message = nextMessage;
  render();
}

function isSelectedCard(card) {
  return selected?.cards?.includes(card.id);
}

function isValidTargetTableau(index) {
  if (!selected) return false;
  const moving = getSelectedCards();
  const target = state.tableau[index];
  return moving.length > 0 && canMoveStack(moving) && canPlaceOnTableau(moving[0], target[target.length - 1]);
}

function isValidTargetFoundation(suitId) {
  if (!selected) return false;
  const moving = getSelectedCards();
  return moving.length === 1 && moving[0].suit === suitId && canPlaceOnFoundation(moving[0]);
}

function renderCard(card, options = {}) {
  const suit = suitMeta(card.suit);
  const click = options.click ?? "";
  const extraClass = options.extraClass ?? "";

  if (!card.faceUp) {
    const tabIndex = click ? "" : 'tabindex="-1"';
    const ariaLabel = click ? "Húzás a pakliból" : "Lefordított lap";
    return `
      <button class="card face-down ${extraClass}" ${click} aria-label="${ariaLabel}" ${tabIndex}>
        <img class="card-image" src="${CARD_BACK_IMAGE}" alt="" draggable="false" loading="lazy">
      </button>
    `;
  }

  const selectedClass = isSelectedCard(card) ? "selected" : "";
  const label = `${suit.name} ${card.rank}`;
  const image = cardImagePath(card);

  return `
    <button class="card image-card ${suit.className} ${selectedClass} ${extraClass}" ${click} aria-label="${label}">
      <img class="card-image" src="${image}" alt="${label}" draggable="false" loading="lazy">
      <span class="sr-only">${label}</span>
    </button>
  `;
}

function renderStock() {
  const stockTop = state.stock.length > 0
    ? renderCard({ faceUp: false }, { click: 'onclick="drawFromStock()"' })
    : `<button class="card-slot empty-stock ${state.waste.length ? "highlight" : ""}" onclick="drawFromStock()" ${state.waste.length ? "" : "disabled"}>${state.waste.length ? "Vissza" : "Üres"}</button>`;

  return `
    <section>
      <p class="pile-label">Húzó · ${state.stock.length}</p>
      ${stockTop}
      <div class="stock-actions">
        <button class="btn" onclick="drawFromStock()">${state.stock.length ? "Húzás" : "Visszaforgat"}</button>
      </div>
    </section>
  `;
}

function renderWaste() {
  const card = state.waste[state.waste.length - 1];
  return `
    <section>
      <p class="pile-label">Dobó · ${state.waste.length}</p>
      ${card
        ? renderCard(card, { click: "onclick=\"selectFromWaste()\"" })
        : `<div class="card-slot">Üres</div>`}
    </section>
  `;
}

function renderFoundation(suit) {
  const pile = state.foundations[suit.id];
  const top = pile[pile.length - 1];
  const highlight = isValidTargetFoundation(suit.id) ? "highlight" : "";
  const nextRank = pile.length < RANKS.length ? RANKS[pile.length] : "kész";
  return `
    <section>
      <p class="pile-label">${suit.name} · ${nextRank}</p>
      <div class="card-slot foundation-slot ${highlight}" onclick="moveToFoundation('${suit.id}')">
        ${top ? renderCard(top, { click: `onclick=\"event.stopPropagation(); selectFromFoundation('${suit.id}')\"` }) : `<span class="foundation-empty"><span class="suit-icon">${suit.icon}</span><small>${suit.name}<br>VII</small></span>`}
      </div>
    </section>
  `;
}

function renderTableau() {
  return `
    <section class="tableau" aria-label="Oszlopok">
      ${state.tableau.map((column, columnIndex) => {
        const highlight = isValidTargetTableau(columnIndex) ? "highlight" : "";
        const cards = column.length
          ? column.map((card, cardIndex) => renderCard(card, {
              extraClass: cardIndex ? "stack-card" : "",
              click: card.faceUp ? `onclick=\"event.stopPropagation(); selectFromTableau(${columnIndex}, ${cardIndex})\"` : "",
            })).join("")
          : `<div class="column-empty-hint">Üres<br>Ász</div>`;
        return `
          <div class="column ${highlight}" onclick="moveToTableau(${columnIndex})" aria-label="${columnIndex + 1}. oszlop">
            ${cards}
          </div>
        `;
      }).join("")}
    </section>
  `;
}

function renderWinModal() {
  return `
    <div class="modal-backdrop ${state.won ? "open" : ""}">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <h2 id="win-title">Megnyerted! 🎉</h2>
        <p>Az összes magyar kártya a gyűjtőpaklikba került. Lépések: <strong>${state.moves}</strong>, idő: <strong>${formatTime(getElapsedSeconds())}</strong>.</p>
        <div class="modal-actions">
          <button class="btn" onclick="window.location.reload()">Bezárás</button>
          <button class="btn primary" onclick="restartGame()">Új</button>
        </div>
      </div>
    </div>
  `;
}

function renderInstallBanner() {
  return `
    <div id="installBanner" class="install-banner">
      <span>Telepíthető PWA-ként, és offline is működik.</span>
      <button class="btn primary" onclick="installApp()">Telepítés</button>
    </div>
  `;
}

function render() {
  const completed = SUITS.reduce((sum, suit) => sum + state.foundations[suit.id].length, 0);
  app.innerHTML = `
    <main class="app-shell">
      <header class="header">
        <div class="title-wrap">
          <h1>Magyar Passziánsz</h1>
          <p class="subtitle">32 lapos magyar kártyás passziánsz. Gyűjtsd fel színenként VII-től Ászig.</p>
        </div>
        <div class="toolbar">
          <button class="btn primary" onclick="restartGame()">Új</button>
          <button class="btn" onclick="undoMove()" ${state.history.length ? "" : "disabled"}>Vissza</button>
          <button class="btn" onclick="autoMovePossibleFoundations()">Auto</button>
          <button class="btn" onclick="toggleHelp()" aria-label="Szabályok">?</button>
        </div>
      </header>

      ${renderInstallBanner()}

      <section class="stats" aria-label="Játékállapot">
        <div class="stat-card"><span class="stat-label">Lépés</span><span class="stat-value">${state.moves}</span></div>
        <div class="stat-card"><span class="stat-label">Idő</span><span class="stat-value" id="timer">${formatTime(getElapsedSeconds())}</span></div>
        <div class="stat-card"><span class="stat-label">Kész</span><span class="stat-value">${completed}/32</span></div>
        <div class="stat-card"><span class="stat-label">Kijelölés</span><span class="stat-value">${selected ? "van" : "nincs"}</span></div>
      </section>

      <section class="board">
        <div class="top-row">
          ${renderStock()}
          ${renderWaste()}
          <div class="spacer"></div>
          ${SUITS.map(renderFoundation).join("")}
        </div>
        ${renderTableau()}
      </section>

      <p class="message" aria-live="polite">${message}</p>

      <section class="help-panel ${helpOpen ? "open" : ""}">
        <h2>Szabályok</h2>
        <ul>
          <li>A gyűjtőpaklik színenként épülnek: VII, VIII, IX, X, Alsó, Felső, Király, Ász.</li>
          <li>Az oszlopokban csökkenő sorrendben rakhatsz: Ászra Király, Királyra Felső, és így tovább.</li>
          <li>Üres oszlopra csak Ász kerülhet.</li>
          <li>Felfordított, szabályos sort is mozgathatsz az oszlopok között.</li>
          <li>A dobópakli korlátlanul visszaforgatható a húzópakliba.</li>
        </ul>
        <p class="asset-note">Verzió: ${APP_VERSION}. Kártyaképek: assets/cards-large/ mappa. Fájlnevek: heart/bell/leaf/acorn + seven/eight/nine/ten/unter/ober/king/ace.</p>
      </section>
      ${renderWinModal()}
    </main>
  `;
  updateInstallBanner();
}

function toggleHelp() {
  helpOpen = !helpOpen;
  render();
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallBanner();
}

function updateInstallBanner() {
  const banner = document.querySelector("#installBanner");
  if (!banner) return;
  banner.classList.toggle("show", Boolean(deferredInstallPrompt));
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallBanner();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && selected) clearSelection();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoMove();
  }
});

setInterval(() => {
  const timer = document.querySelector("#timer");
  if (timer && !state.won) timer.textContent = formatTime(getElapsedSeconds());
}, 1000);

window.drawFromStock = drawFromStock;
window.selectFromWaste = selectFromWaste;
window.selectFromFoundation = selectFromFoundation;
window.selectFromTableau = selectFromTableau;
window.moveToTableau = moveToTableau;
window.moveToFoundation = moveToFoundation;
window.restartGame = restartGame;
window.undoMove = undoMove;
window.autoMovePossibleFoundations = autoMovePossibleFoundations;
window.toggleHelp = toggleHelp;
window.installApp = installApp;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=mobile1", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        console.info("A service worker regisztráció nem sikerült. Helyi file:// megnyitásnál ez normális.");
      });
  });
}

render();
