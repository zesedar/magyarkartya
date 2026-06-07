const STORAGE_KEY = "magyar-passziansz-v7-ostrom";
const STATS_KEY = "magyar-passziansz-stats-v3";
const MODE_KEY = "magyar-passziansz-mode-v3";
const HISTORY_LIMIT = 80;
const LEADERBOARD_LIMIT = 10;

const CARD_ASSET_DIR = "assets/cards-webp";
const CARD_ASSET_EXT = "webp";

const SUITS = [
  { id: "piros", name: "Piros", icon: "♥", className: "red-suit", assetSuit: "heart", group: "meleg" },
  { id: "tok", name: "Tök", icon: "♦", className: "bell-suit", assetSuit: "bell", group: "meleg" },
  { id: "zold", name: "Zöld", icon: "♣", className: "green-suit", assetSuit: "leaf", group: "hideg" },
  { id: "makk", name: "Makk", icon: "♠", className: "neutral-suit", assetSuit: "acorn", group: "hideg" },
];

const RANKS = ["VII", "VIII", "IX", "X", "Alsó", "Felső", "Király", "Ász"];
const RANK_ASSET_NAMES = ["seven", "eight", "nine", "ten", "unter", "ober", "king", "ace"];
const CARD_BACK_IMAGE = `${CARD_ASSET_DIR}/back.${CARD_ASSET_EXT}`;
const FOUNDATION_START = 0;
const ACE_INDEX = 7;
const KING_INDEX = 6;
const OSTROM_FREE_CELLS = 2;
const DEFAULT_MODE = "ostrom";

const MODES = {
  classic: {
    id: "classic",
    name: "Magyar Passziánsz",
    shortName: "Klasszikus",
    description: "Gyűjtsd fel színenként VII-től Ászig; oszlopban azonos szín nem kerülhet egymás alá.",
  },
  ostrom: {
    id: "ostrom",
    name: "Ostrom – Nehéz",
    shortName: "Ostrom – Nehéz",
    description: "8 nyílt oszlop, 2 szabad cella, váltott csoportos építés; üres oszlopra csak Ász vagy Király kerülhet.",
  },
};

const app = document.querySelector("#app");
let deferredInstallPrompt = null;
let playerStats = loadStats();
let state = loadGame();
if (!state) {
  state = createNewGame();
  recordGameStarted();
}
let selected = null;
let message = isOstromMode()
  ? "Ostrom indult. Szabadítsd ki a VII-eseket, de óvatosan bánj a két cellával."
  : "Válassz egy lapot, majd kattints a célhelyre.";
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

function createNewGame(mode = loadModePreference()) {
  const normalizedMode = normalizeMode(mode);
  return normalizedMode === "ostrom" ? createNewOstromGame() : createNewClassicGame();
}

function createNewClassicGame() {
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
    mode: "classic",
    tableau,
    stock: deck.slice(cursor).map((card) => ({ ...card, faceUp: false })),
    waste: [],
    freeCells: [],
    foundations: createEmptyFoundations(),
    moves: 0,
    startedAt: createdAt,
    elapsedBeforeLoad: 0,
    history: [],
    won: false,
    lost: false,
    createdAt,
    gameId: `${createdAt}-classic-${Math.random().toString(36).slice(2, 10)}`,
  };
}

function createNewOstromGame() {
  const deck = shuffle(createDeck());
  const tableau = Array.from({ length: 8 }, () => []);
  let cursor = 0;

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      tableau[column].push({ ...deck[cursor], faceUp: true });
      cursor += 1;
    }
  }

  const createdAt = Date.now();
  return {
    mode: "ostrom",
    tableau,
    stock: [],
    waste: [],
    freeCells: Array.from({ length: OSTROM_FREE_CELLS }, () => null),
    foundations: createEmptyFoundations(),
    moves: 0,
    startedAt: createdAt,
    elapsedBeforeLoad: 0,
    history: [],
    won: false,
    lost: false,
    createdAt,
    gameId: `${createdAt}-ostrom-${Math.random().toString(36).slice(2, 10)}`,
  };
}

function createEmptyFoundations() {
  return Object.fromEntries(SUITS.map((suit) => [suit.id, []]));
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
  state.lost = checkLost();

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
    parsed.mode = normalizeMode(parsed.mode || loadModePreference());
    if (!Array.isArray(parsed.tableau)) return null;
    parsed.startedAt = Date.now();
    parsed.history = Array.isArray(parsed.history)
      ? parsed.history.filter((entry) => entry && Array.isArray(entry.tableau))
      : [];
    parsed.stock = Array.isArray(parsed.stock) ? parsed.stock : [];
    parsed.waste = Array.isArray(parsed.waste) ? parsed.waste : [];
    parsed.freeCells = parsed.mode === "ostrom" ? normalizeFreeCells(parsed.freeCells) : [];
    parsed.foundations = normalizeFoundations(parsed.foundations);
    parsed.won = Boolean(parsed.won);
    parsed.lost = Boolean(parsed.lost);
    parsed.createdAt = parsed.createdAt || Date.now();
    parsed.gameId = parsed.gameId || `${parsed.createdAt}-${parsed.mode}-${Math.random().toString(36).slice(2, 10)}`;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeFoundations(foundations) {
  return Object.fromEntries(SUITS.map((suit) => [suit.id, Array.isArray(foundations?.[suit.id]) ? foundations[suit.id] : []]));
}

function normalizeFreeCells(cells) {
  const normalized = Array.isArray(cells) ? [...cells] : [];
  while (normalized.length < OSTROM_FREE_CELLS) normalized.push(null);
  return normalized.slice(0, OSTROM_FREE_CELLS).map((card) => card || null);
}

function normalizeLeaderboard(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => Number.isFinite(Number(entry.seconds)))
    .map((entry) => ({
      seconds: Math.max(0, Math.floor(Number(entry.seconds))),
      moves: Math.max(0, Math.floor(Number(entry.moves) || 0)),
      mode: normalizeMode(entry.mode || "classic"),
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
          mode: parsed.mode || "classic",
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
  playerStats.completedGameIds[gameId] = { wonAt, moves: state.moves, seconds: finalSeconds, mode: getCurrentMode() };
  playerStats.gamesWon += 1;
  playerStats.currentStreak += 1;
  playerStats.bestStreak = Math.max(playerStats.bestStreak || 0, playerStats.currentStreak);
  playerStats.bestTime = playerStats.bestTime == null ? finalSeconds : Math.min(playerStats.bestTime, finalSeconds);
  playerStats.bestMoves = playerStats.bestMoves == null ? state.moves : Math.min(playerStats.bestMoves, state.moves);
  playerStats.bestTimes = normalizeLeaderboard([
    ...(playerStats.bestTimes || []),
    { seconds: finalSeconds, moves: state.moves, mode: getCurrentMode(), wonAt, gameId },
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

function normalizeMode(mode) {
  return MODES[mode] ? mode : DEFAULT_MODE;
}

function loadModePreference() {
  try {
    return normalizeMode(localStorage.getItem(MODE_KEY) || DEFAULT_MODE);
  } catch {
    return DEFAULT_MODE;
  }
}

function saveModePreference(mode) {
  try {
    localStorage.setItem(MODE_KEY, normalizeMode(mode));
  } catch {
    console.warn("Nem sikerült menteni a játékmódot.");
  }
}

function getCurrentMode() {
  return normalizeMode(state?.mode || DEFAULT_MODE);
}

function getModeMeta(mode = getCurrentMode()) {
  return MODES[normalizeMode(mode)];
}

function isOstromMode(mode = getCurrentMode()) {
  return normalizeMode(mode) === "ostrom";
}

function getCompletedCount(game = state) {
  if (!game?.foundations) return 0;
  return SUITS.reduce((sum, suit) => sum + (Array.isArray(game.foundations[suit.id]) ? game.foundations[suit.id].length : 0), 0);
}

function getFreeCellCount(game = state) {
  return normalizeFreeCells(game.freeCells).filter((card) => !card).length;
}

function getEmptyColumnCount(game = state, ignoredColumnIndex = null) {
  return game.tableau.filter((column, index) => index !== ignoredColumnIndex && column.length === 0).length;
}

function suitGroup(suitId) {
  return suitMeta(suitId)?.group || suitId;
}

function isAlternatingGroup(cardA, cardB) {
  return suitGroup(cardA.suit) !== suitGroup(cardB.suit);
}

function canPlaceOnClassicTableau(movingCard, targetCard) {
  if (!targetCard) return movingCard.rankIndex === ACE_INDEX;
  return targetCard.rankIndex === movingCard.rankIndex + 1 && targetCard.suit !== movingCard.suit;
}

function canMoveClassicStack(stack) {
  if (!stack.length || stack.some((card) => !card.faceUp)) return false;
  for (let i = 1; i < stack.length; i += 1) {
    const upperCard = stack[i - 1];
    const lowerCard = stack[i];
    if (upperCard.rankIndex !== lowerCard.rankIndex + 1) return false;
    if (upperCard.suit === lowerCard.suit) return false;
  }
  return true;
}

function canPlaceOnOstromTableau(movingCard, targetCard) {
  if (!targetCard) return movingCard.rankIndex === ACE_INDEX || movingCard.rankIndex === KING_INDEX;
  return targetCard.rankIndex === movingCard.rankIndex + 1 && isAlternatingGroup(movingCard, targetCard);
}

function canMoveOstromStack(stack) {
  if (!stack.length || stack.some((card) => !card.faceUp)) return false;
  for (let i = 1; i < stack.length; i += 1) {
    const upperCard = stack[i - 1];
    const lowerCard = stack[i];
    if (upperCard.rankIndex !== lowerCard.rankIndex + 1) return false;
    if (!isAlternatingGroup(upperCard, lowerCard)) return false;
  }
  return true;
}

function getOstromMoveCapacity(targetColumnIndex = null) {
  const freeCells = getFreeCellCount();
  const emptyColumns = getEmptyColumnCount(state, targetColumnIndex);
  return (freeCells + 1) * (2 ** emptyColumns);
}

function canMoveOstromStackWithCapacity(stack, targetColumnIndex = null) {
  return canMoveOstromStack(stack) && stack.length <= getOstromMoveCapacity(targetColumnIndex);
}

function canPlaceOnFoundation(card, game = state) {
  const foundation = game.foundations[card.suit] || [];
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
  state.mode = normalizeMode(state.mode || DEFAULT_MODE);
  state.stock = Array.isArray(state.stock) ? state.stock : [];
  state.waste = Array.isArray(state.waste) ? state.waste : [];
  state.freeCells = state.mode === "ostrom" ? normalizeFreeCells(state.freeCells) : [];
  state.foundations = normalizeFoundations(state.foundations);
  state.lost = false;
  winModalOpen = false;
  message = "Visszavontad az előző lépést.";
  selected = null;
  saveGame();
  render();
}

function restartGame(mode = getCurrentMode(), askConfirm = true) {
  const nextMode = normalizeMode(mode);
  const ok = !askConfirm || confirm("Új játékot indítasz? A jelenlegi állás elveszik.");
  if (!ok) return;
  recordAbandonedGameIfNeeded();
  saveModePreference(nextMode);
  state = createNewGame(nextMode);
  recordGameStarted();
  selected = null;
  winModalOpen = false;
  message = nextMode === "ostrom"
    ? "Ostrom – Nehéz indult. Minden lap látszik, de csak két szabad cellád van."
    : "Új játék indult. Sok sikert!";
  saveGame();
  render();
}

function changeMode(mode) {
  const nextMode = normalizeMode(mode);
  if (nextMode === getCurrentMode()) return;
  const ok = confirm(`Átváltasz erre: ${getModeMeta(nextMode).name}? Ez új játékot indít.`);
  if (!ok) {
    render();
    return;
  }
  restartGame(nextMode, false);
}

function drawFromStock() {
  if (state.won || state.lost || isOstromMode()) return;
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

function selectFromTableau(columnIndex, cardIndex) {
  if (state.won || state.lost) return;
  if (isOstromMode()) {
    selectFromOstromTableau(columnIndex, cardIndex);
    return;
  }

  const column = state.tableau[columnIndex];
  const stack = column.slice(cardIndex);
  if (!stack[0]?.faceUp) return;

  if (!canMoveClassicStack(stack)) {
    showMessage("Ezt a sort nem lehet együtt mozgatni: csak csökkenő, felfordított, eltérő színű sor mozgatható.");
    return;
  }
  selected = { source: "tableau", columnIndex, cardIndex, cards: stack.map((card) => card.id) };
  showMessage(`${cardName(stack[0])} kijelölve${stack.length > 1 ? `, ${stack.length} lapos sorral` : ""}.`);
  render();
}

function selectFromOstromTableau(columnIndex, cardIndex) {
  const column = state.tableau[columnIndex];
  const stack = column.slice(cardIndex);
  if (!stack[0]?.faceUp) return;

  if (!canMoveOstromStack(stack)) {
    showMessage("Ez nem mozgatható sor: Ostromban csökkenő sorrend és piros/tök ↔ zöld/makk váltakozás kell.");
    return;
  }

  if (!canMoveOstromStackWithCapacity(stack)) {
    showMessage(`Ez a ${stack.length} lapos sor túl hosszú a mostani mozgástérhez. Szabad cellák/üres oszlopok alapján most legfeljebb ${getOstromMoveCapacity()} lap mozgatható.`);
    return;
  }

  selected = { source: "ostromTableau", columnIndex, cardIndex, cards: stack.map((card) => card.id) };
  showMessage(`${cardName(stack[0])} kijelölve${stack.length > 1 ? `, ${stack.length} lapos ostromsorral` : ""}.`);
  render();
}

function selectFromWaste() {
  if (state.won || state.lost || isOstromMode()) return;
  const card = state.waste[state.waste.length - 1];
  if (!card) return;
  selected = { source: "waste", cards: [card.id] };
  showMessage(`${cardName(card)} kijelölve a dobópakliból.`);
  render();
}

function selectFromFoundation(suitId) {
  if (state.won || state.lost || isOstromMode()) return;
  const foundation = state.foundations[suitId];
  const card = foundation[foundation.length - 1];
  if (!card) return;
  selected = { source: "foundation", suitId, cards: [card.id] };
  showMessage(`${cardName(card)} kijelölve a gyűjtőpakliból.`);
  render();
}

function handleFreeCellClick(cellIndex) {
  if (!isOstromMode() || state.won || state.lost) return;
  const cellCard = state.freeCells[cellIndex];

  if (selected) {
    if (selected.source === "freeCell" && selected.cellIndex === cellIndex) {
      clearSelection();
      return;
    }
    moveToFreeCell(cellIndex);
    return;
  }

  if (!cellCard) {
    showMessage("Ez a szabad cella üres. Ide csak egyetlen lapot tehetsz félre.");
    return;
  }
  selected = { source: "freeCell", cellIndex, cards: [cellCard.id] };
  showMessage(`${cardName(cellCard)} kijelölve a szabad cellából.`);
  render();
}

function handleFoundationClick(suitId) {
  if (state.won || state.lost) return;

  if (isOstromMode()) {
    if (!selected) {
      showMessage("Ostrom – Nehéz módban a gyűjtőből nem lehet visszavenni lapot. Jelölj ki egy lapot az oszlopból vagy cellából.");
      return;
    }
    moveToFoundation(suitId);
    return;
  }

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
  if (selected.source === "freeCell") {
    const card = state.freeCells[selected.cellIndex];
    return card ? [card] : [];
  }
  if (selected.source === "ostromTableau") {
    return state.tableau[selected.columnIndex].slice(selected.cardIndex);
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
  if (selected.source === "freeCell") {
    const card = state.freeCells[selected.cellIndex];
    state.freeCells[selected.cellIndex] = null;
    return [card];
  }
  const column = state.tableau[selected.columnIndex];
  const moving = column.splice(selected.cardIndex);
  if (!isOstromMode()) flipTopIfNeeded(column);
  return moving;
}

function moveToFreeCell(cellIndex) {
  if (!isOstromMode()) return;
  if (!selected) {
    showMessage("Előbb jelölj ki egy lapot.");
    return;
  }
  if (state.freeCells[cellIndex]) {
    showMessage("Ez a szabad cella már foglalt.");
    return;
  }
  const moving = getSelectedCards();
  if (moving.length !== 1) {
    showMessage("Szabad cellába egyszerre csak egy lap tehető.");
    return;
  }
  if (selected.source === "foundation") {
    showMessage("Ostrom – Nehéz módban a gyűjtőből nem lehet visszavenni lapot.");
    return;
  }

  saveHistory();
  const [removed] = removeSelectedCards();
  state.freeCells[cellIndex] = { ...removed, faceUp: true };
  commit(`${cardName(removed)} félretéve a ${cellIndex + 1}. szabad cellába.`);
}

function moveToTableau(targetColumnIndex) {
  if (isOstromMode()) {
    moveToOstromTableau(targetColumnIndex);
    return;
  }

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

  if (!canMoveClassicStack(moving)) {
    showMessage("Ez a kijelölt sor nem mozgatható.");
    return;
  }
  if (!canPlaceOnClassicTableau(moving[0], targetCard)) {
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

function moveToOstromTableau(targetColumnIndex) {
  if (!selected) {
    showMessage("Előbb jelölj ki egy lapot vagy szabályos sort.");
    return;
  }
  if (selected.source === "ostromTableau" && selected.columnIndex === targetColumnIndex) {
    clearSelection();
    return;
  }

  const moving = getSelectedCards();
  if (!moving.length) return;
  const targetColumn = state.tableau[targetColumnIndex];
  const targetCard = targetColumn[targetColumn.length - 1];

  if (!canMoveOstromStack(moving)) {
    showMessage("Ez a kijelölt sor nem mozgatható Ostrom-sorként.");
    return;
  }
  if (!canMoveOstromStackWithCapacity(moving, targetColumnIndex)) {
    showMessage(`Ehhez kevés a mozgástér. Most legfeljebb ${getOstromMoveCapacity(targetColumnIndex)} lapos sor mozgatható ide.`);
    return;
  }
  if (!canPlaceOnOstromTableau(moving[0], targetCard)) {
    showMessage(targetCard
      ? `${cardName(moving[0])} nem tehető erre: ${cardName(targetCard)}. Csökkenő sorrend és piros/tök ↔ zöld/makk váltás kell.`
      : "Üres oszlopra Ostrom – Nehéz módban csak Ász vagy Király kerülhet.");
    return;
  }

  saveHistory();
  const removed = removeSelectedCards();
  state.tableau[targetColumnIndex].push(...removed.map((card) => ({ ...card, faceUp: true })));
  commit("Sikeres ostromlépés az oszlopok között.");
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
  return getCompletedCount() === SUITS.length * RANKS.length;
}

function checkLost() {
  return false;
}

function showMessage(nextMessage) {
  message = nextMessage;
  render();
}

function isSelectedCard(card) {
  return selected?.cards?.includes(card.id);
}

function isValidTargetClassicTableau(index) {
  if (!selected || isOstromMode()) return false;
  const moving = getSelectedCards();
  const target = state.tableau[index];
  return moving.length > 0 && canMoveClassicStack(moving) && canPlaceOnClassicTableau(moving[0], target[target.length - 1]);
}

function isValidTargetOstromTableau(index) {
  if (!selected || !isOstromMode()) return false;
  const moving = getSelectedCards();
  const target = state.tableau[index];
  return moving.length > 0
    && canMoveOstromStack(moving)
    && canMoveOstromStackWithCapacity(moving, index)
    && canPlaceOnOstromTableau(moving[0], target[target.length - 1]);
}

function isValidTargetFoundation(suitId) {
  if (!selected) return false;
  const moving = getSelectedCards();
  return moving.length === 1 && moving[0].suit === suitId && canPlaceOnFoundation(moving[0]);
}

function isValidTargetFreeCell(index) {
  if (!selected || !isOstromMode() || state.freeCells[index]) return false;
  const moving = getSelectedCards();
  return moving.length === 1 && selected.source !== "foundation";
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
  const pile = state.foundations[suit.id] || [];
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

function renderFreeCell(card, cellIndex) {
  const highlight = isValidTargetFreeCell(cellIndex) ? "highlight" : "";
  const selectedCell = selected?.source === "freeCell" && selected.cellIndex === cellIndex;
  return `
    <section>
      <p class="pile-label">Cella ${cellIndex + 1}</p>
      <div class="card-slot free-cell-slot ${highlight} ${selectedCell ? "selected-cell" : ""}" onclick="handleFreeCellClick(${cellIndex})">
        ${card ? renderCard(card) : `<span>Szabad<br>cella</span>`}
      </div>
    </section>
  `;
}

function renderColumnDropZone(columnIndex, label = "Ide rak") {
  const highlight = isOstromMode()
    ? isValidTargetOstromTableau(columnIndex)
    : isValidTargetClassicTableau(columnIndex);
  return `
    <button class="column-drop-zone ${highlight ? "highlight" : ""}" onclick="event.stopPropagation(); moveToTableau(${columnIndex})" aria-label="${columnIndex + 1}. oszlop célhely">
      ${label}
    </button>
  `;
}

function renderClassicTableau() {
  return `
    <section class="tableau classic-tableau" aria-label="Oszlopok">
      ${state.tableau.map((column, columnIndex) => {
        const highlight = isValidTargetClassicTableau(columnIndex) ? "highlight" : "";
        const cards = column.length
          ? `<div class="column-card-stack">${column.map((card, cardIndex) => renderCard(card, {
              extraClass: cardIndex ? "stack-card" : "",
              click: card.faceUp ? `onclick=\"event.stopPropagation(); selectFromTableau(${columnIndex}, ${cardIndex})\"` : "",
            })).join("")}</div>`
          : `<div class="column-empty-hint">Üres<br>Ász</div>`;
        return `
          <div class="column ${highlight}" onclick="moveToTableau(${columnIndex})" aria-label="${columnIndex + 1}. oszlop">
            ${cards}
            ${renderColumnDropZone(columnIndex)}
          </div>
        `;
      }).join("")}
    </section>
  `;
}

function renderOstromTableau() {
  return `
    <section class="tableau ostrom-tableau" aria-label="Ostrom oszlopok">
      ${state.tableau.map((column, columnIndex) => {
        const highlight = isValidTargetOstromTableau(columnIndex) ? "highlight" : "";
        const cards = column.length
          ? `<div class="column-card-stack ostrom-card-stack">${column.map((card, cardIndex) => renderCard(card, {
              extraClass: cardIndex ? "ostrom-stack-card" : "",
              click: `onclick=\"event.stopPropagation(); selectFromTableau(${columnIndex}, ${cardIndex})\"`,
            })).join("")}</div>`
          : `<div class="column-empty-hint">Üres<br>Ász / Király</div>`;
        return `
          <div class="column ostrom-column ${highlight}" onclick="moveToTableau(${columnIndex})" aria-label="${columnIndex + 1}. ostrom oszlop">
            ${cards}
            ${renderColumnDropZone(columnIndex)}
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
  const completed = `${getCompletedCount()}/32`;
  const thirdLabel = isOstromMode() ? "Gyűjtő" : "Kész";
  const fourthLabel = isOstromMode() ? "Cellák" : "Nyert";
  const fourthValue = isOstromMode() ? `${getFreeCellCount()}/${OSTROM_FREE_CELLS}` : `${playerStats.gamesWon}/${playerStats.gamesStarted}`;
  const bestTime = playerStats.bestTime == null ? "–" : formatTime(playerStats.bestTime);
  const bestMoves = playerStats.bestMoves == null ? "–" : playerStats.bestMoves;
  return `
    <section class="stats" aria-label="Játékállapot">
      <div class="stat-card"><span class="stat-label">Lépés</span><span class="stat-value">${state.moves}</span></div>
      <div class="stat-card"><span class="stat-label">Idő</span><span class="stat-value" id="timer">${formatTime(getElapsedSeconds())}</span></div>
      <div class="stat-card"><span class="stat-label">${thirdLabel}</span><span class="stat-value">${completed}</span></div>
      <div class="stat-card"><span class="stat-label">${fourthLabel}</span><span class="stat-value">${fourthValue}</span></div>
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
                <span class="rank-meta">${MODES[entry.mode]?.shortName || "Játék"} · ${entry.moves} lépés · ${formatDate(entry.wonAt)}</span>
              </li>
            `).join("")}
          </ol>`
        : `<p class="leaderboard-empty">Még nincs nyertes játék. Az első győzelem után ide kerülnek a legjobb idők.</p>`}
    </section>
  `;
}

function renderWinModal() {
  const open = state.won && winModalOpen;
  const winText = isOstromMode()
    ? "Az Ostrom összes lapja felkerült a gyűjtőpaklikba."
    : "Az összes magyar kártya a gyűjtőpaklikba került.";
  return `
    <div class="modal-backdrop ${open ? "open" : ""}">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <h2 id="win-title">Megnyerted! 🎉</h2>
        <p>${winText} Lépések: <strong>${state.moves}</strong>, idő: <strong>${formatTime(getElapsedSeconds())}</strong>.</p>
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

function renderClassicBoard() {
  return `
    <section class="board">
      <div class="top-row classic-row">
        ${renderStock()}
        ${renderWaste()}
        <section class="foundation-grid classic-foundations" aria-label="Gyűjtőpaklik">
          ${SUITS.map(renderFoundation).join("")}
        </section>
      </div>
      ${renderClassicTableau()}
    </section>
  `;
}

function renderOstromBoard() {
  return `
    <section class="board ostrom-board">
      <div class="top-row ostrom-row">
        ${state.freeCells.map(renderFreeCell).join("")}
        <section class="foundation-grid ostrom-foundations" aria-label="Gyűjtőpaklik">
          ${SUITS.map(renderFoundation).join("")}
        </section>
      </div>
      <div class="ostrom-rule-box">
        <strong>Ostrom – Nehéz</strong>
        <span>Építés oszlopban: Ász → Király → Felső → Alsó → X → IX → VIII → VII, mindig piros/tök ↔ zöld/makk váltással.</span>
        <span>Üres oszlopra csak Ász vagy Király mehet. Gyűjtő: VII-től Ászig. Gyűjtőből nincs visszavétel.</span>
      </div>
      ${renderOstromTableau()}
    </section>
  `;
}

function render() {
  const mode = getCurrentMode();
  const modeMeta = getModeMeta(mode);
  app.innerHTML = `
    <main class="app-shell ${isOstromMode(mode) ? "ostrom-shell" : ""}">
      <header class="header">
        <div class="title-wrap">
          <h1>${modeMeta.name}</h1>
          <p class="subtitle">32 lapos magyar kártyás passziánsz. ${modeMeta.description}</p>
        </div>
        <div class="toolbar">
          <select class="mode-select" onchange="changeMode(this.value)" aria-label="Játékmód">
            ${Object.values(MODES).map((item) => `<option value="${item.id}" ${item.id === mode ? "selected" : ""}>${item.shortName}</option>`).join("")}
          </select>
          <button class="btn primary" onclick="restartGame()">Új</button>
          <button class="btn" onclick="undoMove()" ${state.history.length ? "" : "disabled"}>Vissza</button>
        </div>
      </header>

      ${renderInstallBanner()}
      ${renderStats()}
      ${isOstromMode(mode) ? renderOstromBoard() : renderClassicBoard()}

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
window.handleFreeCellClick = handleFreeCellClick;
window.selectFromTableau = selectFromTableau;
window.moveToTableau = moveToTableau;
window.moveToFoundation = moveToFoundation;
window.moveToFreeCell = moveToFreeCell;
window.restartGame = restartGame;
window.changeMode = changeMode;
window.undoMove = undoMove;
window.installApp = installApp;
window.clearSelection = clearSelection;
window.closeWinModal = closeWinModal;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=ostrom-dropzone", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        console.info("A service worker regisztráció nem sikerült. Helyi file:// megnyitásnál ez normális.");
      });
  });
}

render();
