const STORAGE_KEY = "magyar-passziansz-v4";
const STATS_KEY = "magyar-passziansz-stats-v1";
const HISTORY_LIMIT = 80;
const LEADERBOARD_LIMIT = 10;

const CARD_ASSET_DIR = "assets/cards-webp";
const CARD_ASSET_EXT = "webp";

const SUITS = [
  { id: "piros", name: "Piros", icon: "♥", className: "red-suit", assetSuit: "heart" },
  { id: "tok", name: "Tök", icon: "♦", className: "bell-suit", assetSuit: "bell" },
  { id: "zold", name: "Zöld", icon: "♣", className: "green-suit", assetSuit: "leaf" },
  { id: "makk", name: "Makk", icon: "♠", className: "neutral-suit", assetSuit: "acorn" },
];

const RANKS = ["VII", "VIII", "IX", "X", "Alsó", "Felső", "Király", "Ász"];
const RANK_ASSET_NAMES = ["seven", "eight", "nine", "ten", "unter", "ober", "king", "ace"];
const CARD_BACK_IMAGE = `${CARD_ASSET_DIR}/back.${CARD_ASSET_EXT}`;
const FOUNDATION_START = 0;
const ACE_INDEX = 7;

const app = document.querySelector("#app");
let deferredInstallPrompt = null;
let playerStats = loadStats();
let state = loadGame();
if (!state) {
  state = createNewGame();
  recordGameStarted();
}
let selected = null;
let message = "Válassz egy lapot, majd kattints a célhelyre.";
let winModalOpen = false;

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

  const createdAt = Date.now();
  return {
    tableau,
    stock: deck.slice(cursor).map((card) => ({ ...card, faceUp: false })),
    waste: [],
    foundations: Object.fromEntries(SUITS.map((suit) => [suit.id, []])),
    moves: 0,
    startedAt: createdAt,
    elapsedBeforeLoad: 0,
    history: [],
    won: false,
    createdAt,
    gameId: `${createdAt}-${Math.random().toString(36).slice(2, 10)}`,
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
  const wasWon = state.won;
  state.moves += 1;
  message = nextMessage;
  state.won = checkWin();

  if (state.won && !wasWon) {
    const finalSeconds = getElapsedSeconds();
    recordWin(finalSeconds);
    winModalOpen = true;
    message = `Gratulálok, megnyerted ${state.moves} lépésből, ${formatTime(finalSeconds)} alatt!`;
  }

  selected = null;
  saveGame();
  render();
}

function saveGame() {
  if (!state) return;
  const toSave = {
    ...state,
    elapsedBeforeLoad: getElapsedSeconds(),
    startedAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    console.warn("Nem sikerült menteni a játékállást.");
  }
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
    parsed.createdAt = parsed.createdAt || Date.now();
    parsed.gameId = parsed.gameId || `${parsed.createdAt}-${Math.random().toString(36).slice(2, 10)}`;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeLeaderboard(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => Number.isFinite(Number(entry.seconds)))
    .map((entry) => ({
      seconds: Math.max(0, Math.floor(Number(entry.seconds))),
      moves: Math.max(0, Math.floor(Number(entry.moves) || 0)),
      wonAt: entry.wonAt || new Date().toISOString(),
      gameId: entry.gameId || `${entry.wonAt || Date.now()}-${entry.moves || 0}`,
    }))
    .sort((a, b) => a.seconds - b.seconds || a.moves - b.moves || String(a.wonAt).localeCompare(String(b.wonAt)))
    .slice(0, LEADERBOARD_LIMIT);
}

function loadStats() {
  const fallback = {
    gamesStarted: 0,
    gamesWon: 0,
    bestTime: null,
    bestMoves: null,
    currentStreak: 0,
    bestStreak: 0,
    completedGameIds: {},
    bestTimes: [],
  };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const savedBestTimes = normalizeLeaderboard(parsed.bestTimes || parsed.leaderboard || []);
    const migratedBestTimes = savedBestTimes.length || parsed.bestTime == null
      ? savedBestTimes
      : normalizeLeaderboard([{
          seconds: parsed.bestTime,
          moves: parsed.bestMoves || 0,
          wonAt: new Date().toISOString(),
          gameId: "migrated-best-time",
        }]);
    return {
      ...fallback,
      ...parsed,
      completedGameIds: parsed.completedGameIds || {},
      bestTimes: migratedBestTimes,
    };
  } catch {
    return fallback;
  }
}

function saveStats() {
  playerStats.bestTimes = normalizeLeaderboard(playerStats.bestTimes);
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(playerStats));
  } catch {
    console.warn("Nem sikerült menteni a statisztikákat.");
  }
}

function recordGameStarted() {
  playerStats.gamesStarted += 1;
  saveStats();
}

function recordAbandonedGameIfNeeded() {
  if (state && !state.won && state.moves > 0) {
    playerStats.currentStreak = 0;
    saveStats();
  }
}

function recordWin(finalSeconds) {
  playerStats.completedGameIds = playerStats.completedGameIds || {};
  const gameId = state.gameId || `${state.createdAt}-${state.moves}`;
  if (playerStats.completedGameIds[gameId]) return;

  const wonAt = new Date().toISOString();
  playerStats.completedGameIds[gameId] = { wonAt, moves: state.moves, seconds: finalSeconds };
  playerStats.gamesWon += 1;
  playerStats.currentStreak += 1;
  playerStats.bestStreak = Math.max(playerStats.bestStreak || 0, playerStats.currentStreak);
  playerStats.bestTime = playerStats.bestTime == null ? finalSeconds : Math.min(playerStats.bestTime, finalSeconds);
  playerStats.bestMoves = playerStats.bestMoves == null ? state.moves : Math.min(playerStats.bestMoves, state.moves);
  playerStats.bestTimes = normalizeLeaderboard([
    ...(playerStats.bestTimes || []),
    { seconds: finalSeconds, moves: state.moves, wonAt, gameId },
  ]);
  saveStats();
}

function getElapsedSeconds() {
  return Math.floor((Date.now() - state.startedAt) / 1000) + (state.elapsedBeforeLoad || 0);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("hu-HU", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "–";
  }
}

function suitMeta(suitId) {
  return SUITS.find((suit) => suit.id === suitId);
}

function cardImagePath(card) {
  const suit = suitMeta(card.suit);
  const rankAsset = RANK_ASSET_NAMES[card.rankIndex];
  return `${CARD_ASSET_DIR}/${suit.assetSuit}-${rankAsset}.${CARD_ASSET_EXT}`;
}

function cardName(card) {
  const suit = suitMeta(card.suit);
  return `${suit.name} ${card.rank}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function canPlaceOnTableau(movingCard, targetCard) {
  if (!targetCard) return movingCard.rankIndex === ACE_INDEX;
  return targetCard.rankIndex === movingCard.rankIndex + 1 && targetCard.suit !== movingCard.suit;
}

function canMoveStack(stack) {
  if (!stack.length || stack.some((card) => !card.faceUp)) return false;
  for (let i = 1; i < stack.length; i += 1) {
    const upperCard = stack[i - 1];
    const lowerCard = stack[i];
    if (upperCard.rankIndex !== lowerCard.rankIndex + 1) return false;
    if (upperCard.suit === lowerCard.suit) return false;
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
  selected = null;

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
  const elapsed = getElapsedSeconds();
  const currentHistory = state.history;
  state = {
    ...previous,
    history: currentHistory,
    elapsedBeforeLoad: elapsed,
    startedAt: Date.now(),
  };
  winModalOpen = false;
  message = "Visszavontad az előző lépést.";
  selected = null;
  saveGame();
  render();
}

function restartGame() {
  const ok = confirm("Új játékot indítasz? A jelenlegi állás elveszik.");
  if (!ok) return;
  recordAbandonedGameIfNeeded();
  state = createNewGame();
  recordGameStarted();
  selected = null;
  winModalOpen = false;
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
    showMessage("Ezt a sort nem lehet együtt mozgatni: csak csökkenő, felfordított, eltérő színű sor mozgatható.");
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

function handleFoundationClick(suitId) {
  if (state.won) return;

  if (selected) {
    if (selected.source === "foundation" && selected.suitId === suitId) {
      clearSelection();
      return;
    }
    moveToFoundation(suitId);
    return;
  }

  selectFromFoundation(suitId);
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
      ? `${cardName(moving[0])} nem tehető erre: ${cardName(targetCard)}. Csökkenő sorrend kell, és azonos szín nem kerülhet egymás alá.`
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

function checkWin() {
  return SUITS.every((suit) => state.foundations[suit.id].length === RANKS.length);
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

  const suit = suitMeta(card.suit);
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
        ? renderCard(card, { click: "onclick=\"event.stopPropagation(); selectFromWaste()\"" })
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
      <div class="card-slot foundation-slot ${highlight}" onclick="handleFoundationClick('${suit.id}')">
        ${top ? renderCard(top) : `<span class="foundation-empty"><span class="suit-icon">${suit.icon}</span><small>${suit.name}<br>VII</small></span>`}
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

function formatWinRate() {
  if (!playerStats.gamesStarted) return "0%";
  return `${Math.round((playerStats.gamesWon / playerStats.gamesStarted) * 100)}%`;
}

function renderStats() {
  const completed = SUITS.reduce((sum, suit) => sum + state.foundations[suit.id].length, 0);
  const bestTime = playerStats.bestTime == null ? "–" : formatTime(playerStats.bestTime);
  const bestMoves = playerStats.bestMoves == null ? "–" : playerStats.bestMoves;
  return `
    <section class="stats" aria-label="Játékállapot">
      <div class="stat-card"><span class="stat-label">Lépés</span><span class="stat-value">${state.moves}</span></div>
      <div class="stat-card"><span class="stat-label">Idő</span><span class="stat-value" id="timer">${formatTime(getElapsedSeconds())}</span></div>
      <div class="stat-card"><span class="stat-label">Kész</span><span class="stat-value">${completed}/32</span></div>
      <div class="stat-card"><span class="stat-label">Nyert</span><span class="stat-value">${playerStats.gamesWon}/${playerStats.gamesStarted}</span></div>
      <div class="stat-card"><span class="stat-label">Arány</span><span class="stat-value">${formatWinRate()}</span></div>
      <div class="stat-card"><span class="stat-label">Legjobb</span><span class="stat-value">${bestTime} · ${bestMoves}</span></div>
    </section>
  `;
}

function renderLeaderboard() {
  const entries = normalizeLeaderboard(playerStats.bestTimes);
  return `
    <section class="leaderboard" aria-label="Ranglista">
      <div class="leaderboard-header">
        <h2>Ranglista</h2>
        <span>Legjobb idők</span>
      </div>
      ${entries.length
        ? `<ol class="leaderboard-list">
            ${entries.map((entry) => `
              <li>
                <span class="rank-time">${formatTime(entry.seconds)}</span>
                <span class="rank-meta">${entry.moves} lépés · ${formatDate(entry.wonAt)}</span>
              </li>
            `).join("")}
          </ol>`
        : `<p class="leaderboard-empty">Még nincs nyertes játék. Az első győzelem után ide kerülnek a legjobb idők.</p>`}
    </section>
  `;
}

function renderWinModal() {
  const open = state.won && winModalOpen;
  return `
    <div class="modal-backdrop ${open ? "open" : ""}">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <h2 id="win-title">Megnyerted! 🎉</h2>
        <p>Az összes magyar kártya a gyűjtőpaklikba került. Lépések: <strong>${state.moves}</strong>, idő: <strong>${formatTime(getElapsedSeconds())}</strong>.</p>
        <p class="modal-small">Legjobb időd: <strong>${playerStats.bestTime == null ? "–" : formatTime(playerStats.bestTime)}</strong>, legkevesebb lépésed: <strong>${playerStats.bestMoves ?? "–"}</strong>, aktuális sorozat: <strong>${playerStats.currentStreak}</strong>.</p>
        <div class="modal-actions">
          <button class="btn" onclick="closeWinModal()">Bezárás</button>
          <button class="btn primary" onclick="restartGame()">Új</button>
        </div>
      </div>
    </div>
  `;
}

function closeWinModal() {
  winModalOpen = false;
  render();
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
  app.innerHTML = `
    <main class="app-shell">
      <header class="header">
        <div class="title-wrap">
          <h1>Magyar Passziánsz</h1>
          <p class="subtitle">32 lapos magyar kártyás passziánsz. Gyűjtsd fel színenként VII-től Ászig; oszlopban azonos szín nem kerülhet egymás alá.</p>
        </div>
        <div class="toolbar">
          <button class="btn primary" onclick="restartGame()">Új</button>
          <button class="btn" onclick="undoMove()" ${state.history.length ? "" : "disabled"}>Vissza</button>
        </div>
      </header>

      ${renderInstallBanner()}
      ${renderStats()}

      <section class="board">
        <div class="top-row">
          ${renderStock()}
          ${renderWaste()}
          <div class="spacer"></div>
          ${SUITS.map(renderFoundation).join("")}
        </div>
        ${renderTableau()}
      </section>

      <p class="message" aria-live="polite">${escapeHtml(message)}</p>
      ${renderLeaderboard()}
      ${renderWinModal()}
    </main>
  `;
  updateInstallBanner();
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

window.addEventListener("pagehide", saveGame);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});

setInterval(() => {
  const timer = document.querySelector("#timer");
  if (timer && !state.won) timer.textContent = formatTime(getElapsedSeconds());
}, 1000);

window.drawFromStock = drawFromStock;
window.selectFromWaste = selectFromWaste;
window.selectFromFoundation = selectFromFoundation;
window.handleFoundationClick = handleFoundationClick;
window.selectFromTableau = selectFromTableau;
window.moveToTableau = moveToTableau;
window.moveToFoundation = moveToFoundation;
window.restartGame = restartGame;
window.undoMove = undoMove;
window.installApp = installApp;
window.clearSelection = clearSelection;
window.closeWinModal = closeWinModal;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=ranglista", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        console.info("A service worker regisztráció nem sikerült. Helyi file:// megnyitásnál ez normális.");
      });
  });
}

render();
