// Defense-in-depth only: the CSP ships as a <meta> tag (index.html), and
// frame-ancestors is HTTP-header-only per spec, so this static host can't
// send it. If a third party frames this page anyway, bounce the top frame
// out of the frame. Wrapped because a cross-origin top denies reading/setting
// window.top.location with a SecurityError, and that must not stop the rest
// of the app from loading.
(function bustFraming() {
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location.href;
    }
  } catch (error) {
    // Cross-origin top frame: can't navigate it directly, nothing else to do.
  }
})();

const boardEl = document.getElementById("board");
const playerNameDetectedEl = document.getElementById("player-name-detected");
const sourceBackBtn = document.getElementById("source-back-btn");
const onlineProviderSelectEl = document.getElementById("online-provider-select");
const onlineUserInputEl = document.getElementById("online-user-input");
const onlineStatusEl = document.getElementById("online-status");
const configFilesStatusEl = document.getElementById("config-files-status");
const playerTargetLabelEl = document.getElementById("player-target-label");
const playerTargetHintEl = document.getElementById("player-target-hint");
const analysisTimeMsEl = document.getElementById("analysis-time-ms");
const thresholdEl = document.getElementById("error-threshold");
const scoringSystemEl = document.getElementById("scoring-system");
const scoringSystemHintEl = document.getElementById("scoring-system-hint");
const gameFormatEl = document.getElementById("game-format");
const gameFormatHintEl = document.getElementById("game-format-hint");
const duelConfigEl = document.getElementById("duel-config");
const duelPlayerAEl = document.getElementById("duel-player-a");
const duelPlayerBEl = document.getElementById("duel-player-b");
const turnTimeSecondsEl = document.getElementById("turn-time-seconds");
const analyzeBtn = document.getElementById("analyze-btn");
const analysisStatusEl = document.getElementById("analysis-status");
const analysisMetricsEl = document.getElementById("analysis-metrics");
const analysisProgressWrapEl = document.getElementById("analysis-progress-wrap");
const analysisProgressBarEl = document.getElementById("analysis-progress-bar");
const analysisProgressLabelEl = document.getElementById("analysis-progress-label");
const setupPanelEl = document.getElementById("setup-panel");
const sessionSizeEl = document.getElementById("session-size");
const sessionHintEl = document.getElementById("session-hint");
const wizardStepIndicatorEl = document.getElementById("wizard-step-indicator");
const wizardProgressBarEl = document.getElementById("wizard-progress-bar");
const wizardStep1El = document.getElementById("wizard-step-1");
const wizardStep2El = document.getElementById("wizard-step-2");
const wizardStep3El = document.getElementById("wizard-step-3");
const wizardStepEls = [wizardStep1El, wizardStep2El, wizardStep3El];
const wizardPrevBtn = document.getElementById("wizard-prev-btn");
const wizardNextBtn = document.getElementById("wizard-next-btn");
const wizardModeGroupEl = document.getElementById("wizard-mode-group");
const wizardModeSoloBtn = document.getElementById("wizard-mode-solo");
const wizardModeDuelBtn = document.getElementById("wizard-mode-duel");
const wizardModeGroupEls = [wizardModeSoloBtn, wizardModeDuelBtn].filter(Boolean);
const wizardPlatformGroupEl = document.getElementById("wizard-platform-group");
const wizardProviderLichessBtn = document.getElementById("wizard-provider-lichess");
const wizardProviderChessComBtn = document.getElementById("wizard-provider-chesscom");
const wizardPlatformGroupEls = [wizardProviderLichessBtn, wizardProviderChessComBtn].filter(Boolean);
const wizardSizeChipEls = Array.from(document.querySelectorAll(".wizard-size-chip[data-size]"));
const wizardTimerChipEls = Array.from(document.querySelectorAll(".wizard-timer-chip[data-seconds]"));
const wizardStepErrorEl = document.getElementById("wizard-step-error");
const wizardSourceErrorEl = document.getElementById("wizard-source-error");
const wizardSourceCtaEl = document.getElementById("wizard-source-cta");
const wizardRetryUserBtn = document.getElementById("wizard-retry-user-btn");
const wizardSwitchPlatformBtn = document.getElementById("wizard-switch-platform-btn");
const wizardClearCacheBtn = document.getElementById("wizard-clear-cache-btn");
const wizardClearCacheStatusEl = document.getElementById("wizard-clear-cache-status");
const wizardSummaryEl = document.getElementById("wizard-summary");
const wizardSummaryBoxEl = document.getElementById("wizard-summary-box");
// En pantallas anchas el resumen es una columna fija al costado, así que se
// mantiene siempre desplegado; en teléfono es un bloque que se puede plegar.
const wizardWideScreenQuery = typeof window.matchMedia === "function"
  ? window.matchMedia("(min-width: 921px)")
  : null;

// Bajo este ancho el tablero, las tarjetas de jugador y el resultado se apilan
// en una sola columna.
const oneColumnGameQuery = typeof window.matchMedia === "function"
  ? window.matchMedia("(max-width: 1080px)")
  : null;

const gameLayoutEl = document.getElementById("game-layout");
const leftPlayerPanelEl = document.getElementById("left-player-panel");
const rightPlayerPanelEl = document.getElementById("right-player-panel");
const playerAKickerEl = document.getElementById("player-a-kicker");
const playerBKickerEl = document.getElementById("player-b-kicker");
const playerANameEl = document.getElementById("player-a-name");
const playerBNameEl = document.getElementById("player-b-name");
const playerAAvatarEl = document.getElementById("player-a-avatar");
const playerBAvatarEl = document.getElementById("player-b-avatar");
const playerAScoreLabelEl = document.getElementById("player-a-score-label");
const playerBScoreLabelEl = document.getElementById("player-b-score-label");
const playerAScoreValueEl = document.getElementById("player-a-score-value");
const playerBScoreValueEl = document.getElementById("player-b-score-value");
const boardActionsSlotEl = document.getElementById("board-actions-slot");
const playerAActionsSlotEl = document.getElementById("player-a-actions-slot");
const playerBActionsSlotEl = document.getElementById("player-b-actions-slot");
const sharedActionsEl = document.getElementById("shared-actions");
const handoffOverlayEl = document.getElementById("handoff-overlay");
const handoffOverlayTitleEl = document.getElementById("handoff-overlay-title");
const handoffOverlaySubtitleEl = document.getElementById("handoff-overlay-subtitle");
const positionSearchOverlayEl = document.getElementById("position-search-overlay");
const positionSearchTitleEl = document.getElementById("position-search-title");
const positionSearchMetaEl = document.getElementById("position-search-meta");
const positionSearchProgressEl = document.getElementById("position-search-progress");
const positionSearchProgressBarEl = document.getElementById("position-search-progress-bar");
const positionSearchProgressLabelEl = document.getElementById("position-search-progress-label");
const positionSearchProgressAnnounceEl = document.getElementById("position-search-progress-announce");
const positionSearchFactsEl = document.getElementById("position-search-facts");
const analysisFactsEl = document.getElementById("analysis-facts");
const hintBtn = document.getElementById("hint-btn");
const sessionTitleEl = document.getElementById("session-title");
const positionSearchCancelBtnEl = document.getElementById("position-search-cancel-btn");
const promotionPickerEl = document.getElementById("promotion-picker");
const promotionChoiceEls = ["q", "r", "b", "n"].map((code) => document.getElementById(`promotion-choice-${code}`));
const soloClockRailEl = document.getElementById("solo-clock-rail");
const soloClockValueEl = document.getElementById("solo-clock-value");
const soloClockBarEl = document.getElementById("solo-clock-bar");
const soloClockAnnounceEl = document.getElementById("solo-clock-announce");
const resultOverlayEl = document.getElementById("result-overlay");
const resultOverlayInnerEl = document.getElementById("result-overlay-inner");
const resultOverlayTitleEl = document.getElementById("result-overlay-title");
const resultOverlayHeaderEl = document.querySelector(".result-overlay-header");
const resultOverlayPointsEl = document.getElementById("result-overlay-points");
const consentOverlayEl = document.getElementById("consent-overlay");
const consentOverlayTitleEl = document.getElementById("consent-overlay-title");
const consentOverlayBodyEl = document.getElementById("consent-overlay-body");
const consentOverlayAcceptBtn = document.getElementById("consent-overlay-accept");
const consentOverlayCancelBtn = document.getElementById("consent-overlay-cancel");
const consentOverlayUsernameLabelEl = document.getElementById("consent-overlay-username-label");
const consentOverlayUsernameInputEl = document.getElementById("consent-overlay-username-input");
const consentOverlayErrorEl = document.getElementById("consent-overlay-error");
const revealBestBtn = document.getElementById("reveal-best-btn");
const revealGameBtn = document.getElementById("reveal-game-btn");
const resultAnalysisBtn = document.getElementById("result-analysis-btn");
const resultAnalysisResetBtn = document.getElementById("result-analysis-reset-btn");
const boardArrowsEl = document.getElementById("board-arrows");
const roundStatusEl = document.getElementById("round-status");
const roundTurnEl = document.getElementById("round-turn");
const sessionProgressEl = document.getElementById("session-progress");
const soloProgressLineEl = document.getElementById("solo-progress-line");
const roundResultEl = document.getElementById("round-result");
const roundResultPanelEl = document.getElementById("round-result-panel");
const scorePanelEl = document.getElementById("score-panel");
const competitiveStatusEl = document.getElementById("competitive-status");
const scoreLabelEl = document.getElementById("score-label");
const scoreEl = document.getElementById("score");
const historyEl = document.getElementById("history");
const nextBtn = document.getElementById("next-btn");
const skipBtn = document.getElementById("skip-btn");
const restartBtn = document.getElementById("restart-btn");
const gameDetailsMiniEl = document.getElementById("game-details-mini");
const sessionSummaryResultEl = document.getElementById("session-summary-result");
const summaryScoreDisplayEl = document.querySelector(".summary-score-display");
const summaryDetailsTextEl = document.querySelector(".summary-details-text");
const summaryMenuBtn = document.getElementById("summary-menu-btn");
const languageSwitchEl = document.getElementById("language-switch");
const languageBtnEs = document.getElementById("language-btn-es");
const languageBtnEn = document.getElementById("language-btn-en");
const languageGroupEls = [languageBtnEs, languageBtnEn].filter(Boolean);

const INTERNAL_ANALYSIS_DEPTH = 3;
const DEFAULT_SCORING_SYSTEM = "simple_labels_v1";
const DEFAULT_CITIZEN_THRESHOLD = 80;
const DEFAULT_CITIZEN_MOVETIME = 250;
const DEFAULT_CITIZEN_SESSION_SIZE = 10;
const DEFAULT_TURN_TIME_SECONDS = 90;
const MIN_TURN_TIME_SECONDS = 5;
const MAX_TURN_TIME_SECONDS = 360;
const MIN_LEGAL_MOVES_FOR_CANDIDATE = 3;
const LOCAL_FALLBACK_MAX_DEPTH = 3;
// The strong engine is a 7 MB download, so give it room on a slow connection
// and retry rather than falling back to the shallow local one for good.
const ENGINE_READY_TIMEOUT_MS = 30000;
const ENGINE_LOAD_ATTEMPTS = 3;
const ENGINE_RETRY_BASE_MS = 1500;
// How long a starting session waits for it before playing on the local engine
// while the download keeps going in the background.
const ENGINE_SESSION_WAIT_MS = 25000;
// Scoring a round (docs/SCORING.md): the wait for the engine is kept short. The
// overlay stays up long enough not to flash, and never longer than that just to
// give someone something to read (the round's curiosity waits in the result).
const MIN_ROUND_EVAL_VISIBLE_MS = 1200;
// One search per position is `Settings.engineBudget().movetimeMs` scaled by how
// hard the position is; the whole evaluation of a round (reference search + the
// answers + the game move) is capped so a "deep" preset cannot make it endless.
const ROUND_EVAL_HARD_CAP_MS = 10000;
const ROUND_EVAL_MIN_SEARCH_MS = 300;
const ROUND_EVAL_MAX_SEARCH_MS = 3500;
const ROUND_EVAL_MULTIPLIER_MIN = 0.8;
const ROUND_EVAL_MULTIPLIER_MAX = 1.6;
const DEFAULT_ANALYSIS_MS = 1000;
const ANALYSIS_CACHE_MAX = 300;
// Points are 0..10 per position (Ludus.Scoring). A "hit" is an answer that is the
// engine's best move (or equivalent) or has accuracy >= HIT_ACCURACY, the same
// bar Profile uses to pass a notebook review; a revealed answer is never a hit.
const POINTS_PER_POSITION = 10;
const HIT_ACCURACY = 70;
const RECENT_FACTS_MAX = 12;
// A short evaluation must not flash a carousel; only a wait that really drags on gets one.
const OVERLAY_FACTS_DELAY_MS = 900;
const MISTAKE_SEARCH_TIME_BUDGET_MS = 25000;
const MISTAKE_SEARCH_CANDIDATE_BUDGET = 400;
const CLOCK_TICK_MS = 100;
const LANGUAGE_STORAGE_KEY = "ludus.language";
// First-visit flag: the landing page is only for someone who has never been here.
const SEEN_STORAGE_KEY = "ludus.seen.v1";
// Opt-out for keeping downloaded games in IndexedDB across visits (see
// loadNoPersistDownloadsPreference). Defaults to off so existing behavior
// (7-day cache) is unchanged unless a person explicitly turns it on.
const NO_PERSIST_DOWNLOADS_STORAGE_KEY = "ludus.noPersistDownloads.v1";
const REMOTE_PGN_CACHE_DB = "ludus.remotePgnCache.v1";
const REMOTE_PGN_CACHE_STORE = "pgn";
const REMOTE_PGN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REMOTE_FETCH_TIMEOUT_MS = 15000;
const REMOTE_FETCH_RETRIES = 2;
// A year of PGN (Lichess) or a month of JSON archives (Chess.com) for one
// person is normally a few hundred KB to a few MB; 20 MB is generous enough
// for a very active player while still bounding memory/CPU if a provider
// response is corrupted, disproportionate, or hostile.
const REMOTE_RESPONSE_MAX_BYTES = 20 * 1024 * 1024;
// Chess.com download session controls (see fetchChessComPgn): a hard wall
// clock budget across every month/pass, and how long the whole browser
// session gets before an in-flight download is aborted.
const CHESSCOM_DOWNLOAD_BUDGET_MS = 75000;
const SUPPORTED_LANGUAGES = ["es", "en"];
const TRANSLATIONS = {
  es: {
    "meta.title": "Ludus Scaccorum - Entrenamiento de Errores",
    "landing.description": "Entrená cálculo, evaluación y toma de decisiones encontrando mejores jugadas en posiciones reales.",
    "buttons.start": "Comenzar",
    "buttons.backHome": "Volver al inicio",
    "buttons.previous": "Anterior",
    "buttons.next": "Siguiente",
    "buttons.startSession": "Comenzar sesión",
    "buttons.retryUser": "Probar otro usuario",
    "buttons.switchPlatform": "Cambiar plataforma",
    "buttons.revealBest": "Ver la mejor",
    "buttons.revealGame": "Ver la partida",
    "buttons.revealPlayedBy": "Ver la que jugó {name}",
    "buttons.exploreBoard": "Explorar tablero",
    "buttons.analysisActive": "Exploración activa",
    "buttons.resetAnalysis": "Reiniciar análisis",
    "buttons.nextPosition": "Siguiente posición",
    "buttons.backToMenu": "Volver al inicio",
    "buttons.skipMove": "Omitir jugada (0 pts)",
    "buttons.restartMenu": "Volver al inicio",
    "buttons.cancelSearch": "Cancelar búsqueda",
    "confirm.restartTitle": "¿Volver al inicio?",
    "confirm.restartToSetup": "Si volvés al inicio se borran las posiciones de esta sesión y el puntaje acumulado. ¿Volver igual?",
    "confirm.restartAccept": "Volver al inicio",
    "confirm.restartCancel": "Seguir jugando",
    "wizard.title": "Configuración guiada",
    "wizard.heading": "Armemos tu sesión en 3 pasos",
    "wizard.stepIndicator": "Paso {step} de {total}",
    "wizard.step1.question": "¿Cómo querés jugar?",
    "wizard.step1.ariaLabel": "Modo de juego",
    "wizard.step1.solo": "Jugar solo/a",
    "wizard.step1.duel": "Jugar contra alguien",
    "wizard.step1.duelHint": "Se turnan en este mismo dispositivo",
    "wizard.step1.duelExplainer": "Van a compartir este dispositivo: cada uno juega su turno y comparan el puntaje al final.",
    "wizard.step1.player1Label": "Nombre Jugador 1",
    "wizard.step1.player2Label": "Nombre Jugador 2",
    "wizard.step2.question": "¿De dónde traemos tus partidas?",
    "wizard.step2.help": "Vamos a descargar partidas públicas del último año para encontrar posiciones.",
    "wizard.step2.howItWorks": "¿Cómo funciona?",
    "wizard.step2.howItWorksBody": "Buscamos tus partidas recientes de ritmo lento (clásico y rápido). Si no alcanzan, sumamos partidas de blitz. Descargamos sólo hasta juntar las posiciones que pediste.",
    "wizard.step2.platformAriaLabel": "Plataforma",
    "wizard.step2.lichess": "Lichess",
    "wizard.step2.chesscom": "Chess.com",
    "wizard.step2.usernameLabel": "Nombre de usuario",
    "wizard.step2.enterUsername": "Ingresá tu usuario para continuar.",
    "wizard.step2.clearCache": "Borrar datos guardados de partidas",
    "wizard.step2.clearCacheConfirm": "Tocá de nuevo para borrar",
    "wizard.step2.clearCacheDone": "Se borraron las partidas guardadas en este navegador.",
    "wizard.step3.question": "¿Cuántas posiciones querés jugar hoy?",
    "wizard.step3.ariaLabel": "Cantidad de posiciones",
    "wizard.step3.positions5": "5 posiciones",
    "wizard.step3.positions10": "10 posiciones",
    "wizard.step3.positions20": "20 posiciones",
    "wizard.step3.customCount": "Personalizado (1 a 200)",
    "wizard.step3.timerLabel": "Tiempo por ronda",
    "wizard.step3.timerAriaLabel": "Tiempo por ronda",
    "wizard.step3.timerCustom": "Personalizado (5 a 360 segundos)",
    "wizard.step3.sessionSummary": "Resumen de la sesión",
    "wizard.step3.analysisPrompt": "Tocá “Comenzar sesión” para buscar errores.",
    "wizard.validation.chooseMode": "Elegí si querés jugar solo/a o contra alguien.",
    "wizard.validation.fillDuelNames": "Completá ambos nombres para el duelo.",
    "wizard.validation.duelNameMax": "Los nombres del duelo pueden tener hasta 20 caracteres.",
    "wizard.validation.choosePlatform": "Elegí Lichess o Chess.com.",
    "wizard.validation.enterUsername": "Ingresá tu nombre de usuario para continuar.",
    "wizard.validation.invalidUsername": "El usuario debe tener 3 a 30 caracteres (letras, números, _ o -).",
    "wizard.validation.chooseCount": "Elegí una cantidad entre 1 y 200 posiciones.",
    "wizard.validation.ready": "Configuración lista para comenzar la sesión.",
    "wizard.status.currentStep": "Configurá el paso actual para continuar.",
    "wizard.status.answerQuestions": "Respondé las preguntas para preparar tu sesión.",
    "wizard.status.nextSession": "Configurá tu próxima sesión paso a paso.",
    "wizard.status.modeSourceOptions": "Configurá modo, fuente y opciones de análisis.",
    "wizard.status.nextStep": "Perfecto. Seguimos con el siguiente paso.",
    "wizard.status.sourceStep": "Perfecto. Seguimos con la fuente de partidas.",
    "compat.gameFormat.solo": "Modo estudio (1 jugador)",
    "compat.gameFormat.duel": "Modo duelo (2 jugadores)",
    "players.default1": "Jugador 1",
    "players.default2": "Jugador 2",
    "players.soloSession": "Tu sesión",
    "players.kicker1": "Jugador 1",
    "players.kicker2": "Jugador 2",
    "players.targetLabel": "Usuario objetivo del análisis",
    "players.targetHint": "Usaremos este usuario para seleccionar posiciones.",
    "players.enterUserContinue": "Ingresá el usuario para continuar.",
    "players.notDetected": "No detectado",
    "players.genericUser": "usuario",
    "labels.scoreTitle": "Puntaje",
    "labels.clockTitle": "Reloj",
    "labels.clockMilestone": "Quedan {seconds} segundos.",
    "labels.clockTimeUp": "Se acabó el tiempo.",
    "labels.positionsEvaluatedTitle": "Posiciones evaluadas",
    "result.title": "Resultado",
    "result.pending": "Todavía no hay jugada evaluada.",
    "result.boardToolsLabel": "Herramientas del tablero",
    "score.totalPoints": "Puntos totales",
    "score.duelScore": "Marcador duelo",
    "scoring.system.simple.label": "Precisión (0 a 10)",
    "scoring.system.simple.description": "Cuanto más cerca esté tu jugada de la mejor del motor, más puntos: hasta 10 por posición.",
    "quality.no_move": "Sin jugada",
    "quality.perfect": "Perfecta",
    "quality.very_good": "Muy buena",
    "quality.good": "Buena",
    "quality.interesting": "Interesante",
    "quality.dubious": "Dudosa",
    "quality.bad": "Mala",
    "quality.blunder": "Error grave",
    "common.notAvailable": "No disponible",
    "common.unknown": "desconocido",
    "common.searching": "Pensando...",
    "common.gameFallback": "Partida",
    "common.playersUnavailable": "Jugadores no disponibles",
    "common.white": "Blancas",
    "common.black": "Negras",
    "board.ariaLabel": "Tablero de ajedrez",
    "board.squareLabel": "{square}: {piece}{state}",
    "board.empty": "vacía",
    "board.selected": ", seleccionada",
    "board.legalTarget": ", destino legal",
    "board.captureTarget": ", captura legal",
    "board.disabled": ", no interactiva",
    "piece.whitePawn": "peón blanco",
    "piece.whiteKnight": "caballo blanco",
    "piece.whiteBishop": "alfil blanco",
    "piece.whiteRook": "torre blanca",
    "piece.whiteQueen": "dama blanca",
    "piece.whiteKing": "rey blanco",
    "piece.blackPawn": "peón negro",
    "piece.blackKnight": "caballo negro",
    "piece.blackBishop": "alfil negro",
    "piece.blackRook": "torre negra",
    "piece.blackQueen": "dama negra",
    "piece.blackKing": "rey negro",
    "promotion.chooseTitle": "Elegí a qué pieza coronar",
    "common.sourceError": "No pudimos obtener partidas de ese usuario. Revisá el nombre o cambiá de plataforma.",
    "common.sourceErrorWithDetail": "No pudimos obtener partidas de ese usuario. Revisá el nombre o cambiá de plataforma. ({error})",
    "network.timeout": "La conexión tardó demasiado. Probá de nuevo en unos segundos.",
    "network.failed": "No se pudo conectar con el proveedor. Probá de nuevo o usá la última base guardada si existe.",
    "network.rateLimited": "El proveedor limitó las consultas. Esperá un momento antes de reintentar.",
    "network.responseTooLarge": "La respuesta del proveedor es demasiado grande y fue rechazada por seguridad. Probá de nuevo más tarde.",
    "network.cancelled": "Descarga cancelada.",
    "privacy.remoteFetchConfirm": "Vamos a pedirle a {provider} las partidas públicas de {user}. El pedido sale desde tu navegador directamente hacia ese sitio: esta app no tiene servidor propio. Vamos a guardar en este navegador el texto de esas partidas, tu nombre de usuario y algunos datos de cada partida (resultado, fecha) durante hasta 7 días, para no tener que volver a descargarlos la próxima vez; podés borrarlos cuando quieras con “Borrar datos guardados de partidas”. En una computadora compartida, cualquier otra persona que use este navegador podría ver esos datos durante esos 7 días. ¿Continuar?",
    "privacy.remoteFetchCancelled": "Consulta cancelada. No se enviaron datos al proveedor.",
    "privacy.remoteFetchTitle": "Consultar partidas públicas",
    "privacy.remoteFetchAccept": "Aceptar",
    "privacy.remoteFetchCancel": "Cancelar",
    "privacy.remoteFetchUsernameLabel": "Volvé a escribir el usuario para confirmar",
    "privacy.remoteFetchUsernameMismatch": "El usuario no coincide. Escribilo exactamente igual para confirmar.",
    "provider.usingCachedBase": "Usando base guardada de {provider} para {user}: {games} partida(s).",
    "provider.throttleWait": "Esperá {seconds} segundo(s) antes de descargar partidas de nuevo. Así no sobrecargamos el servicio.",
    "provider.throttleHourly": "Ya se descargaron partidas {max} veces en la última hora. Probá de nuevo en unos {minutes} minuto(s).",
    "provider.usingStaleCachedBase": "No pudimos actualizar la base. Usando la última base guardada de {provider} para {user}: {games} partida(s).",
    "time.classical": "Clásico",
    "time.rapid": "Rápido",
    "time.daily": "Diario",
    "time.blitz": "Blitz",
    "time.bullet": "Bullet",
    "evaluation.mateIn": "Mate en {ply}",
    "evaluation.getsMatedIn": "Recibe mate en {ply}",
    "evaluation.deltaUnavailable": "No disponible",
    "evaluation.deltaEqual": "Igual",
    "evaluation.deltaMateBetter": "Mejor (mate/casi mate)",
    "evaluation.deltaMateWorse": "Peor (mate/casi mate)",
    "evaluation.deltaBetter": "+{delta} cp (mejor)",
    "evaluation.deltaWorse": "{delta} cp (peor)",
    "evaluation.moduleBest": "Mejor del módulo",
    "evaluation.gameLine": "Partida",
    "evaluation.yourMove": "Tu jugada",
    "evaluation.historyPosition": "Posición {round}",
    "evaluation.historyModule": "Módulo",
    "evaluation.historyGame": "Partida",
    "evaluation.historyYourMove": "Tu jugada",
    "evaluation.historyEmpty": "Sin posiciones jugadas.",
    "evaluation.classification": "Clasificación",
    "evaluation.delta": "Delta",
    "evaluation.points": "Puntos",
    "evaluation.timeoutZeroPoints": "Tiempo agotado: 0 puntos.",
    "evaluation.noMoveZeroPoints": "No hubo jugada: 0 puntos.",
    "evaluation.timeoutZeroPts": "Tiempo agotado: 0 pts.",
    "evaluation.noMoveMadeZeroPts": "No hiciste jugada: 0 pts.",
    "evaluation.bestPrefix": "Mejor: {san}",
    "evaluation.gamePrefix": "Partida: {san}",
    "game.searchingNext": "Buscando próxima posición...",
    "game.positionFound": "Posición encontrada",
    "game.handoff.genericTitle": "Cambio de turno",
    "game.handoff.genericSubtitle": "Toca para revelar",
    "game.handoff.title": "Turno de {player}",
    "game.handoff.subtitle": "Toca para revelar",
    "game.infoCitizen": "{players} | {event} {year} | Movida {move}",
    "game.infoEngineer": "{players} | {event} {year} | ECO {eco} | Resultado {result} | Movida {move}",
    "game.positionMeta": "{players} · Resultado {result} · Jugada {move} · Año {year}",
    "game.progressSolo": "Posiciones evaluadas: {played} / {target} · Restan: {remaining}",
    "game.progressDuel": "Ronda {round}/{target} · Restan: {remaining} · Aciertos: {p1} {p1Hits} - {p2Hits} {p2}",
    "game.roundSolo": "Posición {current}/{target}",
    "game.roundReview": "Revisión · {label}",
    "game.turnWhite": "Juegan las blancas",
    "game.turnBlack": "Juegan las negras",
    "game.turnPlayer": "Juega {player} ({turn}/2)",
    "game.duelCompetitive": "Duelo local · {seconds}s por turno · {system}",
    "game.duelHint": "Competitivo local: ambos jugadores reciben exactamente las mismas posiciones y tiempo.",
    "game.soloHint": "Entrenamiento individual con puntaje total acumulado.",
    "game.studyMode": "Modo estudio",
    "game.localDuel": "Modo duelo ({a} vs {b})",
    "game.summaryMode": "Modo",
    "game.summaryPlatform": "Plataforma",
    "game.summaryUser": "Usuario",
    "game.summaryPositions": "Posiciones",
    "game.summaryRoundTime": "Tiempo de ronda",
    "game.result.yourMove": "Resultado de tu jugada",
    "game.result.positionSolved": "¡Posición resuelta!",
    "game.comparison.tie": "Comparativa: empate.",
    "game.comparison.advantage": "Comparativa: ventaja para {player}.",
    "game.finalScoreSolo": "Puntaje final: {score}",
    "game.finalDraw": "Resultado final: empate.",
    "game.finalWinner": "Ganador: {player}.",
    "game.finalMatchScore": "Marcador final: {p1} {s1} - {s2} {p2}. {winner}",
    "game.sessionDone": "¡Sesión terminada!",
    "game.noMorePositions": "No se encontraron más posiciones.",
    "game.searchCancelled": "Búsqueda cancelada. Podés volver a buscar la próxima posición cuando quieras.",
    "game.sessionHintCitizen": "Objetivo de sesión: {target} posiciones. Detectadas: {detected}.",
    "game.sessionHintEngineer": "Objetivo de sesión: {target} posiciones. Sistema: {system}. Detectadas por ahora: {detected}. Analizadas: {analyzed}/{total}.",
    "overlay.timeoutEvaluating": "Tiempo agotado. Evaluando posición...",
    "overlay.closingWithoutMove": "Cerrando posición sin jugada...",
    "overlay.evaluatingMove": "Evaluando jugada...",
    "overlay.evaluatingBoth": "Evaluando jugadas de ambos jugadores...",
    "overlay.evaluatingYours": "Evaluando tu jugada...",
    "overlay.difficultyBudget": "Dificultad {label} · {budget}",
    "overlay.progressLabel": "{pct}% · {elapsed}s / {total}s",
    "overlay.searchingNext": "Buscando próxima posición...",
    "analysis.metrics.zero": "Totales: 0 | Analizadas: 0 | Detectadas: 0",
    "analysis.metrics.engineer": "Posiciones totales: {total} | Posiciones analizadas: {done} | Posiciones detectadas (>= umbral): {detected}",
    "analysis.progressLabel": "{pct}% ({done}/{total}){extra}",
    "analysis.extra.detectedRepeated": "Posición detectada (repetida)",
    "analysis.extra.evaluatingCandidate": "Evaluando {ordinal}/{total}",
    "analysis.extra.detected": "Posición detectada",
    "analysis.extra.searchingError": "Buscando error",
    "analysis.extra.finished": "Búsqueda finalizada",
    "analysis.extra.cancelled": "Búsqueda cancelada",
    "analysis.status.reused": "{prefix}Posición detectada ({count}). Se reutiliza partida por falta de alternativas.",
    "analysis.status.candidate": "{prefix}Analizando candidata {ordinal}/{total}. Detectadas: {detected}.",
    "analysis.status.ready": "{prefix}Posición detectada ({count}). Podés jugar.",
    "analysis.status.continuity": "{prefix}Posición detectada ({count}). Se priorizó continuidad de sesión.",
    "analysis.status.noFresh": "{prefix}Posición detectada ({count}). No hubo más partidas nuevas en el umbral.",
    "analysis.status.noMore": "{prefix}No quedan más posiciones en el umbral.",
    "analysis.status.prepareBase": "Preparando base online de {provider}...",
    "analysis.status.prepareEngine": "Preparando el motor de análisis...",
    "analysis.status.localEngineNotice": "El motor fuerte todavía no está listo: por ahora se usa el de respaldo, que analiza menos a fondo.",
    "analysis.status.shuffle": "Barajando {games} partidas y buscando primera posición para {player}...",
    "analysis.status.firstReady": "Primera posición detectada. Ya podés jugar.",
    "analysis.status.error": "Error durante el análisis: {error}",
    "analysis.status.roundError": "Error al evaluar la ronda: {error}",
    "provider.readyToDownload": "Listo para descargar partidas cuando toques “Comenzar sesión”.",
    "provider.baseReady": "Base lista para {username}.{warning}",
    "provider.sourceLoaded": "Fuente: {provider} ({username}) | {games} partida(s) cargadas.{warning}",
    "provider.modeChangedRedownload": "Modo cambiado. La base online se descargará de nuevo al comenzar.",
    "provider.enterLichessUser": "Ingresá un usuario de Lichess.",
    "provider.enterLichessContinue": "Ingresá un usuario de Lichess para continuar.",
    "provider.enterChesscomUser": "Ingresá un usuario de Chess.com.",
    "provider.enterChesscomContinue": "Ingresá un usuario de Chess.com para continuar.",
    "provider.protocolLichess": "Protocolo modo normal: se descargan partidas públicas del último año. Primero {preferred}; si no llega a {minSlowGames}, se completa con Blitz y, si aún falta base, con Bullet (no ideal) hasta {maxGames}.",
    "provider.protocolChesscom": "Protocolo modo normal: se descargan partidas públicas del último año desde archivos mensuales. Primero {preferred}; si no llega a {minSlowGames}, se completa con Blitz y, si aún falta base, con Bullet (no ideal) hasta {maxGames}.",
    "provider.downloadingFor": "Descargando para {user}. {protocol}",
    "provider.searchingUpTo": "Buscando hasta {max} partida(s) de {user}: primero {preferred} (últimos 12 meses)...",
    "provider.completingBlitz": "Se descargaron {count} partida(s) {preferred}. Completando con Blitz ({remaining} restantes)...",
    "provider.bulletContextStillShort": "{user} no tiene suficientes partidas en {preferred}; tampoco alcanza con Blitz",
    "provider.bulletContextNoBlitz": "{user} no tiene suficientes partidas en {preferred} ni Blitz",
    "provider.bulletAttempt": "Advertencia: {context}. Intentando completar con Bullet ({remaining} restantes)...",
    "provider.bulletCompleted": "Advertencia: {context}. Completamos con Bullet, pero no es ideal.",
    "provider.readyBullet": "{warning} Listo: {total} partida(s) de {user}. {slow} en {preferred} + {blitz} Blitz + {bullet} Bullet (fallback).",
    "provider.readyBlitz": "Listo: {total} partida(s) de {user}. {slow} en {preferred} + {blitz} Blitz (fallback).",
    "provider.readyPreferred": "Listo: {total} partida(s) de {user} en {preferred}.",
    "provider.chesscomReadArchiveError": "Chess.com respondió {status} al leer {url}.",
    "provider.userNotFoundOrPrivate": "Usuario no encontrado o sin partidas públicas.",
    "provider.lichessResponse": "Lichess respondió {status}",
    "provider.chesscomResponse": "Chess.com respondió {status}",
    "provider.noMonthlyArchives": "No hay archivos mensuales públicos en los últimos 12 meses.",
    "provider.noGamesForFilters": "No se encontraron partidas públicas en los ritmos/filtros elegidos.",
    "provider.noPublicValidGames": "No encontramos partidas públicas válidas para ese usuario. Probá otro usuario o plataforma.",
    "provider.playerNotDetected": "No pudimos detectar el jugador en las partidas descargadas. Probá con otro usuario.",
    "provider.noAnalyzablePositions": "No encontramos posiciones analizables para ese usuario. Probá con otro usuario o plataforma.",
    "provider.requestedPlayerMissing": "Las partidas descargadas no incluyen a {user}. Revisá el nombre de usuario.",
    "provider.configChangedDuringDownload": "Cambiaste el usuario o la plataforma mientras se descargaba. Volvé a preparar la base.",
    "provider.noUsefulMistakes": "No se detectaron errores útiles con este usuario. Candidatas analizadas: {analyzed}/{total}.",
    "provider.monthProgress": "Chess.com: mes {year}-{month} ({pass})",
    "provider.monthsSkipped": "No se pudieron descargar estos meses, se omitieron: {months}.",
    "provider.downloadBudgetExceeded": "Se alcanzó el tiempo máximo de descarga; seguimos con las partidas ya obtenidas.",
    "difficulty.low": "baja",
    "difficulty.medium": "media",
    "difficulty.high": "alta",
  },
  en: {
    "meta.title": "Ludus Scaccorum - Mistake Training",
    "landing.description": "Train calculation, evaluation, and decision-making by finding better moves in real positions.",
    "buttons.start": "Start",
    "buttons.backHome": "Back to home",
    "buttons.previous": "Previous",
    "buttons.next": "Next",
    "buttons.startSession": "Start session",
    "buttons.retryUser": "Try another user",
    "buttons.switchPlatform": "Switch platform",
    "buttons.revealBest": "Show best move",
    "buttons.revealGame": "Show game move",
    "buttons.revealPlayedBy": "Show what {name} played",
    "buttons.exploreBoard": "Explore board",
    "buttons.analysisActive": "Exploration active",
    "buttons.resetAnalysis": "Reset analysis",
    "buttons.nextPosition": "Next position",
    "buttons.backToMenu": "Back to start",
    "buttons.skipMove": "Skip move (0 pts)",
    "buttons.restartMenu": "Back to start",
    "buttons.cancelSearch": "Cancel search",
    "confirm.restartTitle": "Go back to the start?",
    "confirm.restartToSetup": "Going back to the start clears this session's positions and your running score. Go back anyway?",
    "confirm.restartAccept": "Back to start",
    "confirm.restartCancel": "Keep playing",
    "wizard.title": "Guided setup",
    "wizard.heading": "Let's build your session in 3 steps",
    "wizard.stepIndicator": "Step {step} of {total}",
    "wizard.step1.question": "How do you want to play?",
    "wizard.step1.ariaLabel": "Game mode",
    "wizard.step1.solo": "Play solo",
    "wizard.step1.duel": "Play against someone",
    "wizard.step1.duelHint": "You take turns on this same device",
    "wizard.step1.duelExplainer": "You'll share this device: each of you plays your turn and you compare scores at the end.",
    "wizard.step1.player1Label": "Player 1 name",
    "wizard.step1.player2Label": "Player 2 name",
    "wizard.step2.question": "Where should we get your games from?",
    "wizard.step2.help": "We will download public games from the last year to find positions.",
    "wizard.step2.howItWorks": "How does it work?",
    "wizard.step2.howItWorksBody": "We look through your recent slow games (classical and rapid). If there aren't enough, we add blitz games. We only download as many as we need to build the positions you asked for.",
    "wizard.step2.platformAriaLabel": "Platform",
    "wizard.step2.lichess": "Lichess",
    "wizard.step2.chesscom": "Chess.com",
    "wizard.step2.usernameLabel": "Username",
    "wizard.step2.enterUsername": "Enter your username to continue.",
    "wizard.step2.clearCache": "Clear saved game data",
    "wizard.step2.clearCacheConfirm": "Tap again to delete",
    "wizard.step2.clearCacheDone": "Saved games were cleared from this browser.",
    "wizard.step3.question": "How many positions do you want to play today?",
    "wizard.step3.ariaLabel": "Number of positions",
    "wizard.step3.positions5": "5 positions",
    "wizard.step3.positions10": "10 positions",
    "wizard.step3.positions20": "20 positions",
    "wizard.step3.customCount": "Custom (1 to 200)",
    "wizard.step3.timerLabel": "Time per round",
    "wizard.step3.timerAriaLabel": "Time per round",
    "wizard.step3.timerCustom": "Custom (5 to 360 seconds)",
    "wizard.step3.sessionSummary": "Session summary",
    "wizard.step3.analysisPrompt": "Tap “Start session” to look for mistakes.",
    "wizard.validation.chooseMode": "Choose whether you want to play solo or against someone.",
    "wizard.validation.fillDuelNames": "Fill in both duel names.",
    "wizard.validation.duelNameMax": "Duel names can be up to 20 characters long.",
    "wizard.validation.choosePlatform": "Choose Lichess or Chess.com.",
    "wizard.validation.enterUsername": "Enter your username to continue.",
    "wizard.validation.invalidUsername": "The username must be 3 to 30 characters long (letters, numbers, _ or -).",
    "wizard.validation.chooseCount": "Choose a number between 1 and 200 positions.",
    "wizard.validation.ready": "Configuration is ready to start the session.",
    "wizard.status.currentStep": "Configure the current step to continue.",
    "wizard.status.answerQuestions": "Answer the questions to prepare your session.",
    "wizard.status.nextSession": "Set up your next session step by step.",
    "wizard.status.modeSourceOptions": "Configure mode, source, and analysis options.",
    "wizard.status.nextStep": "Perfect. Let's move on to the next step.",
    "wizard.status.sourceStep": "Perfect. Let's move on to the game source.",
    "compat.gameFormat.solo": "Study mode (1 player)",
    "compat.gameFormat.duel": "Duel mode (2 players)",
    "players.default1": "Player 1",
    "players.default2": "Player 2",
    "players.soloSession": "Your session",
    "players.kicker1": "Player 1",
    "players.kicker2": "Player 2",
    "players.targetLabel": "Target user for analysis",
    "players.targetHint": "We will use this user to choose positions.",
    "players.enterUserContinue": "Enter the user to continue.",
    "players.notDetected": "Not detected",
    "players.genericUser": "user",
    "labels.scoreTitle": "Score",
    "labels.clockTitle": "Clock",
    "labels.clockMilestone": "{seconds} seconds remaining.",
    "labels.clockTimeUp": "Time's up.",
    "labels.positionsEvaluatedTitle": "Evaluated positions",
    "result.title": "Result",
    "result.pending": "There is no evaluated move yet.",
    "result.boardToolsLabel": "Board tools",
    "score.totalPoints": "Total points",
    "score.duelScore": "Duel score",
    "scoring.system.simple.label": "Precision (0 to 10)",
    "scoring.system.simple.description": "The closer your move is to the engine's best, the more points: up to 10 per position.",
    "quality.no_move": "No move",
    "quality.perfect": "Perfect",
    "quality.very_good": "Very good",
    "quality.good": "Good",
    "quality.interesting": "Interesting",
    "quality.dubious": "Dubious",
    "quality.bad": "Bad",
    "quality.blunder": "Serious mistake",
    "common.notAvailable": "Not available",
    "common.unknown": "unknown",
    "common.searching": "Thinking...",
    "common.gameFallback": "Game",
    "common.playersUnavailable": "Players unavailable",
    "common.white": "White",
    "common.black": "Black",
    "board.ariaLabel": "Chess board",
    "board.squareLabel": "{square}: {piece}{state}",
    "board.empty": "empty",
    "board.selected": ", selected",
    "board.legalTarget": ", legal target",
    "board.captureTarget": ", legal capture",
    "board.disabled": ", not interactive",
    "piece.whitePawn": "white pawn",
    "piece.whiteKnight": "white knight",
    "piece.whiteBishop": "white bishop",
    "piece.whiteRook": "white rook",
    "piece.whiteQueen": "white queen",
    "piece.whiteKing": "white king",
    "piece.blackPawn": "black pawn",
    "piece.blackKnight": "black knight",
    "piece.blackBishop": "black bishop",
    "piece.blackRook": "black rook",
    "piece.blackQueen": "black queen",
    "piece.blackKing": "black king",
    "promotion.chooseTitle": "Choose the promotion piece",
    "common.sourceError": "We couldn't fetch games for that user. Check the username or switch platform.",
    "common.sourceErrorWithDetail": "We couldn't fetch games for that user. Check the username or switch platform. ({error})",
    "network.timeout": "The connection took too long. Try again in a few seconds.",
    "network.failed": "Could not connect to the provider. Try again or use the last saved base if available.",
    "network.rateLimited": "The provider rate-limited the request. Wait a moment before retrying.",
    "network.responseTooLarge": "The provider's response is too large and was rejected for safety. Try again later.",
    "network.cancelled": "Download cancelled.",
    "privacy.remoteFetchConfirm": "We're going to ask {provider} for {user}'s public games. The request goes straight from your browser to that site: this app has no server of its own. We'll store the text of those games, your username, and some per-game details (result, date) in this browser for up to 7 days, so we don't have to download them again next time; you can delete them anytime with “Clear saved game data”. On a shared computer, anyone else using this browser could see that data during those 7 days. Continue?",
    "privacy.remoteFetchCancelled": "Request cancelled. No data was sent to the provider.",
    "privacy.remoteFetchTitle": "Fetch public games",
    "privacy.remoteFetchAccept": "Accept",
    "privacy.remoteFetchCancel": "Cancel",
    "privacy.remoteFetchUsernameLabel": "Retype the username to confirm",
    "privacy.remoteFetchUsernameMismatch": "The username doesn't match. Type it exactly to confirm.",
    "provider.usingCachedBase": "Using saved {provider} base for {user}: {games} game(s).",
    "provider.throttleWait": "Please wait {seconds} second(s) before downloading games again, so we do not overload the service.",
    "provider.throttleHourly": "Games have already been downloaded {max} times in the last hour. Try again in about {minutes} minute(s).",
    "provider.usingStaleCachedBase": "Could not refresh the base. Using the last saved {provider} base for {user}: {games} game(s).",
    "time.classical": "Classical",
    "time.rapid": "Rapid",
    "time.daily": "Daily",
    "time.blitz": "Blitz",
    "time.bullet": "Bullet",
    "evaluation.mateIn": "Mate in {ply}",
    "evaluation.getsMatedIn": "Gets mated in {ply}",
    "evaluation.deltaUnavailable": "Not available",
    "evaluation.deltaEqual": "Equal",
    "evaluation.deltaMateBetter": "Better (mate / near mate)",
    "evaluation.deltaMateWorse": "Worse (mate / near mate)",
    "evaluation.deltaBetter": "+{delta} cp (better)",
    "evaluation.deltaWorse": "{delta} cp (worse)",
    "evaluation.moduleBest": "Engine best",
    "evaluation.gameLine": "Game",
    "evaluation.yourMove": "Your move",
    "evaluation.historyPosition": "Position {round}",
    "evaluation.historyModule": "Engine",
    "evaluation.historyGame": "Game",
    "evaluation.historyYourMove": "Your move",
    "evaluation.historyEmpty": "No played positions.",
    "evaluation.classification": "Classification",
    "evaluation.delta": "Delta",
    "evaluation.points": "Points",
    "evaluation.timeoutZeroPoints": "Time ran out: 0 points.",
    "evaluation.noMoveZeroPoints": "No move played: 0 points.",
    "evaluation.timeoutZeroPts": "Time ran out: 0 pts.",
    "evaluation.noMoveMadeZeroPts": "You did not play a move: 0 pts.",
    "evaluation.bestPrefix": "Best: {san}",
    "evaluation.gamePrefix": "Game: {san}",
    "game.searchingNext": "Searching next position...",
    "game.positionFound": "Position found",
    "game.handoff.genericTitle": "Turn change",
    "game.handoff.genericSubtitle": "Tap to reveal",
    "game.handoff.title": "{player}'s turn",
    "game.handoff.subtitle": "Tap to reveal",
    "game.infoCitizen": "{players} | {event} {year} | Move {move}",
    "game.infoEngineer": "{players} | {event} {year} | ECO {eco} | Result {result} | Move {move}",
    "game.positionMeta": "{players} · Result {result} · Move {move} · Year {year}",
    "game.progressSolo": "Evaluated positions: {played} / {target} · Remaining: {remaining}",
    "game.progressDuel": "Round {round}/{target} · Remaining: {remaining} · Hits: {p1} {p1Hits} - {p2Hits} {p2}",
    "game.roundSolo": "Position {current}/{target}",
    "game.roundReview": "Review · {label}",
    "game.turnWhite": "White to move",
    "game.turnBlack": "Black to move",
    "game.turnPlayer": "{player} to move ({turn}/2)",
    "game.duelCompetitive": "Local duel · {seconds}s per turn · {system}",
    "game.duelHint": "Competitive local mode: both players get exactly the same positions and time.",
    "game.soloHint": "Individual training with total accumulated score.",
    "game.studyMode": "Study mode",
    "game.localDuel": "Duel mode ({a} vs {b})",
    "game.summaryMode": "Mode",
    "game.summaryPlatform": "Platform",
    "game.summaryUser": "User",
    "game.summaryPositions": "Positions",
    "game.summaryRoundTime": "Round time",
    "game.result.yourMove": "Your move result",
    "game.result.positionSolved": "Position solved!",
    "game.comparison.tie": "Comparison: tie.",
    "game.comparison.advantage": "Comparison: edge for {player}.",
    "game.finalScoreSolo": "Final score: {score}",
    "game.finalDraw": "Final result: draw.",
    "game.finalWinner": "Winner: {player}.",
    "game.finalMatchScore": "Final score: {p1} {s1} - {s2} {p2}. {winner}",
    "game.sessionDone": "Session finished!",
    "game.noMorePositions": "No more positions were found.",
    "game.searchCancelled": "Search cancelled. You can look for the next position whenever you want.",
    "game.sessionHintCitizen": "Session target: {target} positions. Found: {detected}.",
    "game.sessionHintEngineer": "Session target: {target} positions. System: {system}. Found so far: {detected}. Analyzed: {analyzed}/{total}.",
    "overlay.timeoutEvaluating": "Time ran out. Evaluating position...",
    "overlay.closingWithoutMove": "Closing position without a move...",
    "overlay.evaluatingMove": "Evaluating move...",
    "overlay.evaluatingBoth": "Evaluating both players' moves...",
    "overlay.evaluatingYours": "Evaluating your move...",
    "overlay.difficultyBudget": "Difficulty {label} · {budget}",
    "overlay.progressLabel": "{pct}% · {elapsed}s / {total}s",
    "overlay.searchingNext": "Searching next position...",
    "analysis.metrics.zero": "Totals: 0 | Analyzed: 0 | Found: 0",
    "analysis.metrics.engineer": "Total positions: {total} | Analyzed positions: {done} | Found positions (>= threshold): {detected}",
    "analysis.progressLabel": "{pct}% ({done}/{total}){extra}",
    "analysis.extra.detectedRepeated": "Position found (repeated)",
    "analysis.extra.evaluatingCandidate": "Evaluating {ordinal}/{total}",
    "analysis.extra.detected": "Position found",
    "analysis.extra.searchingError": "Looking for error",
    "analysis.extra.finished": "Search finished",
    "analysis.extra.cancelled": "Search cancelled",
    "analysis.status.reused": "{prefix}Position found ({count}). Reusing a game due to lack of alternatives.",
    "analysis.status.candidate": "{prefix}Analyzing candidate {ordinal}/{total}. Found: {detected}.",
    "analysis.status.ready": "{prefix}Position found ({count}). You can play now.",
    "analysis.status.continuity": "{prefix}Position found ({count}). Session continuity was prioritized.",
    "analysis.status.noFresh": "{prefix}Position found ({count}). There were no more fresh games above the threshold.",
    "analysis.status.noMore": "{prefix}There are no more positions above the threshold.",
    "analysis.status.prepareBase": "Preparing online base from {provider}...",
    "analysis.status.prepareEngine": "Getting the analysis engine ready...",
    "analysis.status.localEngineNotice": "The strong engine is not ready yet: the backup one is being used for now, and it looks less deeply.",
    "analysis.status.shuffle": "Shuffling {games} games and looking for the first position for {player}...",
    "analysis.status.firstReady": "First position found. You can start playing now.",
    "analysis.status.error": "Error during analysis: {error}",
    "analysis.status.roundError": "Error while evaluating the round: {error}",
    "provider.readyToDownload": "Ready to download games when you tap “Start session”.",
    "provider.baseReady": "Base ready for {username}.{warning}",
    "provider.sourceLoaded": "Source: {provider} ({username}) | {games} game(s) loaded.{warning}",
    "provider.modeChangedRedownload": "Mode changed. The online base will be downloaded again when you start.",
    "provider.enterLichessUser": "Enter a Lichess username.",
    "provider.enterLichessContinue": "Enter a Lichess username to continue.",
    "provider.enterChesscomUser": "Enter a Chess.com username.",
    "provider.enterChesscomContinue": "Enter a Chess.com username to continue.",
    "provider.protocolLichess": "Normal-mode protocol: public games from the last year are downloaded. First {preferred}; if it does not reach {minSlowGames}, Blitz is added and, if the base is still too small, Bullet (not ideal) is added up to {maxGames}.",
    "provider.protocolChesscom": "Normal-mode protocol: public games from the last year are downloaded from monthly archives. First {preferred}; if it does not reach {minSlowGames}, Blitz is added and, if the base is still too small, Bullet (not ideal) is added up to {maxGames}.",
    "provider.downloadingFor": "Downloading for {user}. {protocol}",
    "provider.searchingUpTo": "Looking for up to {max} game(s) by {user}: first {preferred} (last 12 months)...",
    "provider.completingBlitz": "{count} {preferred} game(s) were downloaded. Filling with Blitz ({remaining} left)...",
    "provider.bulletContextStillShort": "{user} does not have enough games in {preferred}; Blitz is still not enough",
    "provider.bulletContextNoBlitz": "{user} does not have enough games in {preferred} or Blitz",
    "provider.bulletAttempt": "Warning: {context}. Trying to fill with Bullet ({remaining} left)...",
    "provider.bulletCompleted": "Warning: {context}. We filled with Bullet, but it is not ideal.",
    "provider.readyBullet": "{warning} Ready: {total} game(s) from {user}. {slow} in {preferred} + {blitz} Blitz + {bullet} Bullet (fallback).",
    "provider.readyBlitz": "Ready: {total} game(s) from {user}. {slow} in {preferred} + {blitz} Blitz (fallback).",
    "provider.readyPreferred": "Ready: {total} game(s) from {user} in {preferred}.",
    "provider.chesscomReadArchiveError": "Chess.com returned {status} while reading {url}.",
    "provider.userNotFoundOrPrivate": "User not found or without public games.",
    "provider.lichessResponse": "Lichess returned {status}",
    "provider.chesscomResponse": "Chess.com returned {status}",
    "provider.noMonthlyArchives": "There are no public monthly archives in the last 12 months.",
    "provider.noGamesForFilters": "No public games were found for the selected time controls / filters.",
    "provider.noPublicValidGames": "We could not find valid public games for that user. Try another user or platform.",
    "provider.playerNotDetected": "We could not detect the player in the downloaded games. Try another user.",
    "provider.noAnalyzablePositions": "We could not find analyzable positions for that user. Try another user or platform.",
    "provider.requestedPlayerMissing": "The downloaded games do not include {user}. Check the username.",
    "provider.configChangedDuringDownload": "You changed the user or platform while downloading. Prepare the base again.",
    "provider.noUsefulMistakes": "No useful mistakes were detected for this user. Candidates analyzed: {analyzed}/{total}.",
    "provider.monthProgress": "Chess.com: month {year}-{month} ({pass})",
    "provider.monthsSkipped": "These months could not be downloaded and were skipped: {months}.",
    "provider.downloadBudgetExceeded": "Reached the maximum download time; continuing with the games already fetched.",
    "difficulty.low": "low",
    "difficulty.medium": "medium",
    "difficulty.high": "high",
  },
};

// Strings added by the core integration live in the shared dictionary (the
// "core." prefix keeps them apart from the legacy keys above and from the other
// modules'). t() finds them through the fallback.
Ludus.i18n.register({
  es: {
    "core.hint.next.1": "Pista: la pieza (-{pct}%)",
    "core.hint.next.2": "Pista: la casilla (-{pct}%)",
    "core.hint.next.3": "Mostrar la jugada (0 pts)",
    "core.hint.done": "Jugada revelada",
    "core.hint.said.1": "Pista: mové el {piece} de {square}. Cuesta el {pct}% de los puntos.",
    "core.hint.said.2": "Pista: mové el {piece} de {from} a {to}. Cuesta el {pct}% de los puntos.",
    "core.hint.said.3": "Jugada revelada: {san}. Esta posición vale 0 puntos.",
    "core.hint.square.from": ", pista: pieza a mover",
    "core.hint.square.to": ", pista: casilla de destino",
    "core.hint.resultRevealed": "Jugada revelada: 0 pts",
    "core.result.earned": "Sumaste {points} / {max}",
    "core.result.provisional": "Puntaje provisional: no se pudo evaluar a fondo esta jugada.",
    "core.score.of": "{points} / {max} pts",
    "core.score.duelMax": "(máx. {max} pts)",
    "core.clock.untimed": "Sin límite",
    "core.clock.untimedAria": "Sin límite de tiempo",
    "core.clock.summary": "sin límite",
    "core.toast.achievement": "Logro desbloqueado: {name}",
    "core.toast.levelUp": "¡Subiste de nivel! {title}",
    "core.session.own": "Tus partidas: {user}",
    "core.wizard.heading.2": "Armemos tu sesión en 2 pasos",
    "core.session.default.own": "Tus partidas",
    "core.session.default.classic": "Partidas clásicas",
    "core.session.default.review": "Repaso de errores",
    "core.session.default.daily": "Desafío del día",
  },
  en: {
    "core.hint.next.1": "Hint: the piece (-{pct}%)",
    "core.hint.next.2": "Hint: the square (-{pct}%)",
    "core.hint.next.3": "Show the move (0 pts)",
    "core.hint.done": "Move revealed",
    "core.hint.said.1": "Hint: move the {piece} on {square}. It costs {pct}% of the points.",
    "core.hint.said.2": "Hint: move the {piece} from {from} to {to}. It costs {pct}% of the points.",
    "core.hint.said.3": "Move revealed: {san}. This position is worth 0 points.",
    "core.hint.square.from": ", hint: piece to move",
    "core.hint.square.to": ", hint: destination square",
    "core.hint.resultRevealed": "Move revealed: 0 pts",
    "core.result.earned": "You earned {points} / {max}",
    "core.result.provisional": "Provisional score: this move could not be evaluated in depth.",
    "core.score.of": "{points} / {max} pts",
    "core.score.duelMax": "(max. {max} pts)",
    "core.clock.untimed": "No limit",
    "core.clock.untimedAria": "No time limit",
    "core.clock.summary": "no limit",
    "core.toast.achievement": "Achievement unlocked: {name}",
    "core.toast.levelUp": "Level up! {title}",
    "core.session.own": "Your games: {user}",
    "core.wizard.heading.2": "Let's build your session in 2 steps",
    "core.session.default.own": "Your games",
    "core.session.default.classic": "Classic games",
    "core.session.default.review": "Mistake review",
    "core.session.default.daily": "Daily challenge",
  },
});

function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(String(value || "").toLowerCase()) ? String(value || "").toLowerCase() : "es";
}

function loadLanguagePreference() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!stored) return "";
    return normalizeLanguage(stored);
  } catch (error) {
    return "";
  }
}

function detectInitialLanguage() {
  const saved = loadLanguagePreference();
  if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
  const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  const prefersEnglish = browserLanguages.some((entry) => String(entry || "").toLowerCase().startsWith("en"));
  return prefersEnglish ? "en" : "es";
}

function saveLanguagePreference(language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
  } catch (error) {
    // Ignore storage failures.
  }
}

// ---------- Shared modules (Ludus.*) ----------
// Every optional module is looked up when it is needed and every call into one is
// guarded: a module that is missing or broken degrades that feature (no sound, no
// toast, no notebook card) and never breaks a round.

function ludusModule(name) {
  try {
    return typeof Ludus === "object" && Ludus ? (Ludus[name] || null) : null;
  } catch (error) {
    return null;
  }
}

function settingsGet(path, fallback) {
  const settings = ludusModule("Settings");
  try {
    if (settings && typeof settings.get === "function") {
      const value = settings.get(path);
      if (value !== undefined && value !== null) return value;
    }
  } catch (error) {
    // fall through to the fallback
  }
  return fallback;
}

function settingsSet(path, value) {
  const settings = ludusModule("Settings");
  try {
    return Boolean(settings && typeof settings.set === "function" && settings.set(path, value));
  } catch (error) {
    return false;
  }
}

function busEmit(eventName, payload) {
  const bus = ludusModule("bus");
  try {
    if (bus && typeof bus.emit === "function") bus.emit(eventName, payload);
  } catch (error) {
    console.error(`[Ludus] "${eventName}" handler failed`, error);
  }
}

function playSound(name, options) {
  const audio = ludusModule("Audio");
  try {
    if (audio && typeof audio.play === "function") audio.play(name, options);
  } catch (error) {
    // Sound is decoration.
  }
}

function showToast(message, options = {}) {
  const ui = ludusModule("ui");
  try {
    if (ui && typeof ui.toast === "function" && message) ui.toast(message, options);
  } catch (error) {
    // A toast is a courtesy, never a failure.
  }
}


function normalizeTurnTimeSeconds(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_TURN_TIME_SECONDS;
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : fallback;
  return clamp(Math.round(safeValue), MIN_TURN_TIME_SECONDS, MAX_TURN_TIME_SECONDS);
}

// The turn time is a setting now ("clock.seconds" in Ludus.Settings, which also
// migrated the legacy "ludus.setup.v1" key once); the wizard just reads and
// writes it. Without Settings (a broken load) the default keeps the wizard usable.
function loadSetupPreference() {
  return { turnTimeSeconds: normalizeTurnTimeSeconds(settingsGet("clock.seconds", DEFAULT_TURN_TIME_SECONDS)) };
}

function saveSetupPreference(turnTimeSeconds) {
  settingsSet("clock.seconds", normalizeTurnTimeSeconds(turnTimeSeconds));
}

// When enabled, a downloaded PGN base is kept only in STATE for the current
// session and never written to IndexedDB, so it does not outlive the tab.
// No visible toggle wires into this yet (see FII-03 follow-up); it exists so
// the behavior is ready once index.html grows a control for it.
function loadNoPersistDownloadsPreference() {
  try {
    return window.localStorage.getItem(NO_PERSIST_DOWNLOADS_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function saveNoPersistDownloadsPreference(enabled) {
  try {
    window.localStorage.setItem(NO_PERSIST_DOWNLOADS_STORAGE_KEY, enabled ? "1" : "0");
  } catch (error) {
    // Ignore storage failures.
  }
}

function interpolate(text, params = {}) {
  return String(text || "").replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

// app.js keeps its own dictionary for the legacy strings; every key it does not
// know is looked up in the shared one (Ludus.i18n), where the newer modules and
// this file's own additions live.
function ownTranslation(key, language) {
  const normalized = normalizeLanguage(language);
  return TRANSLATIONS[normalized]?.[key] ?? TRANSLATIONS.es?.[key];
}

function sharedTranslation(key, params, language) {
  const shared = ludusModule("i18n");
  try {
    if (shared && typeof shared.has === "function" && shared.has(key, normalizeLanguage(language))) {
      return shared.t(key, params, normalizeLanguage(language));
    }
    if (shared && typeof shared.has === "function" && shared.has(key, "es")) {
      return shared.t(key, params, "es");
    }
  } catch (error) {
    // fall through: the key itself is the last resort
  }
  return undefined;
}

function rawTranslation(key, language = STATE?.language || "es") {
  const own = ownTranslation(key, language);
  if (own !== undefined) return own;
  const shared = sharedTranslation(key, undefined, language);
  return shared !== undefined ? shared : key;
}

function t(key, params = {}, language = STATE?.language || "es") {
  const own = ownTranslation(key, language);
  if (own !== undefined) return interpolate(own, params);
  const shared = sharedTranslation(key, params, language);
  return shared !== undefined ? shared : key;
}

function preferredLocale() {
  return normalizeLanguage(STATE?.language || detectInitialLanguage());
}

const DUEL_DEFAULT_PLAYERS = ["Jugador 1", "Jugador 2"];
// The chess primitives and the PGN helpers live in js/chess.js and js/pgn.js
// (loaded before this file, see index.html and docs/ARCHITECTURE.md).
const { Chess, files, uciToMove, moveToUci, moveToSan, sanToMove } = Ludus.chess;
const {
  removeVariations,
  hasOversizedComment,
  parseTags,
  resolveGameStartFen,
  cleanTagValue,
  tokenizeSanMoves,
  splitGamesFromText,
  buildGameFromText,
} = Ludus.pgn;
const PIECE_IMAGES = {
  P: "assets/pieces/cburnett/wP.svg",
  N: "assets/pieces/cburnett/wN.svg",
  B: "assets/pieces/cburnett/wB.svg",
  R: "assets/pieces/cburnett/wR.svg",
  Q: "assets/pieces/cburnett/wQ.svg",
  K: "assets/pieces/cburnett/wK.svg",
  p: "assets/pieces/cburnett/bP.svg",
  n: "assets/pieces/cburnett/bN.svg",
  b: "assets/pieces/cburnett/bB.svg",
  r: "assets/pieces/cburnett/bR.svg",
  q: "assets/pieces/cburnett/bQ.svg",
  k: "assets/pieces/cburnett/bK.svg",
};

const INITIAL_LANGUAGE = detectInitialLanguage();
const INITIAL_SETUP = loadSetupPreference();

const STATE = {
  allMistakes: [],
  positions: [],
  index: 0,
  board: null,
  selection: null,
  legalMoves: [],
  pendingPromotion: null,
  userMove: null,
  score: 0,
  // The strong engine (Ludus.Engine over a Worker) once it is up; until then, or
  // after it fails, the shallow local search answers (see analyzePosition).
  engine: { mode: "local", instance: null, ready: false },
  // analyzePosition(): finished results, the requests still running, and the
  // counter that cancels everything started before it (new session, leaving).
  analysis: { cache: new Map(), inflight: new Map(), generation: 0 },
  boardPerspective: "w",
  keyboardFocusSquare: null,
  revealed: { best: null, game: null, user: null, userAlt: null },
  historyEntries: [],
  historySelectedIdx: -1,
  analysisContext: null,
  analysisInProgress: false,
  roundSubmitted: false,
  isResolvingRound: false,
  targetPositions: 10,
  sessionPlayed: 0,
  sessionHits: 0,
  sessionToken: 0,
  language: INITIAL_LANGUAGE,
  scoringSystem: DEFAULT_SCORING_SYSTEM,
  sourceMode: "lichess",
  remotePgnSources: [],
  remoteConsent: { lichess: false, chesscom: false },
  userMode: "citizen",
  gameFormat: "solo",
  turnTimeSeconds: INITIAL_SETUP.turnTimeSeconds,
  // What the running session plays with: fixed when it starts (from Settings, or
  // from the options a screen passes to Ludus.game.startSession).
  clockMode: "timed",
  hintsEnabled: true,
  scoringOverride: null,
  // The session in progress (or just finished): { id, kind, title, mode, ... }.
  session: null,
  // Progressive hints for the round on screen: 0 none, 1 piece, 2 square, 3 revealed.
  hintsUsed: 0,
  hint: null,
  roundStartedAt: 0,
  // Ids of the curiosities already shown, so the next result picks a new one.
  recentFacts: [],
  setupWizard: {
    step: 1,
    // Step 1 (who plays) is skipped when a screen already chose the mode.
    skipModeStep: false,
    // The profiles of a duel's two players, when a screen knows them (null: guests).
    profileIds: null,
    mode: "solo",
    duelNames: [...DUEL_DEFAULT_PLAYERS],
    platform: "lichess",
    username: "",
    sessionSize: DEFAULT_CITIZEN_SESSION_SIZE,
    turnTimeSeconds: INITIAL_SETUP.turnTimeSeconds,
    sourceError: null,
  },
  timer: { intervalId: null, deadlineMs: 0, durationMs: 0, lastAnnouncedSeconds: null },
  ui: {
    phase: "playing",
    blockBoardInput: false,
    setupAnalyzing: false,
    positionSearchState: null,
    handoffState: null,
    handoffReturnFocusEl: null,
    searchCancelRequested: false,
  },
  resultView: {
    visible: false,
    analysisMode: false,
    snapshotFen: "",
    snapshotRevealed: { best: null, game: null, user: null, userAlt: null },
    context: null,
  },
  duel: {
    players: [...DUEL_DEFAULT_PLAYERS],
    scores: [0, 0],
    hits: [0, 0],
    currentPlayer: 0,
    roundResults: [null, null],
    handoffReady: false,
  },
};

function providerLabel(provider) {
  return provider === "chesscom" ? "Chess.com" : "Lichess";
}

function remoteWarningText(remote) {
  if (!remote?.detail || !Number.isFinite(remote.detail.bullet) || remote.detail.bullet <= 0) {
    return "";
  }
  const preferredValues = String(remote.detail.preferred || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const preferred = joinPreferredTimeClasses(preferredValues);
  const context = Number(remote.detail.blitz) > 0
    ? t("provider.bulletContextStillShort", { user: remote.username, preferred })
    : t("provider.bulletContextNoBlitz", { user: remote.username, preferred });
  return t("provider.bulletCompleted", { context });
}

function qualityLabel(code) {
  return t(`quality.${code || "no_move"}`);
}

function defaultDuelPlayerName(index, language = STATE.language) {
  return t(index === 1 ? "players.default2" : "players.default1", {}, language);
}

function knownDefaultPlayerNames(index) {
  return SUPPORTED_LANGUAGES.map((language) => defaultDuelPlayerName(index, language));
}

function shouldTranslatePlayerName(value, index) {
  const cleaned = String(value || "").trim();
  return !cleaned || knownDefaultPlayerNames(index).includes(cleaned);
}

function syncLocalizedPlayerDefaults() {
  [duelPlayerAEl, duelPlayerBEl].forEach((inputEl, index) => {
    if (!inputEl) return;
    if (shouldTranslatePlayerName(inputEl.value, index)) {
      inputEl.value = defaultDuelPlayerName(index);
    }
  });
}

function updateDocumentLanguage() {
  document.documentElement.lang = preferredLocale();
  // Once the router owns the screens, each screen sets its own title (and
  // re-sets it on a language change); this only names the page at boot.
  let routed = false;
  try {
    routed = Boolean(ludusModule("router") && Ludus.router.current());
  } catch (error) {
    routed = false;
  }
  if (!routed) document.title = t("meta.title");
}

function updateLanguageToggleUi() {
  const current = preferredLocale();
  if (languageBtnEs) languageBtnEs.setAttribute("aria-checked", current === "es" ? "true" : "false");
  if (languageBtnEn) languageBtnEn.setAttribute("aria-checked", current === "en" ? "true" : "false");
  setRadioGroupTabIndex(languageGroupEls, current === "en" ? languageBtnEn : languageBtnEs);
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    node.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (!key) return;
    node.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const key = node.getAttribute("data-i18n-title");
    if (!key) return;
    node.setAttribute("title", t(key));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria-label");
    if (!key) return;
    node.setAttribute("aria-label", t(key));
  });
}

function translateTimeClass(value) {
  return t(`time.${String(value || "").toLowerCase()}`);
}

function joinPreferredTimeClasses(values = []) {
  return values.map((entry) => translateTimeClass(entry)).join("/");
}

// True while this file is the one changing the shared language, so the echo of
// its own "language:changed" event does not run the refresh a second time.
let languageEchoGuard = false;

// Applies a language to everything app.js owns (its dictionary, the static
// markup, the round UI). It does not touch the shared i18n: see setLanguage().
function applyAppLanguage(language, options = {}) {
  const nextLanguage = normalizeLanguage(language);
  STATE.language = nextLanguage;
  if (!options.skipPersist) saveLanguagePreference(nextLanguage);
  updateDocumentLanguage();
  updateLanguageToggleUi();
  syncLocalizedPlayerDefaults();
  applyStaticTranslations();
  refreshLocalizedUi();
}

// The language switch of this page. The shared i18n changes first (it emits
// "language:changed", which is how every other screen re-renders) and then the
// game's own UI follows.
function setLanguage(language, options = {}) {
  const nextLanguage = normalizeLanguage(language);
  const shared = ludusModule("i18n");
  if (shared && typeof shared.setLanguage === "function") {
    languageEchoGuard = true;
    try {
      shared.setLanguage(nextLanguage, options.skipPersist ? { persist: false } : undefined);
    } catch (error) {
      console.error("[Ludus] language change failed in a listener", error);
    } finally {
      languageEchoGuard = false;
    }
  }
  applyAppLanguage(nextLanguage, options);
}

// The language can also be changed from elsewhere (the shell, the settings
// screen, another tab through storage): follow it, without emitting it again.
function watchSharedLanguage() {
  const bus = ludusModule("bus");
  if (!bus || typeof bus.on !== "function") return;
  bus.on("language:changed", (payload) => {
    if (languageEchoGuard) return;
    const next = normalizeLanguage(payload && payload.lang);
    if (next === STATE.language) return;
    applyAppLanguage(next, { skipPersist: true });
  });
}

// ---------- Utility ----------

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Roving tabindex for the exclusive-choice button groups (mode, platform,
// position count, turn time, language): only the checked radio is in the
// Tab order, matching the WAI-ARIA radiogroup pattern.
function setRadioGroupTabIndex(groupEls, checkedEl) {
  const target = checkedEl && groupEls.includes(checkedEl) ? checkedEl : groupEls[0];
  groupEls.forEach((el) => el.setAttribute("tabindex", el === target ? "0" : "-1"));
}

// Left/Right and Up/Down move focus to the previous/next radio in the group
// and select it, wrapping at the ends. Enter/Space already work because
// these options stay real <button> elements.
function wireRadioGroupKeyboardNav(groupEls) {
  groupEls.forEach((el) => {
    el.addEventListener("keydown", (event) => {
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
      if (!forward && !backward) return;
      event.preventDefault();
      const currentIndex = groupEls.indexOf(event.currentTarget);
      if (currentIndex === -1) return;
      const nextIndex = forward
        ? (currentIndex + 1) % groupEls.length
        : (currentIndex - 1 + groupEls.length) % groupEls.length;
      const nextEl = groupEls[nextIndex];
      if (!nextEl) return;
      nextEl.focus();
      nextEl.click();
    });
  });
}

// Links a form control to an error message: sets aria-invalid and appends
// the error paragraph's id to aria-describedby without clobbering any other
// id already there (e.g. the username field's static help text).
function setFieldInvalid(el, errorId) {
  if (!el || !errorId) return;
  el.setAttribute("aria-invalid", "true");
  const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  if (!ids.includes(errorId)) {
    ids.push(errorId);
    el.setAttribute("aria-describedby", ids.join(" "));
  }
}

function clearFieldInvalid(el, errorId) {
  if (!el) return;
  el.removeAttribute("aria-invalid");
  if (!errorId) return;
  const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== errorId);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
}

function countPgnGames(pgnText) {
  if (!pgnText) return 0;
  const matches = pgnText.match(/(^|\n)\[Event\s+"/g);
  return matches ? matches.length : 0;
}

function isRemoteSourceMode(mode = STATE.sourceMode) {
  return mode === "lichess" || mode === "chesscom";
}

function getRemoteProvider(entry) {
  if (!entry) return "";
  return String(entry.provider || "lichess");
}

function getRemoteProviderModeFromUi() {
  if (!onlineProviderSelectEl) return "lichess";
  return onlineProviderSelectEl.value === "chesscom" ? "chesscom" : "lichess";
}

function updateOnlineProviderUi() {
  if (!onlineUserInputEl) return;
  onlineUserInputEl.placeholder = getRemoteProviderModeFromUi() === "chesscom"
    ? (preferredLocale() === "en" ? "e.g. Hikaru" : "Ej: Hikaru")
    : (preferredLocale() === "en" ? "e.g. MagnusCarlsen" : "Ej: MagnusCarlsen");
}

function getConfiguredRemoteUsername() {
  return String(onlineUserInputEl ? onlineUserInputEl.value : "").trim();
}

// True when a downloaded base still belongs to the provider and the username
// the wizard shows right now. A slow download that lands after the person
// edited either field no longer matches, so it must not be used.
function remoteSourceMatchesUi(entry) {
  if (!entry) return false;
  const uiProvider = onlineProviderSelectEl ? getRemoteProviderModeFromUi() : STATE.sourceMode;
  if (getRemoteProvider(entry) !== uiProvider) return false;
  const configured = normalizeName(getConfiguredRemoteUsername());
  if (!configured) return false;
  return normalizeName(entry.username) === configured;
}

function hasAnyPgnSource(requireDownloadedRemote = false) {
  if (!requireDownloadedRemote) {
    return getConfiguredRemoteUsername().length > 0;
  }
  return remoteSourceMatchesUi(STATE.remotePgnSources[0]);
}

function setSourceMode(mode) {
  const nextMode = mode === "chesscom" ? "chesscom" : "lichess";
  if (STATE.remotePgnSources.length > 0) {
    const provider = getRemoteProvider(STATE.remotePgnSources[0]);
    if (provider !== nextMode) {
      clearRemotePgnSources();
    }
  }
  STATE.sourceMode = nextMode;
  if (onlineProviderSelectEl) {
    onlineProviderSelectEl.value = nextMode;
  }
  updateOnlineProviderUi();
}

function clearRemotePgnSources() {
  STATE.remotePgnSources = [];
}

// Set while a Chess.com download is in flight (see fetchChessComPgn) so a
// new session can actually abort the underlying request instead of merely
// discarding its result once it resolves.
let activeRemoteDownloadController = null;

function abortActiveRemoteDownload() {
  if (activeRemoteDownloadController) {
    try {
      activeRemoteDownloadController.abort();
    } catch (error) {
      // ignore
    }
    activeRemoteDownloadController = null;
  }
}

function beginSessionWork() {
  STATE.sessionToken += 1;
  abortActiveRemoteDownload();
  return STATE.sessionToken;
}

function isCurrentSessionWork(token) {
  return token === STATE.sessionToken;
}

function showSourceNeedsRedownloadMessage(message) {
  if (!isRemoteSourceMode()) return;
  if (onlineStatusEl) onlineStatusEl.textContent = message;
}

function normalizeGameFormat(value) {
  return value === "duel" ? "duel" : "solo";
}

function isDuelMode() {
  return STATE.gameFormat === "duel";
}

function sanitizePlayerName(value, fallback) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

function duelPlayerName(index) {
  const fallback = defaultDuelPlayerName(index);
  return sanitizePlayerName(STATE.duel.players[index], fallback);
}

// "Ver la que jugó Anderssen": the surname of the side to move, out of a
// position's "White vs Black" players line (classics, notebook cards).
function positionMoverName(position) {
  const meta = position && position.meta ? position.meta : {};
  const players = String(meta.players || "").split(/\s+vs\.?\s+/i);
  if (players.length !== 2) return "";
  let side = meta.sideToMove;
  if (side !== "w" && side !== "b") {
    try {
      side = new Chess(position.fen).turn;
    } catch (error) {
      return "";
    }
  }
  const full = sanitizePlayerName(side === "b" ? players[1] : players[0], "");
  if (!full) return "";
  if (full.includes(",")) return full.split(",")[0].trim();
  const words = full.split(" ");
  return words[words.length - 1];
}

function gameMoveAuthorName() {
  // A fixed list of positions (classics, review, daily) has no user name to show:
  // the move of the game was played by whoever was to move in that game.
  if (STATE.session && STATE.session.kind !== "own") {
    const mover = positionMoverName(STATE.positions[STATE.index]);
    if (mover) return mover;
  }
  const fromAnalysis = sanitizePlayerName(STATE.analysisContext?.targetName, "");
  if (fromAnalysis) return fromAnalysis;
  const fromWizard = sanitizePlayerName(STATE.setupWizard?.username, "");
  if (fromWizard) return fromWizard;
  const fromRemote = sanitizePlayerName(STATE.remotePgnSources?.[0]?.username, "");
  if (fromRemote) return fromRemote;
  const fromDetected = sanitizePlayerName(playerNameDetectedEl?.textContent, "");
  if (fromDetected && fromDetected !== t("players.notDetected") && fromDetected !== t("players.enterUserContinue")) return fromDetected;
  return t("players.genericUser");
}

function revealGameButtonLabel() {
  return t("buttons.revealPlayedBy", { name: gameMoveAuthorName() });
}

function currentUiPlayerIndex() {
  if (!isDuelMode()) return 0;
  return STATE.duel.currentPlayer === 1 ? 1 : 0;
}

function initialsFromName(value, fallback = "J") {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return fallback;
  const bits = cleaned.split(" ").filter(Boolean);
  const letters = bits.slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  return letters || fallback;
}

function setUiPhase(phase, blockBoardInput = false) {
  STATE.ui.phase = String(phase || "playing");
  STATE.ui.blockBoardInput = Boolean(blockBoardInput);
}

function showHandoffOverlay(title, subtitle) {
  if (!handoffOverlayEl) return;
  STATE.ui.handoffState = {
    title: title || t("game.handoff.genericTitle"),
    subtitle: subtitle || t("game.handoff.genericSubtitle"),
  };
  STATE.ui.handoffReturnFocusEl = document.activeElement || null;
  if (handoffOverlayTitleEl) handoffOverlayTitleEl.textContent = STATE.ui.handoffState.title;
  if (handoffOverlaySubtitleEl) handoffOverlaySubtitleEl.textContent = STATE.ui.handoffState.subtitle;
  handoffOverlayEl.classList.remove("hidden");
  requestAnimationFrame(() => {
    handoffOverlayEl.focus();
  });
}

function hideHandoffOverlay() {
  if (!handoffOverlayEl) return;
  STATE.ui.handoffState = null;
  handoffOverlayEl.classList.add("hidden");
  const returnFocusEl = STATE.ui.handoffReturnFocusEl;
  STATE.ui.handoffReturnFocusEl = null;
  if (returnFocusEl && document.contains(returnFocusEl) && typeof returnFocusEl.focus === "function") {
    returnFocusEl.focus();
  }
}

const POSITION_SEARCH_PROGRESS_MILESTONE_STEP = 25;

// Mirrors the clock's approach (announceClockMilestone): the visible bar and
// percentage update on every tick, but the live region only speaks up every
// 25%, once per step, so it doesn't bury the board in ARIA chatter while
// input is blocked.
function announcePositionSearchProgressMilestone(pct, text) {
  if (!positionSearchProgressAnnounceEl) return;
  const step = Math.min(4, Math.floor(pct / POSITION_SEARCH_PROGRESS_MILESTONE_STEP));
  const state = STATE.ui.positionSearchState;
  if (state) {
    if (state.announcedProgressStep === step) return;
    state.announcedProgressStep = step;
  }
  positionSearchProgressAnnounceEl.textContent = text;
}

function setPositionSearchProgress(ratio = null, label = "") {
  if (!positionSearchProgressEl || !positionSearchProgressBarEl || !positionSearchProgressLabelEl) return;
  if (!Number.isFinite(ratio)) {
    if (STATE.ui.positionSearchState) {
      STATE.ui.positionSearchState.progressRatio = null;
      STATE.ui.positionSearchState.progressLabel = "";
      STATE.ui.positionSearchState.announcedProgressStep = null;
    }
    positionSearchProgressEl.classList.add("hidden");
    positionSearchProgressEl.setAttribute("aria-valuenow", "0");
    positionSearchProgressBarEl.style.width = "0%";
    positionSearchProgressLabelEl.textContent = "";
    if (positionSearchProgressAnnounceEl) positionSearchProgressAnnounceEl.textContent = "";
    return;
  }
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const pct = Math.round(safeRatio * 100);
  const text = String(label || `${pct}%`);
  if (STATE.ui.positionSearchState) {
    STATE.ui.positionSearchState.progressRatio = safeRatio;
    STATE.ui.positionSearchState.progressLabel = text;
  }
  positionSearchProgressEl.classList.remove("hidden");
  positionSearchProgressEl.setAttribute("aria-valuenow", String(pct));
  positionSearchProgressBarEl.style.width = `${pct}%`;
  positionSearchProgressLabelEl.textContent = text;
  announcePositionSearchProgressMilestone(pct, text);
}

// ---------- Curiosity carousels (Ludus.Reader) ----------
// One lives in the overlay over the board and one in the wizard's waiting area.
// The carousel never advances before the reading time of a fact has passed and
// stops rotating when the wait it decorates is over (onlyWhile).

let overlayCarousel = null;
let overlayCarouselTimer = null;
let wizardCarousel = null;

function mountFactsCarousel(containerEl, onlyWhile) {
  const reader = ludusModule("Reader");
  if (!containerEl || !reader || typeof reader.createCarousel !== "function") return null;
  try {
    const carousel = reader.createCarousel(containerEl, { onlyWhile });
    carousel.start();
    return carousel;
  } catch (error) {
    console.error("[Ludus] the facts carousel could not start", error);
    return null;
  }
}

function destroyFactsCarousel(carousel) {
  if (!carousel) return;
  try {
    carousel.destroy();
  } catch (error) {
    // The container is being torn down anyway.
  }
}

function positionSearchOverlayIsShowing() {
  return Boolean(positionSearchOverlayEl)
    && !positionSearchOverlayEl.classList.contains("hidden")
    && Boolean(STATE.ui.positionSearchState);
}

function stopOverlayFacts() {
  if (overlayCarouselTimer) {
    clearTimeout(overlayCarouselTimer);
    overlayCarouselTimer = null;
  }
  destroyFactsCarousel(overlayCarousel);
  overlayCarousel = null;
}

// Makes the overlay's carousel match what the overlay asked for. Called on every
// show, so a language refresh that shows the overlay again keeps the carousel it
// already has instead of restarting it.
function syncOverlayFacts() {
  const state = STATE.ui.positionSearchState;
  if (!state || !state.facts || !positionSearchFactsEl) {
    stopOverlayFacts();
    return;
  }
  if (overlayCarousel || overlayCarouselTimer) return;
  const start = () => {
    overlayCarouselTimer = null;
    if (overlayCarousel || !positionSearchOverlayIsShowing()) return;
    overlayCarousel = mountFactsCarousel(positionSearchFactsEl, positionSearchOverlayIsShowing);
  };
  if (state.factsDelayMs > 0) overlayCarouselTimer = setTimeout(start, state.factsDelayMs);
  else start();
}

function startWizardFacts() {
  stopWizardFacts();
  wizardCarousel = mountFactsCarousel(analysisFactsEl, () => Boolean(STATE.ui.setupAnalyzing));
}

function stopWizardFacts() {
  destroyFactsCarousel(wizardCarousel);
  wizardCarousel = null;
}

// Long waits (the engine loading, scanning games, searching the next mistake,
// evaluating a round) show a carousel of chess history while they last:
// options.facts turns it on, options.factsDelayMs holds it back so a wait that
// turns out to be short never flashes one.
function showPositionSearchOverlay(title, meta = "", options = {}) {
  if (!positionSearchOverlayEl) return;
  const opts = options || {};
  STATE.ui.positionSearchState = {
    title: String(title || "").trim(),
    meta: String(meta || "").trim(),
    showProgress: Boolean(opts.showProgress),
    progressRatio: opts.progressRatio,
    progressLabel: opts.progressLabel || "",
    cancellable: Boolean(opts.cancellable),
    facts: Boolean(opts.facts),
    factsDelayMs: Number(opts.factsDelayMs) || 0,
  };
  if (positionSearchTitleEl) {
    positionSearchTitleEl.textContent = STATE.ui.positionSearchState.title || t("game.searchingNext");
  }
  if (positionSearchMetaEl) {
    positionSearchMetaEl.textContent = STATE.ui.positionSearchState.meta;
  }
  if (opts.showProgress) {
    setPositionSearchProgress(opts.progressRatio, opts.progressLabel);
  } else {
    setPositionSearchProgress(null);
  }
  // Only the search for the next position reads the cancel flag. Showing the
  // button while a move is being evaluated promised something that could not
  // happen.
  if (positionSearchCancelBtnEl) {
    positionSearchCancelBtnEl.classList.toggle("hidden", !opts.cancellable);
  }
  positionSearchOverlayEl.classList.remove("hidden");
  syncOverlayFacts();
}

function hidePositionSearchOverlay() {
  if (!positionSearchOverlayEl) return;
  positionSearchOverlayEl.classList.add("hidden");
  STATE.ui.positionSearchState = null;
  stopOverlayFacts();
  setPositionSearchProgress(null);
  if (positionSearchMetaEl) positionSearchMetaEl.textContent = "";
}

function formatPositionSearchMeta(position) {
  const meta = position && position.meta ? position.meta : {};
  const players = String(meta.players || "").trim() || t("common.playersUnavailable");
  const result = String(meta.result || "").trim() || "-";
  const moveNumber = Number.isFinite(Number(meta.moveNumber)) ? String(meta.moveNumber) : "-";
  const year = String(meta.year || "").trim() || "-";
  return t("game.positionMeta", { players, result, move: moveNumber, year });
}

function snapshotRevealedState(revealed = STATE.revealed) {
  const safe = revealed || {};
  return {
    best: snapshotMove(safe.best),
    game: snapshotMove(safe.game),
    user: snapshotMove(safe.user),
    userAlt: snapshotMove(safe.userAlt),
  };
}

function applyResultSnapshotToBoard() {
  if (!STATE.resultView.snapshotFen) return;
  STATE.board = new Chess(STATE.resultView.snapshotFen);
  setBoardPerspective(STATE.board.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.revealed = snapshotRevealedState(STATE.resultView.snapshotRevealed);
  renderBoard();
}

function captureResultSnapshot(fen) {
  STATE.resultView.snapshotFen = String(fen || "");
  STATE.resultView.snapshotRevealed = snapshotRevealedState(STATE.revealed);
}

function updateResultAnalysisControls() {
  const visible = Boolean(STATE.resultView.visible);
  const analysisMode = Boolean(STATE.resultView.analysisMode);
  if (resultOverlayEl) resultOverlayEl.classList.toggle("analysis-mode", analysisMode);
  if (resultAnalysisBtn) {
    resultAnalysisBtn.disabled = !visible || analysisMode;
    resultAnalysisBtn.textContent = analysisMode ? t("buttons.analysisActive") : t("buttons.exploreBoard");
    resultAnalysisBtn.setAttribute("aria-pressed", analysisMode ? "true" : "false");
  }
  if (resultAnalysisResetBtn) {
    resultAnalysisResetBtn.disabled = !visible || !analysisMode;
    resultAnalysisResetBtn.classList.toggle("hidden", !analysisMode);
  }
}

// The phase is set BEFORE the snapshot is drawn: renderBoard() reads it to decide
// whether the squares accept moves. Drawn while the phase was still "result", every
// square kept aria-disabled="true" and a "not interactive" label until the first
// click, so a screen reader was told the analysis board could not be played.
function enterResultAnalysisMode() {
  if (!STATE.resultView.visible || !STATE.resultView.snapshotFen) return;
  STATE.resultView.analysisMode = true;
  setUiPhase("result_analysis", false);
  applyResultSnapshotToBoard();
  updateResultAnalysisControls();
}

function resetResultAnalysisBoard() {
  if (!STATE.resultView.visible || !STATE.resultView.snapshotFen) return;
  if (STATE.resultView.analysisMode) setUiPhase("result_analysis", false);
  applyResultSnapshotToBoard();
  updateResultAnalysisControls();
}

// The ten quality codes of Ludus.Scoring map onto the eight the legacy CSS knows
// (brilliant and great look like perfect there).
function compatQualityCode(code) {
  const scoring = ludusModule("Scoring");
  try {
    if (scoring && typeof scoring.compatQuality === "function") return scoring.compatQuality(code);
  } catch (error) {
    // fall through
  }
  return code || "no_move";
}

function qualityToVerdictClass(rawQualityCode) {
  if (!rawQualityCode) return "";
  const qualityCode = compatQualityCode(rawQualityCode);
  if (qualityCode === "perfect" || qualityCode === "very_good") return "verdict-perfect";
  if (qualityCode === "good") return "verdict-good";
  if (qualityCode === "interesting" || qualityCode === "dubious") return "verdict-dubious";
  if (qualityCode === "bad" || qualityCode === "blunder") return "verdict-blunder";
  return "";
}

function showResultOverlay(title, pointsText, qualityCode) {
  if (!resultOverlayEl) return;
  if (resultOverlayTitleEl) resultOverlayTitleEl.textContent = title || t("result.title");
  if (resultOverlayPointsEl) resultOverlayPointsEl.textContent = pointsText || "";
  if (resultOverlayHeaderEl) {
    resultOverlayHeaderEl.className = "result-overlay-header";
    const vc = qualityToVerdictClass(qualityCode);
    if (vc) resultOverlayHeaderEl.classList.add(vc);
  }
  STATE.resultView.analysisMode = false;
  revealResultOverlay();
  updateResultAnalysisControls();
  renderBoardArrows();
}

// Shows the result panel and takes the reader to it. Every path that opens the
// result goes through here, so none of them can forget that last step.
function revealResultOverlay() {
  STATE.resultView.visible = true;
  document.body.classList.add("result-visible");
  if (resultOverlayEl) resultOverlayEl.classList.remove("hidden");
  bringResultIntoView();
}

// Which part of the result takes the focus: the verdict of the round, or the
// closing summary once the session is over.
function resultFocusTarget() {
  const innerVisible = resultOverlayInnerEl && !resultOverlayInnerEl.classList.contains("hidden");
  if (innerVisible && resultOverlayTitleEl) return resultOverlayTitleEl;
  if (sessionSummaryResultEl && !sessionSummaryResultEl.classList.contains("hidden")) return sessionSummaryResultEl;
  return resultOverlayTitleEl || resultOverlayEl;
}

// In one column the result sits under a board that fills a phone screen, so the
// verdict, the points and the way to continue all land below the fold and the
// round looks like it went nowhere. Bring the panel into view and move the
// focus onto it: the board has just stopped accepting moves, so a focus ring
// left parked there strands anyone using a keyboard or a screen reader.
function bringResultIntoView() {
  if (!resultOverlayEl) return;
  const reveal = () => {
    if (!STATE.resultView.visible) return;
    const panel = resultOverlayEl.querySelector(".result-overlay-panel") || resultOverlayEl;
    const target = resultFocusTarget();
    if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    if (typeof panel.getBoundingClientRect !== "function" || typeof panel.scrollIntoView !== "function") return;
    const rect = panel.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    if (!viewportHeight) return;
    if (rect.top >= 0 && rect.bottom <= viewportHeight) return;
    // Prefer resting the panel against the bottom edge: that keeps the board and
    // its buttons on screen above it. Only a panel taller than the screen gets
    // pinned to the top instead.
    const block = rect.height <= viewportHeight - 24 ? "end" : "start";
    // Jumps rather than glides: an animated scroll is silently ignored in some
    // browsers and by anyone who asked for less motion, and a fix that only
    // sometimes happens is the same problem over again.
    panel.scrollIntoView({ block, behavior: "auto" });
  };
  // Deferred rather than run inline so it measures the panel after the browser
  // has laid it out. A timer and not an animation frame: animation frames do not
  // run in a hidden tab, and coming back to the tab would find the result parked
  // off screen.
  setTimeout(reveal, 0);
}

function hideResultOverlay() {
  if (!resultOverlayEl) return;
  STATE.resultView.visible = false;
  STATE.resultView.analysisMode = false;
  STATE.resultView.snapshotFen = "";
  STATE.resultView.snapshotRevealed = { best: null, game: null, user: null, userAlt: null };
  STATE.resultView.context = null;
  document.body.classList.remove("result-visible");
  resultOverlayEl.classList.add("hidden");
  updateResultAnalysisControls();
  renderBoardArrows();
}

// Remembers what the result view is showing before a search for the next
// position tears it down, so a cancelled search can put it back.
function captureResultViewSnapshot() {
  return {
    context: STATE.resultView.context,
    snapshotFen: STATE.resultView.snapshotFen,
    snapshotRevealed: STATE.resultView.snapshotRevealed,
    duel: isDuelMode() ? {
      roundResults: STATE.duel.roundResults.slice(),
      currentPlayer: STATE.duel.currentPlayer,
      handoffReady: STATE.duel.handoffReady,
    } : null,
  };
}

// Puts the result back on screen after a cancelled search. Cancelling must not
// cost the result that was being read, the score, or the session itself.
function restoreResultView(snapshot) {
  if (!snapshot || !resultOverlayEl) return;
  STATE.resultView.context = snapshot.context;
  STATE.resultView.snapshotFen = snapshot.snapshotFen;
  STATE.resultView.snapshotRevealed = snapshot.snapshotRevealed;
  if (snapshot.duel) {
    STATE.duel.roundResults = snapshot.duel.roundResults;
    STATE.duel.currentPlayer = snapshot.duel.currentPlayer;
    STATE.duel.handoffReady = snapshot.duel.handoffReady;
  }
  STATE.resultView.analysisMode = false;
  revealResultOverlay();
  setUiPhase("result", true);
  if (roundStatusEl) roundStatusEl.textContent = t("game.searchCancelled");
  if (nextBtn) nextBtn.disabled = false;
  if (skipBtn) skipBtn.disabled = true;
  updateResultAnalysisControls();
  renderBoardArrows();
}

// The result on screen is drawn from STATE.resultView.context alone, so it can
// be drawn again (a language change) without recomputing anything.
function legacyScored(assessment) {
  return { ...assessment, diff: Number.isFinite(assessment.cpLoss) ? assessment.cpLoss : null };
}

// "You earned 7.4 / 10", or why there is nothing to earn.
function roundSummaryText(answer) {
  if (!answer.uci) {
    if (answer.hintsUsed >= 3) return t("core.hint.resultRevealed");
    return answer.noMoveReason === "timeout" ? t("evaluation.timeoutZeroPts") : t("evaluation.noMoveMadeZeroPts");
  }
  return t("core.result.earned", { points: formatPoints(answer.assessment.points), max: answer.assessment.maxPoints });
}

// The explanations that go under the verdict: why the move lost points (mate
// missed or allowed), what a hint cost, whether the score is provisional, and the
// short hedged sentences of Ludus.Insights. The later coach panel replaces this.
function appendResultNotes(context, answer) {
  if (!roundResultEl) return;
  const scoring = ludusModule("Scoring");
  const insightsApi = ludusModule("Insights");
  const notes = [];
  const assessment = answer.assessment;
  if (answer.uci && scoring) notes.push(scoring.reasonLabel(assessment.reason, STATE.language));
  if (answer.hintsUsed >= 1 && answer.hintsUsed < 3 && assessment.hintPenalty > 0) {
    notes.push(t("scoring.note.hint_penalty", { percent: Math.round((assessment.hintCost || 0) * 100) }));
  }
  if (answer.provisional) notes.push(t("core.result.provisional"));
  try {
    const messages = answer.insights && Array.isArray(answer.insights.messages) ? answer.insights.messages : [];
    if (insightsApi && messages.length) {
      insightsApi.renderMessages(messages.slice(0, 3), STATE.language).forEach((text) => notes.push(text));
    }
  } catch (error) {
    // Insights are decoration.
  }
  if (context.engine && context.engine.source === "local") notes.push(t("analysis.status.localEngineNotice"));
  notes.filter(Boolean).forEach((text) => {
    roundResultEl.insertAdjacentHTML("beforeend", `<p class="result-summary-line">${escapeHtml(text)}</p>`);
  });
}

function renderSoloResultPanels(context) {
  const answer = context.answers[0];
  renderRoundFeedbackTable(
    context.best.san,
    formatScoreText(context.best.score),
    context.master ? context.master.san : "-",
    context.master ? formatScoreText(context.master.score) : t("common.notAvailable"),
    answer.san,
    formatScoreText(answer.userScore),
    context.best.score,
    context.master ? context.master.score : NaN,
    answer.userScore,
    legacyScored(answer.assessment),
    answer.noMoveReason,
    { mode: "solo", noMove: !answer.uci, hasGameMove: Boolean(context.master) },
  );
  appendResultNotes(context, answer);
  showResultOverlay(t("game.result.yourMove"), roundSummaryText(answer), answer.assessment.qualityCode);
}

function renderDuelResultPanels(context) {
  const [first, second] = context.answers;
  const view = (answer) => ({
    name: answer.name,
    san: answer.san,
    qualityCode: answer.assessment.qualityCode,
    points: answer.assessment.points,
    diff: Number.isFinite(answer.assessment.cpLoss) ? answer.assessment.cpLoss : null,
    hit: answer.hit,
  });
  const p1 = view(first);
  const p2 = view(second);
  renderRoundFeedbackTable(
    context.best.san,
    formatScoreText(context.best.score),
    context.master ? context.master.san : "-",
    context.master ? formatScoreText(context.master.score) : t("common.notAvailable"),
    second.san,
    formatScoreText(second.userScore),
    context.best.score,
    context.master ? context.master.score : NaN,
    second.userScore,
    legacyScored(second.assessment),
    second.noMoveReason,
    { mode: "duel", noMove: !second.uci, hasGameMove: Boolean(context.master), duel: { player1: p1, player2: p2 } },
  );
  showResultOverlay(
    t("game.result.positionSolved"),
    `R${context.round}: ${p1.name} ${formatPoints(p1.points)} · ${p2.name} ${formatPoints(p2.points)}`,
    p1.points >= p2.points ? p1.qualityCode : p2.qualityCode,
  );
  let winnerText = t("game.comparison.tie");
  if (p1.points > p2.points) winnerText = t("game.comparison.advantage", { player: p1.name });
  if (p2.points > p1.points) winnerText = t("game.comparison.advantage", { player: p2.name });
  roundResultEl.insertAdjacentHTML("afterbegin", `<p class="result-summary-line">${escapeHtml(winnerText)}</p>`);
  if (context.engine && context.engine.source === "local") {
    roundResultEl.insertAdjacentHTML("beforeend", `<p class="result-summary-line">${escapeHtml(t("analysis.status.localEngineNotice"))}</p>`);
  }
}

function renderResultViewContext() {
  const context = STATE.resultView.context;
  if (!context) return;
  if (context.kind === "round_solo") {
    renderSoloResultPanels(context);
    return;
  }

  if (context.kind === "round_duel") {
    renderDuelResultPanels(context);
    return;
  }

  if (context.kind === "session_summary") {
    if (sessionSummaryResultEl) sessionSummaryResultEl.classList.remove("hidden");
    if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = sessionSummaryScoreText();
    const noMoreText = context.noMorePositions ? ` ${t("game.noMorePositions")}` : "";
    if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = finalSessionSummaryText() + noMoreText;
    if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");
    if (resultOverlayEl) resultOverlayEl.classList.remove("hidden");
    if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden");
  }
}

function setPanelActiveState(activeIndex) {
  const active = Number.isInteger(activeIndex) ? activeIndex : 0;
  if (leftPlayerPanelEl) {
    leftPlayerPanelEl.classList.toggle("is-active", active === 0);
    leftPlayerPanelEl.classList.toggle("is-inactive", active !== 0);
  }
  if (rightPlayerPanelEl) {
    rightPlayerPanelEl.classList.toggle("is-active", active === 1);
    rightPlayerPanelEl.classList.toggle("is-inactive", active !== 1);
  }
}

function mountSharedActionsToActivePanel() {
  if (!sharedActionsEl) return;
  // In one column the player cards sit below a board that fills a phone screen,
  // so leaving a timed round would mean scrolling away from it first. Keep
  // these actions with the board instead.
  if (oneColumnGameQuery && oneColumnGameQuery.matches && boardActionsSlotEl) {
    boardActionsSlotEl.appendChild(sharedActionsEl);
    return;
  }
  if (!isDuelMode()) {
    if (playerAActionsSlotEl) playerAActionsSlotEl.appendChild(sharedActionsEl);
    return;
  }
  const activeIdx = currentUiPlayerIndex();
  const host = activeIdx === 0 ? playerAActionsSlotEl : playerBActionsSlotEl;
  if (host) host.appendChild(sharedActionsEl);
}

function soloSessionTarget() {
  return Math.max(1, STATE.targetPositions || STATE.positions.length || 1);
}

// Points are out of ten per position, so the total is shown against what was
// possible so far: "72.4 / 100 pts" after ten positions.
function soloScoreText() {
  const played = Math.max(0, STATE.sessionPlayed);
  if (played <= 0) return `${formatPoints(STATE.score || 0)} pts`;
  return t("core.score.of", { points: formatPoints(STATE.score || 0), max: played * POINTS_PER_POSITION });
}

function duelMatchScoreText() {
  const played = Math.max(0, STATE.sessionPlayed);
  const line = `${duelPlayerName(0)} ${formatPoints(STATE.duel.scores[0] || 0)} - ${formatPoints(STATE.duel.scores[1] || 0)} ${duelPlayerName(1)}`;
  return played > 0 ? `${line} ${t("core.score.duelMax", { max: played * POINTS_PER_POSITION })}` : line;
}

function sessionSummaryScoreText() {
  return isDuelMode() ? duelMatchScoreText() : soloScoreText();
}

// Barra de progreso de la sesión: una sola barra proporcional con su texto al
// lado, anunciada como progressbar. Antes eran N guiones con estilos en línea,
// que con 200 posiciones llenaban más de una docena de renglones.
function renderSessionProgressBar(played, total) {
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));
  const safePlayed = clamp(Math.round(Number(played) || 0), 0, safeTotal);
  const pct = safeTotal > 0 ? Math.round((safePlayed / safeTotal) * 100) : 0;
  const label = escapeHtml(t("labels.positionsEvaluatedTitle"));
  return `<span class="solo-progress-text">${escapeHtml(soloProgressText(safePlayed, safeTotal))}</span>`
    + `<span class="solo-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${safeTotal}"`
    + ` aria-valuenow="${safePlayed}" aria-label="${label}">`
    + `<span class="solo-progress-fill" style="width:${pct}%"></span></span>`;
}

function soloProgressText(played = Math.max(0, STATE.sessionPlayed), total = soloSessionTarget()) {
  return `${t("labels.positionsEvaluatedTitle")}: ${played} / ${total}`;
}

// Centro de la barra de ronda: en duelo, el jugador al que le toca; en modo
// individual, el color que mueve en la posición que se está viendo.
function updateRoundTurn(playerIndex = currentUiPlayerIndex()) {
  if (!roundTurnEl) return;
  if (isDuelMode()) {
    roundTurnEl.textContent = t("game.turnPlayer", {
      player: duelPlayerName(playerIndex === 1 ? 1 : 0),
      turn: playerIndex === 1 ? 2 : 1,
    });
    return;
  }
  const turn = STATE.board ? STATE.board.turn : "";
  if (turn !== "w" && turn !== "b") {
    roundTurnEl.textContent = "";
    return;
  }
  roundTurnEl.textContent = turn === "b" ? t("game.turnBlack") : t("game.turnWhite");
}

function updatePlayerPanels() {
  const activeIdx = currentUiPlayerIndex();
  updateRoundTurn(activeIdx);
  if (soloProgressLineEl) {
    soloProgressLineEl.innerHTML = renderSessionProgressBar(Math.max(0, STATE.sessionPlayed), soloSessionTarget());
  }
  if (isDuelMode()) {
    const p1 = duelPlayerName(0);
    const p2 = duelPlayerName(1);
    if (playerAKickerEl) playerAKickerEl.textContent = t("players.kicker1");
    if (playerBKickerEl) playerBKickerEl.textContent = t("players.kicker2");
    if (playerANameEl) playerANameEl.textContent = p1;
    if (playerBNameEl) playerBNameEl.textContent = p2;
    if (playerAAvatarEl) playerAAvatarEl.textContent = initialsFromName(p1, "J1");
    if (playerBAvatarEl) playerBAvatarEl.textContent = initialsFromName(p2, "J2");
    // if (playerAScoreLabelEl) playerAScoreLabelEl.textContent = "Puntaje";
    // if (playerBScoreLabelEl) playerBScoreLabelEl.textContent = "Puntaje";
    if (playerAScoreValueEl) playerAScoreValueEl.textContent = formatPoints(STATE.duel.scores[0] || 0);
    if (playerBScoreValueEl) playerBScoreValueEl.textContent = formatPoints(STATE.duel.scores[1] || 0);
    setPanelActiveState(activeIdx);
    mountSharedActionsToActivePanel();
    return;
  }

  if (playerANameEl) playerANameEl.textContent = t("players.soloSession");
  if (playerAKickerEl) playerAKickerEl.textContent = t("game.studyMode");
  if (playerAAvatarEl) playerAAvatarEl.textContent = initialsFromName(t("players.soloSession"), "S");
  if (playerAScoreValueEl) playerAScoreValueEl.textContent = soloScoreText();
  if (playerBScoreValueEl) playerBScoreValueEl.textContent = `${Math.max(0, STATE.sessionPlayed)} / ${soloSessionTarget()}`;
  setPanelActiveState(0);
  mountSharedActionsToActivePanel();
}

function formatClock(remainingMs) {
  const clamped = Math.max(0, Math.round(remainingMs));
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setThinkingMode(active) {
  document.body.classList.toggle("thinking-mode", Boolean(active));
}

function setScoringInfoVisible(visible) {
  const show = Boolean(visible);
  if (scorePanelEl) scorePanelEl.classList.toggle("hidden", true);
  if (competitiveStatusEl) competitiveStatusEl.classList.toggle("hidden", !(show && isDuelMode()));
}

function updateScoreDisplay() {
  if (!scoreEl) return;
  if (isDuelMode()) {
    if (scoreLabelEl) scoreLabelEl.textContent = t("score.duelScore");
    const p1 = duelPlayerName(0);
    const p2 = duelPlayerName(1);
    scoreEl.textContent = `${p1}: ${formatPoints(STATE.duel.scores[0])} | ${p2}: ${formatPoints(STATE.duel.scores[1])}`;
    updatePlayerPanels();
    return;
  }
  if (scoreLabelEl) scoreLabelEl.textContent = t("score.totalPoints");
  scoreEl.textContent = formatPoints(STATE.score);
  updatePlayerPanels();
}

function updateCompetitiveStatus() {
  if (!competitiveStatusEl) return;
  const seconds = normalizeTurnTimeSeconds(STATE.turnTimeSeconds);
  const system = scoringSystemLabel(STATE.scoringSystem);
  if (!isDuelMode()) {
    competitiveStatusEl.textContent = "";
    return;
  }
  competitiveStatusEl.textContent = t("game.duelCompetitive", { seconds, system });
}

function resetDuelState() {
  STATE.duel.scores = [0, 0];
  STATE.duel.hits = [0, 0];
  STATE.duel.currentPlayer = 0;
  STATE.duel.roundResults = [null, null];
  STATE.duel.handoffReady = false;
}

function applyGameFormat(format) {
  const safe = normalizeGameFormat(format);
  STATE.gameFormat = safe;
  if (gameFormatEl) gameFormatEl.value = safe;
  if (duelConfigEl) duelConfigEl.classList.toggle("hidden", safe !== "duel");
  if (gameFormatHintEl) {
    gameFormatHintEl.textContent = safe === "duel"
      ? t("game.duelHint")
      : t("game.soloHint");
  }
  document.body.classList.toggle("duel-mode", safe === "duel");
  document.body.classList.toggle("solo-mode", safe !== "duel");
  if (safe !== "duel") {
    resetDuelState();
  }
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();
  setUiPhase("playing", false);
  updateScoreDisplay();
  updateCompetitiveStatus();
  renderSessionProgress();
  updatePlayerPanels();
}

function updateWizardTimerChipSelection(seconds = STATE.setupWizard.turnTimeSeconds) {
  let selectedChip = null;
  wizardTimerChipEls.forEach((chipEl) => {
    const chipSeconds = Number(chipEl.getAttribute("data-seconds")) || 0;
    const selected = chipSeconds === seconds;
    chipEl.classList.toggle("is-selected", selected);
    chipEl.setAttribute("aria-checked", selected ? "true" : "false");
    if (selected) selectedChip = chipEl;
  });
  setRadioGroupTabIndex(wizardTimerChipEls, selectedChip);
}

function setWizardTurnTimeSeconds(value, options = {}) {
  const fallback = options.fallback ?? STATE.setupWizard.turnTimeSeconds ?? DEFAULT_TURN_TIME_SECONDS;
  const seconds = normalizeTurnTimeSeconds(value, { fallback });
  STATE.setupWizard.turnTimeSeconds = seconds;
  STATE.turnTimeSeconds = seconds;
  if (turnTimeSecondsEl) turnTimeSecondsEl.value = String(seconds);
  updateWizardTimerChipSelection(seconds);
  if (!options.skipPersist) saveSetupPreference(seconds);
  return seconds;
}

function readDuelPlayersFromInputs() {
  STATE.duel.players = [
    sanitizePlayerName(duelPlayerAEl ? duelPlayerAEl.value : "", DUEL_DEFAULT_PLAYERS[0]),
    sanitizePlayerName(duelPlayerBEl ? duelPlayerBEl.value : "", DUEL_DEFAULT_PLAYERS[1]),
  ];
  if (duelPlayerAEl) duelPlayerAEl.value = STATE.duel.players[0];
  if (duelPlayerBEl) duelPlayerBEl.value = STATE.duel.players[1];
  updatePlayerPanels();
}

function stopRoundTimer() {
  if (STATE.timer.intervalId) {
    clearInterval(STATE.timer.intervalId);
    STATE.timer.intervalId = null;
  }
}

const CLOCK_ANNOUNCE_MILESTONES_SEC = [60, 30, 10, 0];

// The clock's visible text updates every tick (CLOCK_TICK_MS), but announcing
// that on every tick would drown out board/turn/result announcements. Only
// these milestones reach the live region, and each one only once.
function announceClockMilestone(totalSeconds) {
  if (!soloClockAnnounceEl) return;
  if (!CLOCK_ANNOUNCE_MILESTONES_SEC.includes(totalSeconds)) return;
  if (STATE.timer.lastAnnouncedSeconds === totalSeconds) return;
  STATE.timer.lastAnnouncedSeconds = totalSeconds;
  soloClockAnnounceEl.textContent = totalSeconds > 0
    ? t("labels.clockMilestone", { seconds: totalSeconds })
    : t("labels.clockTimeUp");
}

// The relaxed state of the clock ("untimed" in Settings or in the session's
// options): an infinity sign and a full bar, no countdown, no urgency.
function isUntimedSession() {
  return STATE.clockMode === "untimed";
}

// Un solo reloj para los dos modos: el de la barra de ronda. En duelo muestra
// el tiempo del jugador que está al turno, porque sólo uno juega a la vez.
function updateRoundTimerUi(remainingMs = STATE.timer.deadlineMs - Date.now()) {
  if (!soloClockRailEl || !soloClockValueEl || !soloClockBarEl) return;

  const showClock = document.body.classList.contains("playing-mode") && !STATE.resultView.visible;
  soloClockRailEl.classList.toggle("hidden", !showClock);
  if (!showClock) return;

  const untimed = isUntimedSession();
  soloClockRailEl.classList.toggle("is-untimed", untimed);
  soloClockRailEl.setAttribute("aria-label", untimed ? t("core.clock.untimedAria") : t("labels.clockTitle"));
  if (untimed) {
    soloClockValueEl.textContent = "\u221E";
    soloClockValueEl.setAttribute("title", t("core.clock.untimedAria"));
    soloClockBarEl.style.setProperty("--clock-ratio", "100%");
    soloClockRailEl.classList.remove("urgency-mid", "urgency-high");
    return;
  }
  soloClockValueEl.removeAttribute("title");

  const duration = Math.max(1, STATE.timer.durationMs || Math.round(STATE.turnTimeSeconds * 1000));
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = clamp(safeRemaining / duration, 0, 1);

  soloClockValueEl.textContent = formatClock(safeRemaining);
  soloClockBarEl.style.setProperty("--clock-ratio", `${Math.round(ratio * 100)}%`);
  announceClockMilestone(Math.ceil(safeRemaining / 1000));
  soloClockRailEl.classList.remove("urgency-mid", "urgency-high");
  if (ratio <= 0.2) {
    soloClockRailEl.classList.add("urgency-high");
  } else if (ratio <= 0.45) {
    soloClockRailEl.classList.add("urgency-mid");
  }
}

function startRoundTimer() {
  stopRoundTimer();
  STATE.roundStartedAt = Date.now();
  if (isUntimedSession()) {
    // Nothing counts down and nothing times out; the round is over when the
    // person answers, skips or takes the hint that shows the move.
    STATE.timer.durationMs = 0;
    STATE.timer.deadlineMs = 0;
    STATE.timer.lastAnnouncedSeconds = null;
    if (soloClockAnnounceEl) soloClockAnnounceEl.textContent = "";
    updateRoundTimerUi();
    return;
  }
  const durationMs = Math.round(normalizeTurnTimeSeconds(STATE.turnTimeSeconds) * 1000);
  STATE.timer.durationMs = durationMs;
  STATE.timer.deadlineMs = Date.now() + durationMs;
  STATE.timer.lastAnnouncedSeconds = null;
  if (soloClockAnnounceEl) soloClockAnnounceEl.textContent = "";
  updateRoundTimerUi(durationMs);
  STATE.timer.intervalId = setInterval(() => {
    const remainingMs = STATE.timer.deadlineMs - Date.now();
    if (remainingMs <= 0) {
      updateRoundTimerUi(0);
      stopRoundTimer();
      if (!STATE.roundSubmitted && !STATE.isResolvingRound) {
        void submitNoMove("timeout");
      }
      return;
    }
    updateRoundTimerUi(remainingMs);
  }, CLOCK_TICK_MS);
}

function setUserMode(mode) {
  const safe = mode === "engineer" ? "engineer" : "citizen";
  const previous = STATE.userMode;
  STATE.userMode = safe;
  document.body.classList.toggle("mode-engineer", safe === "engineer");
  document.body.classList.toggle("mode-citizen", safe === "citizen");

  if (safe === "citizen") {
    if (thresholdEl) thresholdEl.value = String(DEFAULT_CITIZEN_THRESHOLD);
    if (analysisTimeMsEl) analysisTimeMsEl.value = String(DEFAULT_CITIZEN_MOVETIME);
    if (scoringSystemEl) scoringSystemEl.value = DEFAULT_SCORING_SYSTEM;
    if (sessionSizeEl && (!Number.isFinite(Number(sessionSizeEl.value)) || Number(sessionSizeEl.value) <= 0)) {
      sessionSizeEl.value = String(DEFAULT_CITIZEN_SESSION_SIZE);
    }
    if (turnTimeSecondsEl && (!Number.isFinite(Number(turnTimeSecondsEl.value)) || Number(turnTimeSecondsEl.value) < MIN_TURN_TIME_SECONDS)) {
      turnTimeSecondsEl.value = String(DEFAULT_TURN_TIME_SECONDS);
    }
  }

  if (previous && previous !== safe && isRemoteSourceMode() && STATE.remotePgnSources.length > 0) {
    clearRemotePgnSources();
    showSourceNeedsRedownloadMessage(t("provider.modeChangedRedownload"));
  }

  updatePgnSelectionUi();
}

function getLichessFetchSettings() {
  const targetPositions = clamp(
    Number(sessionSizeEl ? sessionSizeEl.value : DEFAULT_CITIZEN_SESSION_SIZE) || DEFAULT_CITIZEN_SESSION_SIZE,
    1,
    200,
  );
  if (sessionSizeEl) sessionSizeEl.value = String(targetPositions);
  const maxGames = clamp(Math.round(targetPositions * 5), 20, 300);
  const minSlowGames = clamp(Math.min(Math.max(12, Math.round(targetPositions * 2)), maxGames), 1, maxGames);
  return {
    maxGames,
    preferredPerf: ["classical", "rapid"],
    minSlowGames,
    fallbackBlitz: true,
    fallbackBullet: true,
  };
}

function describeLichessNormalProtocol(settings = getLichessFetchSettings()) {
  const preferredLabel = joinPreferredTimeClasses(settings.preferredPerf);
  return t("provider.protocolLichess", {
    preferred: preferredLabel,
    minSlowGames: settings.minSlowGames,
    maxGames: settings.maxGames,
  });
}

function getChessComFetchSettings() {
  const targetPositions = clamp(
    Number(sessionSizeEl ? sessionSizeEl.value : DEFAULT_CITIZEN_SESSION_SIZE) || DEFAULT_CITIZEN_SESSION_SIZE,
    1,
    200,
  );
  if (sessionSizeEl) sessionSizeEl.value = String(targetPositions);
  const maxGames = clamp(Math.round(targetPositions * 5), 20, 300);
  const minSlowGames = clamp(Math.min(Math.max(12, Math.round(targetPositions * 2)), maxGames), 1, maxGames);
  return {
    maxGames,
    preferredSlowClasses: ["rapid", "daily"],
    minSlowGames,
    fallbackBlitz: true,
    fallbackBullet: true,
  };
}

function describeChessComNormalProtocol(settings = getChessComFetchSettings()) {
  const preferredLabel = joinPreferredTimeClasses(settings.preferredSlowClasses);
  return t("provider.protocolChesscom", {
    preferred: preferredLabel,
    minSlowGames: settings.minSlowGames,
    maxGames: settings.maxGames,
  });
}

// What the mistake search asks of the engine. The threshold above which a move of
// the person's own game counts as a mistake comes from the settings
// ("mistakes.sensitivity"); the compat inputs only apply in the (hidden) engineer mode.
function settingsMistakeThresholdCp() {
  const settings = ludusModule("Settings");
  try {
    if (settings && typeof settings.mistakeThresholdCp === "function") {
      const value = Number(settings.mistakeThresholdCp());
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch (error) {
    // fall through to the standard sensitivity
  }
  return DEFAULT_CITIZEN_THRESHOLD;
}

function getEffectiveAnalysisConfig() {
  if (STATE.userMode === "citizen") {
    return {
      moveTimeMs: DEFAULT_CITIZEN_MOVETIME,
      thresholdCp: settingsMistakeThresholdCp(),
      scoringSystem: DEFAULT_SCORING_SYSTEM,
    };
  }
  return {
    moveTimeMs: clamp(Number(analysisTimeMsEl.value) || DEFAULT_CITIZEN_MOVETIME, 50, 10000),
    thresholdCp: clamp(Number(thresholdEl.value) || DEFAULT_CITIZEN_THRESHOLD, 50, 800),
    scoringSystem: normalizeScoringSystem(scoringSystemEl ? scoringSystemEl.value : DEFAULT_SCORING_SYSTEM),
  };
}

function sanitizeWizardUsername(value) {
  return String(value || "").trim();
}

function collectWizardConfig() {
  const mode = normalizeGameFormat(STATE.setupWizard.mode);
  const playerA = String(duelPlayerAEl ? duelPlayerAEl.value : STATE.setupWizard.duelNames[0] || "").trim().replace(/\s+/g, " ").slice(0, 20);
  const playerB = String(duelPlayerBEl ? duelPlayerBEl.value : STATE.setupWizard.duelNames[1] || "").trim().replace(/\s+/g, " ").slice(0, 20);
  const platform = getRemoteProviderModeFromUi();
  const username = sanitizeWizardUsername(onlineUserInputEl ? onlineUserInputEl.value : STATE.setupWizard.username);
  const sessionSize = clamp(Number(sessionSizeEl ? sessionSizeEl.value : STATE.setupWizard.sessionSize) || DEFAULT_CITIZEN_SESSION_SIZE, 1, 200);
  const turnTimeSeconds = normalizeTurnTimeSeconds(
    turnTimeSecondsEl ? turnTimeSecondsEl.value : STATE.setupWizard.turnTimeSeconds,
    { fallback: STATE.setupWizard.turnTimeSeconds },
  );

  STATE.setupWizard.mode = mode;
  STATE.setupWizard.duelNames = [playerA, playerB];
  STATE.setupWizard.platform = platform;
  STATE.setupWizard.username = username;
  STATE.setupWizard.sessionSize = sessionSize;
  STATE.setupWizard.turnTimeSeconds = turnTimeSeconds;

  return {
    mode,
    duelNames: [playerA, playerB],
    platform,
    username,
    sessionSize,
    turnTimeSeconds,
  };
}

function syncWizardToLegacyInputs() {
  const config = collectWizardConfig();
  if (gameFormatEl) gameFormatEl.value = config.mode;
  if (duelPlayerAEl) duelPlayerAEl.value = config.duelNames[0];
  if (duelPlayerBEl) duelPlayerBEl.value = config.duelNames[1];
  if (onlineProviderSelectEl) onlineProviderSelectEl.value = config.platform;
  if (onlineUserInputEl) onlineUserInputEl.value = config.username;
  if (sessionSizeEl) sessionSizeEl.value = String(config.sessionSize);
  if (turnTimeSecondsEl) turnTimeSecondsEl.value = String(config.turnTimeSeconds);
  updateWizardTimerChipSelection(config.turnTimeSeconds);
  setSourceMode(config.platform);
}

function clearWizardSourceError() {
  STATE.setupWizard.sourceError = null;
  if (wizardSourceErrorEl) {
    wizardSourceErrorEl.textContent = "";
    wizardSourceErrorEl.classList.add("hidden");
  }
  if (wizardSourceCtaEl) wizardSourceCtaEl.classList.add("hidden");
  clearFieldInvalid(onlineUserInputEl, "wizard-source-error");
  clearFieldInvalid(wizardPlatformGroupEl, "wizard-source-error");
}

// field identifies which step-2 control the error is actually about
// ("platform" or "username"), so only that control gets flagged invalid —
// network/throttle errors (called without a field) just show the text.
function showWizardSourceError(key = "common.sourceError", params = {}, field = null) {
  const hasTranslation = Object.prototype.hasOwnProperty.call(TRANSLATIONS[preferredLocale()] || {}, key)
    || Object.prototype.hasOwnProperty.call(TRANSLATIONS.es || {}, key);
  const text = hasTranslation ? t(key, params) : String(key || "").trim();
  STATE.setupWizard.sourceError = hasTranslation ? { key, params } : { raw: text };
  if (wizardSourceErrorEl) {
    wizardSourceErrorEl.textContent = text;
    wizardSourceErrorEl.classList.remove("hidden");
  }
  if (wizardSourceCtaEl) wizardSourceCtaEl.classList.remove("hidden");
  if (field === "username") setFieldInvalid(onlineUserInputEl, "wizard-source-error");
  else clearFieldInvalid(onlineUserInputEl, "wizard-source-error");
  if (field === "platform") setFieldInvalid(wizardPlatformGroupEl, "wizard-source-error");
  else clearFieldInvalid(wizardPlatformGroupEl, "wizard-source-error");
}

function clearWizardStepError() {
  if (wizardStepErrorEl) {
    wizardStepErrorEl.textContent = "";
    wizardStepErrorEl.classList.add("hidden");
  }
  [duelPlayerAEl, duelPlayerBEl].forEach((inputEl) => clearFieldInvalid(inputEl, "wizard-step-error"));
  clearFieldInvalid(wizardModeGroupEl, "wizard-step-error");
}

// field identifies which step-1 control the error is about ("mode" or
// "duelNames"); only that control gets aria-invalid + aria-describedby.
function showWizardStepError(message = "", field = null) {
  if (!wizardStepErrorEl) return;
  const text = String(message || "").trim();
  wizardStepErrorEl.textContent = text;
  wizardStepErrorEl.classList.toggle("hidden", !text);
  const duelNamesInvalid = Boolean(text) && field === "duelNames";
  [duelPlayerAEl, duelPlayerBEl].forEach((inputEl) => {
    if (duelNamesInvalid) setFieldInvalid(inputEl, "wizard-step-error");
    else clearFieldInvalid(inputEl, "wizard-step-error");
  });
  const modeInvalid = Boolean(text) && field === "mode";
  if (modeInvalid) setFieldInvalid(wizardModeGroupEl, "wizard-step-error");
  else clearFieldInvalid(wizardModeGroupEl, "wizard-step-error");
}

function focusFirstInvalidWizardControl(step, validation = {}) {
  if (step === 1 && validation.reason === t("wizard.validation.fillDuelNames")) {
    const firstEmpty = [duelPlayerAEl, duelPlayerBEl].find((inputEl) => !String(inputEl?.value || "").trim());
    if (firstEmpty) firstEmpty.focus();
    return;
  }
  if (step === 1 && validation.reason === t("wizard.validation.duelNameMax")) {
    const firstLong = [duelPlayerAEl, duelPlayerBEl].find((inputEl) => String(inputEl?.value || "").trim().length > 20);
    if (firstLong) firstLong.focus();
    return;
  }
  if (step === 2 && onlineUserInputEl) {
    onlineUserInputEl.focus();
    return;
  }
  if (step === 3 && sessionSizeEl) sessionSizeEl.focus();
}

function syncWizardSummaryDisclosure() {
  if (!wizardSummaryBoxEl) return;
  if (!wizardWideScreenQuery || wizardWideScreenQuery.matches) wizardSummaryBoxEl.open = true;
}

function renderWizardSummary() {
  syncWizardSummaryDisclosure();
  if (!wizardSummaryEl) return;
  const config = collectWizardConfig();
  const modeText = config.mode === "duel"
    ? t("game.localDuel", { a: escapeHtml(config.duelNames[0]), b: escapeHtml(config.duelNames[1]) })
    : t("game.studyMode");
  const platformText = providerLabel(config.platform);
  wizardSummaryEl.innerHTML = [
    `<p><strong>${escapeHtml(t("game.summaryMode"))}:</strong> ${modeText}</p>`,
    `<p><strong>${escapeHtml(t("game.summaryPlatform"))}:</strong> ${escapeHtml(platformText)}</p>`,
    `<p><strong>${escapeHtml(t("game.summaryUser"))}:</strong> ${escapeHtml(config.username || "-")}</p>`,
    `<p><strong>${escapeHtml(t("game.summaryPositions"))}:</strong> ${config.sessionSize}</p>`,
    `<p><strong>${escapeHtml(t("game.summaryRoundTime"))}:</strong> ${escapeHtml(wizardClockIsUntimed() ? t("core.clock.summary") : `${config.turnTimeSeconds}s`)}</p>`,
  ].join("");
}

// Untimed play is a setting; while it is on, the wizard has no round time to ask for.
function wizardClockIsUntimed() {
  return settingsGet("clock.mode", "timed") === "untimed";
}

// A screen that already knows who plays (Ludus.game.openOwnGamesSetup) skips the
// first step; the indicator then counts only the steps that are shown.
function wizardFirstStep() {
  return STATE.setupWizard.skipModeStep ? 2 : 1;
}

function wizardVisibleSteps() {
  return STATE.setupWizard.skipModeStep ? 2 : 3;
}

function renderWizardHeading() {
  const headingEl = document.querySelector("#setup-wizard .wizard-header h2");
  if (!headingEl) return;
  const key = STATE.setupWizard.skipModeStep ? "core.wizard.heading.2" : "wizard.heading";
  headingEl.setAttribute("data-i18n", key);
  headingEl.textContent = t(key);
}

function renderWizardStep() {
  const firstStep = wizardFirstStep();
  const totalSteps = wizardVisibleSteps();
  const step = clamp(Number(STATE.setupWizard.step) || firstStep, firstStep, 3);
  STATE.setupWizard.step = step;
  const shownStep = step - (firstStep - 1);
  const config = collectWizardConfig();
  renderWizardHeading();
  const timerGroupEl = turnTimeSecondsEl && typeof turnTimeSecondsEl.closest === "function"
    ? turnTimeSecondsEl.closest(".wizard-step-group")
    : null;
  if (timerGroupEl) timerGroupEl.classList.toggle("hidden", wizardClockIsUntimed());

  wizardStepEls.forEach((stepEl, idx) => {
    if (!stepEl) return;
    const isCurrent = idx + 1 === step;
    stepEl.classList.toggle("hidden", !isCurrent);
    stepEl.classList.toggle("is-active", isCurrent);
  });

  if (wizardStepIndicatorEl) wizardStepIndicatorEl.textContent = t("wizard.stepIndicator", { step: shownStep, total: totalSteps });
  if (wizardProgressBarEl) wizardProgressBarEl.style.width = `${Math.round((shownStep / totalSteps) * 100)}%`;

  if (wizardModeSoloBtn) {
    const selected = config.mode === "solo";
    wizardModeSoloBtn.classList.toggle("is-selected", selected);
    wizardModeSoloBtn.setAttribute("aria-checked", selected ? "true" : "false");
  }
  if (wizardModeDuelBtn) {
    const selected = config.mode === "duel";
    wizardModeDuelBtn.classList.toggle("is-selected", selected);
    wizardModeDuelBtn.setAttribute("aria-checked", selected ? "true" : "false");
  }
  setRadioGroupTabIndex(wizardModeGroupEls, config.mode === "duel" ? wizardModeDuelBtn : wizardModeSoloBtn);
  if (duelConfigEl) duelConfigEl.classList.toggle("hidden", config.mode !== "duel");

  if (wizardProviderLichessBtn) {
    const selected = config.platform === "lichess";
    wizardProviderLichessBtn.classList.toggle("is-selected", selected);
    wizardProviderLichessBtn.setAttribute("aria-checked", selected ? "true" : "false");
  }
  if (wizardProviderChessComBtn) {
    const selected = config.platform === "chesscom";
    wizardProviderChessComBtn.classList.toggle("is-selected", selected);
    wizardProviderChessComBtn.setAttribute("aria-checked", selected ? "true" : "false");
  }
  setRadioGroupTabIndex(
    wizardPlatformGroupEls,
    config.platform === "chesscom" ? wizardProviderChessComBtn : wizardProviderLichessBtn,
  );

  let selectedSizeChip = null;
  wizardSizeChipEls.forEach((chipEl) => {
    const chipSize = Number(chipEl.getAttribute("data-size")) || 0;
    const selected = chipSize === config.sessionSize;
    chipEl.classList.toggle("is-selected", selected);
    chipEl.setAttribute("aria-checked", selected ? "true" : "false");
    if (selected) selectedSizeChip = chipEl;
  });
  setRadioGroupTabIndex(wizardSizeChipEls, selectedSizeChip);
  updateWizardTimerChipSelection(config.turnTimeSeconds);

  if (wizardPrevBtn) wizardPrevBtn.classList.toggle("hidden", step <= firstStep);
  if (wizardNextBtn) wizardNextBtn.classList.toggle("hidden", step >= 3);
  if (analyzeBtn) analyzeBtn.classList.toggle("hidden", step !== 3);

  if (step !== 1) clearWizardStepError();
  if (step !== 2) clearWizardSourceError();
  // El resumen ya no vive dentro del paso 3: acompaña a los tres pasos, así que
  // se repinta siempre para que refleje lo que se acaba de elegir.
  renderWizardSummary();

  updateAnalyzeButtonState();
}

function validateWizardStep(step = STATE.setupWizard.step) {
  const config = collectWizardConfig();
  const safeStep = clamp(Number(step) || 1, 1, 3);
  const usernamePattern = /^[A-Za-z0-9_-]{3,30}$/;

  if (safeStep >= 1) {
    if (config.mode !== "solo" && config.mode !== "duel") {
      return { valid: false, reason: t("wizard.validation.chooseMode"), field: "mode" };
    }
    if (config.mode === "duel") {
      const [a, b] = config.duelNames;
      if (!a || !b) {
        return { valid: false, reason: t("wizard.validation.fillDuelNames"), field: "duelNames" };
      }
      if (a.length > 20 || b.length > 20) {
        return { valid: false, reason: t("wizard.validation.duelNameMax"), field: "duelNames" };
      }
    }
  }

  if (safeStep >= 2) {
    if (!isRemoteSourceMode(config.platform)) {
      return { valid: false, reason: t("wizard.validation.choosePlatform"), field: "platform" };
    }
    if (!config.username) {
      return { valid: false, reason: t("wizard.validation.enterUsername"), field: "username" };
    }
    if (!usernamePattern.test(config.username)) {
      return { valid: false, reason: t("wizard.validation.invalidUsername"), field: "username" };
    }
  }

  if (safeStep >= 3) {
    if (!Number.isInteger(config.sessionSize) || config.sessionSize < 1 || config.sessionSize > 200) {
      return { valid: false, reason: t("wizard.validation.chooseCount"), field: "count" };
    }
  }

  return { valid: true, reason: t("wizard.validation.ready") };
}

function goToWizardStep(step) {
  STATE.setupWizard.step = clamp(Number(step) || wizardFirstStep(), wizardFirstStep(), 3);
  renderWizardStep();
  window.scrollTo({ top: 0, behavior: "auto" });
  const heading = document.getElementById(`wizard-step-${STATE.setupWizard.step}-title`);
  // tabIndex = -1 lo hace enfocable por código sin agregarlo al recorrido del tabulador,
  // y preventScroll evita que el enfoque vuelva a mover la página.
  if (heading && heading.offsetParent !== null) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function resetSetupWizard({ mode = null, statusMessage = "", skipModeStep = false } = {}) {
  if (mode) {
    STATE.setupWizard.mode = normalizeGameFormat(mode);
  }
  STATE.setupWizard.skipModeStep = Boolean(skipModeStep);
  STATE.setupWizard.step = wizardFirstStep();
  STATE.setupWizard.platform = getRemoteProviderModeFromUi();
  STATE.setupWizard.username = sanitizeWizardUsername(onlineUserInputEl ? onlineUserInputEl.value : "");
  STATE.setupWizard.sessionSize = clamp(Number(sessionSizeEl ? sessionSizeEl.value : DEFAULT_CITIZEN_SESSION_SIZE) || DEFAULT_CITIZEN_SESSION_SIZE, 1, 200);
  STATE.setupWizard.turnTimeSeconds = normalizeTurnTimeSeconds(
    turnTimeSecondsEl ? turnTimeSecondsEl.value : STATE.setupWizard.turnTimeSeconds,
    { fallback: STATE.setupWizard.turnTimeSeconds },
  );
  STATE.setupWizard.sourceError = null;
  clearWizardStepError();
  clearWizardSourceError();
  syncWizardToLegacyInputs();
  if (analysisStatusEl && statusMessage) analysisStatusEl.textContent = statusMessage;
  goToWizardStep(wizardFirstStep());
}

function sendWizardBackToSourceStep(key = "common.sourceError", params = {}) {
  showWizardSourceError(key, params);
  STATE.ui.setupAnalyzing = false;
  setWizardFormControlsDisabled(false);
  if (analyzeBtn) analyzeBtn.disabled = false;
  goToWizardStep(2);
  if (onlineUserInputEl) onlineUserInputEl.focus();
}

// Inputs the user could still edit while a download/analysis is in flight.
// The session-token checks elsewhere already stop a stale download from being
// installed under the wrong identity, so this only closes a UI affordance gap
// (editing fields mid-analysis is confusing, not unsafe). Navigation controls
// like the wizard's prev/next and the exit-to-start button are intentionally
// left out so the user can still bail out while analysis runs.
const wizardFormControlEls = [
  wizardModeSoloBtn,
  wizardModeDuelBtn,
  duelPlayerAEl,
  duelPlayerBEl,
  wizardProviderLichessBtn,
  wizardProviderChessComBtn,
  onlineUserInputEl,
  wizardRetryUserBtn,
  wizardSwitchPlatformBtn,
  wizardClearCacheBtn,
  ...wizardSizeChipEls,
  ...wizardTimerChipEls,
  sessionSizeEl,
  turnTimeSecondsEl,
];

function setWizardFormControlsDisabled(disabled) {
  wizardFormControlEls.forEach((el) => {
    if (el) el.disabled = disabled;
  });
}

function getSetupReadiness() {
  syncWizardToLegacyInputs();
  return validateWizardStep(3);
}

function updateAnalyzeButtonState() {
  const readiness = getSetupReadiness();
  const blockedByAnalysis = Boolean(STATE.ui.setupAnalyzing || STATE.analysisInProgress);
  if (analyzeBtn) {
    const isSummaryStep = STATE.setupWizard.step === 3;
    analyzeBtn.disabled = blockedByAnalysis || !readiness.valid || !isSummaryStep;
  }
  const showsReadinessIssue = !blockedByAnalysis && STATE.setupWizard.step !== 2 && !readiness.valid;
  if (analysisStatusEl && showsReadinessIssue) {
    analysisStatusEl.textContent = readiness.reason;
  }
  // Keeps the count field's invalid state live: it clears itself the moment
  // the value becomes valid again, not only on the next "Siguiente" click.
  if (showsReadinessIssue && readiness.field === "count") {
    setFieldInvalid(sessionSizeEl, "analysis-status");
  } else {
    clearFieldInvalid(sessionSizeEl, "analysis-status");
  }
  return readiness;
}

function updatePgnSelectionUi() {
  const config = collectWizardConfig();
  const hasRemote = hasAnyPgnSource(true);
  const remote = hasRemote ? STATE.remotePgnSources[0] : null;

  if (onlineStatusEl && !STATE.ui.setupAnalyzing && !STATE.setupWizard.sourceError) {
    if (!config.username) {
      onlineStatusEl.textContent = t("wizard.step2.enterUsername");
    } else if (hasRemote && remote?.username) {
      const warning = remoteWarningText(remote);
      const warningText = warning ? ` ${warning}` : "";
      onlineStatusEl.textContent = t("provider.baseReady", { username: remote.username, warning: warningText });
    } else {
      onlineStatusEl.textContent = t("provider.readyToDownload");
    }
  }

  if (configFilesStatusEl) {
    if (hasRemote && remote?.username) {
      const remoteProviderLabel = providerLabel(getRemoteProvider(remote));
      const games = Number.isFinite(remote.games) ? remote.games : 0;
      const warning = remoteWarningText(remote);
      const warningText = warning ? ` ${warning}` : "";
      configFilesStatusEl.textContent = t("provider.sourceLoaded", {
        provider: remoteProviderLabel,
        username: remote.username,
        games,
        warning: warningText,
      });
    } else {
      configFilesStatusEl.textContent = "";
    }
  }

  if (playerTargetLabelEl) playerTargetLabelEl.textContent = t("players.targetLabel");
  if (playerNameDetectedEl) playerNameDetectedEl.textContent = config.username || t("players.enterUserContinue");
  if (playerTargetHintEl) playerTargetHintEl.textContent = t("players.targetHint");

  renderWizardStep();
}

// ---------- Navigation (Ludus.router) ----------
// Every screen is shown through the router. The old sections of this page are
// registered as router screens too ("landing", "setup", "game", see
// registerRouterScreens) and this file only asks for them by name.

// Which of the screen modules mounted without throwing (a broken screen must
// never take the app down: it is just not registered).
const mountedScreens = {};

function routerShow(id, params) {
  const router = ludusModule("router");
  if (!router || typeof router.show !== "function") return false;
  try {
    return Boolean(router.show(id, params));
  } catch (error) {
    console.error(`[Ludus] could not show "${id}"`, error);
    return false;
  }
}

function markLandingSeen() {
  try {
    Ludus.storage.set(SEEN_STORAGE_KEY, 1);
  } catch (error) {
    // Private mode: the landing may come back next visit, nothing worse.
  }
}

function landingWasSeen() {
  try {
    return Boolean(Ludus.storage.get(SEEN_STORAGE_KEY, 0));
  } catch (error) {
    return false;
  }
}

function hasPlayedBefore() {
  const profile = ludusModule("Profile");
  try {
    const rounds = profile && typeof profile.rounds === "function" ? profile.rounds(undefined, { limit: 1 }) : [];
    return Array.isArray(rounds) && rounds.length > 0;
  } catch (error) {
    return false;
  }
}

// The landing page is for someone who has never been here; everybody else
// starts at home.
function shouldShowLanding() {
  return !landingWasSeen() && !hasPlayedBefore();
}

function showLandingScreen() {
  return routerShow("landing");
}

// Every "back to start" goes to the home screen. The old landing page only
// stands in when home failed to mount.
function goHome(params) {
  if (mountedScreens.home && routerShow("home", params)) return true;
  return showLandingScreen();
}

// Shows the own-games wizard. Used by the landing page when home is not
// available, and by Ludus.game.openOwnGamesSetup for the screens that know
// already who plays.
function openSetupFromLanding({ format = null, statusMessage = "", skipModeStep = false } = {}) {
  if (setupPanelEl) setupPanelEl.style.display = "";
  routerShow("setup");
  if (format) {
    const normalized = normalizeGameFormat(format);
    if (gameFormatEl) gameFormatEl.value = normalized;
    STATE.setupWizard.mode = normalized;
  }
  resetSetupWizard({
    mode: format ? normalizeGameFormat(format) : STATE.setupWizard.mode,
    statusMessage: statusMessage || t("wizard.status.currentStep"),
    skipModeStep,
  });
  updatePgnSelectionUi();
}

// Ludus.game.openOwnGamesSetup({ mode: "solo" | "duel", names?: [a, b], profileIds?: [id, id] }): the
// wizard for the person's own games, with the mode already chosen. When the mode
// is known (and, for a duel, so are both names) step 1 is skipped and the
// indicator counts only the steps that remain ("Step 1 of 2").
function openOwnGamesSetup(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = opts.mode === "duel" || opts.mode === "solo" ? opts.mode : null;
  const names = Array.isArray(opts.names) ? opts.names : [];
  const nameA = sanitizePlayerName(names[0], "").slice(0, 20);
  const nameB = sanitizePlayerName(names[1], "").slice(0, 20);
  if (mode === "duel") {
    if (nameA && duelPlayerAEl) duelPlayerAEl.value = nameA;
    if (nameB && duelPlayerBEl) duelPlayerBEl.value = nameB;
    STATE.setupWizard.duelNames = [
      nameA || STATE.setupWizard.duelNames[0],
      nameB || STATE.setupWizard.duelNames[1],
    ];
  }
  const skipModeStep = mode === "solo" || (mode === "duel" && Boolean(nameA) && Boolean(nameB));
  // Opening the wizard is the first sign of someone meaning to play, so the
  // engine download starts here and usually finishes while they fill it in.
  void ensureStockfishLoading();
  openSetupFromLanding({
    format: mode,
    skipModeStep,
    statusMessage: t("wizard.status.modeSourceOptions"),
  });
  STATE.setupWizard.profileIds = mode === "duel" && Array.isArray(opts.profileIds)
    ? [0, 1].map((index) => (typeof opts.profileIds[index] === "string" ? opts.profileIds[index] : null))
    : null;
}

// The landing page's start button: it marks the page as seen and goes home.
// Only when home did not mount does it open the wizard, as it always did.
function startFromLanding() {
  markLandingSeen();
  if (mountedScreens.home && goHome()) return;
  openOwnGamesSetup({});
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function yieldToUi() {
  await sleepMs(0);
}

function retryAfterMs(response) {
  const raw = response?.headers?.get ? response.headers.get("Retry-After") : "";
  if (!raw) return 0;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return clamp(numeric * 1000, 0, 60000);
  const dateMs = Date.parse(raw);
  return Number.isFinite(dateMs) ? clamp(dateMs - Date.now(), 0, 60000) : 0;
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = clamp(Number(options.timeoutMs) || REMOTE_FETCH_TIMEOUT_MS, 1000, 60000);
  const retries = clamp(Number(options.retries) || 0, 0, 4);
  const { timeoutMs: _timeoutMs, retries: _retries, signal: externalSignal, ...fetchOptions } = options;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (externalSignal?.aborted) break;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    // Bridges an external cancellation (session ended, download budget hit)
    // into this attempt's own controller so the in-flight request actually
    // stops, instead of only having its eventual result discarded.
    const onExternalAbort = () => controller && controller.abort();
    if (externalSignal && controller) externalSignal.addEventListener("abort", onExternalAbort);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller ? controller.signal : externalSignal,
      });
      if (timeout) clearTimeout(timeout);
      const shouldRetryStatus = response.status === 429 || response.status >= 500;
      if (shouldRetryStatus && attempt < retries) {
        const delayMs = retryAfterMs(response) || (500 * (attempt + 1));
        await sleepMs(delayMs);
        continue;
      }
      return response;
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      lastError = error;
      if (externalSignal?.aborted) break;
      if (attempt < retries) {
        await sleepMs(500 * (attempt + 1));
        continue;
      }
    } finally {
      if (externalSignal && controller) externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (externalSignal?.aborted) {
    throw new Error(t("network.cancelled"));
  }
  if (lastError?.name === "AbortError") {
    throw new Error(t("network.timeout"));
  }
  throw new Error(t("network.failed"));
}

// Rejects an oversized remote response before it is fully materialized in
// memory. Content-Length is checked first when the server sends one;
// otherwise the body is read incrementally via its stream reader so a
// response that lies about (or omits) its length is still capped by bytes
// actually received. See REMOTE_RESPONSE_MAX_BYTES for the size rationale.
async function readResponseTextWithLimit(response, maxBytes = REMOTE_RESPONSE_MAX_BYTES) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(t("network.responseTooLarge"));
  }
  const hasStreamingBody = response.body && typeof response.body.getReader === "function"
    && typeof TextDecoder === "function";
  if (!hasStreamingBody) {
    // Environment without a streaming body reader (older browser, or the
    // stubbed test harness): the Content-Length check above still applies
    // when the header is present; this is only reached without it.
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new Error(t("network.responseTooLarge"));
    }
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let result = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch (error) {
        // ignore cancel failures, we are already bailing out
      }
      throw new Error(t("network.responseTooLarge"));
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

async function readResponseJsonWithLimit(response, maxBytes = REMOTE_RESPONSE_MAX_BYTES) {
  const text = await readResponseTextWithLimit(response, maxBytes);
  return JSON.parse(text);
}

function remotePgnCacheAvailable() {
  return typeof indexedDB !== "undefined";
}

function openRemotePgnCacheDb() {
  if (!remotePgnCacheAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(REMOTE_PGN_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REMOTE_PGN_CACHE_STORE)) {
        db.createObjectStore(REMOTE_PGN_CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function remotePgnCacheKey(provider, username, signature) {
  const safeProvider = String(provider || "").toLowerCase();
  const safeUser = String(username || "").trim().toLowerCase();
  return `${safeProvider}|${safeUser}|${signature}`;
}

function cacheSignature(settings) {
  return JSON.stringify(settings, Object.keys(settings || {}).sort());
}

async function readCachedRemotePgn(cacheKey, options = {}) {
  const db = await openRemotePgnCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(REMOTE_PGN_CACHE_STORE, "readonly");
    const request = tx.objectStore(REMOTE_PGN_CACHE_STORE).get(cacheKey);
    request.onsuccess = () => {
      const entry = request.result;
      if (!entry || !entry.source || !entry.source.text) {
        resolve(null);
        return;
      }
      const ageMs = Date.now() - Number(entry.fetchedAt || 0);
      if (!options.allowStale && ageMs > REMOTE_PGN_CACHE_TTL_MS) {
        resolve(null);
        return;
      }
      resolve(entry);
    };
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function writeCachedRemotePgn(cacheKey, source) {
  const db = await openRemotePgnCacheDb();
  if (!db || !source?.text) return;
  await new Promise((resolve) => {
    const tx = db.transaction(REMOTE_PGN_CACHE_STORE, "readwrite");
    tx.objectStore(REMOTE_PGN_CACHE_STORE).put({
      key: cacheKey,
      fetchedAt: Date.now(),
      source,
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

async function purgeExpiredRemotePgnCache() {
  const db = await openRemotePgnCacheDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(REMOTE_PGN_CACHE_STORE, "readwrite");
    const store = tx.objectStore(REMOTE_PGN_CACHE_STORE);
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const entry = cursor.value;
      const ageMs = Date.now() - Number(entry?.fetchedAt || 0);
      if (ageMs > REMOTE_PGN_CACHE_TTL_MS) {
        cursor.delete();
      }
      cursor.continue();
    };
    cursorRequest.onerror = () => resolve();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

async function clearAllRemotePgnCache() {
  const db = await openRemotePgnCacheDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(REMOTE_PGN_CACHE_STORE, "readwrite");
    tx.objectStore(REMOTE_PGN_CACHE_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

// Courtesy limit on how often this browser hits the Lichess / Chess.com public
// APIs. It only counts downloads that actually reach the network: anything
// answered from the local cache is free. Stored in localStorage so a page
// reload does not hand out a fresh allowance.
const REMOTE_FETCH_THROTTLE_KEY = "ludus.remoteFetchThrottle.v1";
const REMOTE_FETCH_MIN_GAP_MS = 20 * 1000;
const REMOTE_FETCH_WINDOW_MS = 60 * 60 * 1000;
const REMOTE_FETCH_MAX_PER_WINDOW = 12;

function readRemoteFetchLog() {
  try {
    const stored = window.localStorage.getItem(REMOTE_FETCH_THROTTLE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value) => Number.isFinite(value));
  } catch (error) {
    return [];
  }
}

function writeRemoteFetchLog(timestamps) {
  try {
    window.localStorage.setItem(REMOTE_FETCH_THROTTLE_KEY, JSON.stringify(timestamps));
  } catch (error) {
    // Ignore storage failures; the throttle is a courtesy, not a guarantee.
  }
}

// Returns null when a network download is allowed right now, or an object with
// the translation key and params explaining how long the caller has to wait.
function remoteFetchThrottleBlock() {
  const now = Date.now();
  const recent = readRemoteFetchLog().filter((at) => now - at < REMOTE_FETCH_WINDOW_MS && at <= now);
  writeRemoteFetchLog(recent);

  const lastAt = recent.length ? Math.max(...recent) : 0;
  if (lastAt && now - lastAt < REMOTE_FETCH_MIN_GAP_MS) {
    const seconds = Math.max(1, Math.ceil((REMOTE_FETCH_MIN_GAP_MS - (now - lastAt)) / 1000));
    return { key: "provider.throttleWait", params: { seconds } };
  }
  if (recent.length >= REMOTE_FETCH_MAX_PER_WINDOW) {
    const oldest = Math.min(...recent);
    const minutes = Math.max(1, Math.ceil((REMOTE_FETCH_WINDOW_MS - (now - oldest)) / 60000));
    return { key: "provider.throttleHourly", params: { minutes, max: REMOTE_FETCH_MAX_PER_WINDOW } };
  }
  return null;
}

function recordRemoteFetch() {
  const now = Date.now();
  const recent = readRemoteFetchLog().filter((at) => now - at < REMOTE_FETCH_WINDOW_MS && at <= now);
  recent.push(now);
  writeRemoteFetchLog(recent);
}

// Installs a downloaded base as the active source. Refuses (and returns false)
// when the wizard no longer points at that provider and username, so a late
// download cannot make the session train somebody else's games.
function installRemotePgnSource(source, options = {}) {
  if (!remoteSourceMatchesUi(source)) return false;
  STATE.remotePgnSources = [{ ...source }];
  setSourceMode(source.provider);
  updatePgnSelectionUi();
  if (onlineStatusEl && options.messageKey) {
    onlineStatusEl.textContent = t(options.messageKey, {
      provider: providerLabel(source.provider),
      user: source.username,
      games: source.games || countPgnGames(source.text),
    });
  }
  return true;
}

let consentModalOpen = false;

function showConfirmModal(options = {}) {
  if (!consentOverlayEl || !consentOverlayAcceptBtn || !consentOverlayCancelBtn) {
    return Promise.resolve(true);
  }
  if (consentModalOpen) return Promise.resolve(false);
  consentModalOpen = true;

  const retypeText = typeof options.retypeText === "string" ? options.retypeText.trim() : "";
  const needsRetype = retypeText !== "";

  if (consentOverlayTitleEl) consentOverlayTitleEl.textContent = options.title || "";
  if (consentOverlayBodyEl) consentOverlayBodyEl.textContent = options.body || "";
  consentOverlayAcceptBtn.textContent = options.acceptLabel || "";
  consentOverlayCancelBtn.textContent = options.cancelLabel || "";
  if (consentOverlayUsernameLabelEl) {
    consentOverlayUsernameLabelEl.textContent = options.retypeLabel || "";
    consentOverlayUsernameLabelEl.classList.toggle("hidden", !needsRetype);
  }
  if (consentOverlayUsernameInputEl) {
    consentOverlayUsernameInputEl.value = "";
    consentOverlayUsernameInputEl.classList.toggle("hidden", !needsRetype);
  }
  if (consentOverlayErrorEl) {
    consentOverlayErrorEl.textContent = "";
    consentOverlayErrorEl.classList.add("hidden");
  }

  consentOverlayEl.classList.remove("hidden");

  return new Promise((resolve) => {
    const previouslyFocusedEl = document.activeElement;
    const focusables = () => [
      needsRetype ? consentOverlayUsernameInputEl : null,
      consentOverlayCancelBtn,
      consentOverlayAcceptBtn,
    ].filter((el) => el && typeof el.focus === "function");

    const cleanup = (accepted) => {
      consentModalOpen = false;
      consentOverlayEl.classList.add("hidden");
      consentOverlayAcceptBtn.removeEventListener("click", onAccept);
      consentOverlayCancelBtn.removeEventListener("click", onCancel);
      consentOverlayEl.removeEventListener("keydown", onKeyDown);
      if (previouslyFocusedEl
        && document.contains(previouslyFocusedEl)
        && typeof previouslyFocusedEl.focus === "function") {
        previouslyFocusedEl.focus();
      }
      resolve(accepted);
    };
    const onAccept = () => {
      if (needsRetype) {
        const typed = (consentOverlayUsernameInputEl?.value || "").trim().toLowerCase();
        if (typed !== retypeText.toLowerCase()) {
          if (consentOverlayErrorEl) {
            consentOverlayErrorEl.textContent = options.mismatchMessage || "";
            consentOverlayErrorEl.classList.remove("hidden");
          }
          if (consentOverlayUsernameInputEl) consentOverlayUsernameInputEl.focus();
          return;
        }
      }
      cleanup(true);
    };
    const onCancel = () => cleanup(false);
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter" && needsRetype && event.target === consentOverlayUsernameInputEl) {
        event.preventDefault();
        onAccept();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    consentOverlayAcceptBtn.addEventListener("click", onAccept);
    consentOverlayCancelBtn.addEventListener("click", onCancel);
    consentOverlayEl.addEventListener("keydown", onKeyDown);

    const initialFocusEl = needsRetype && consentOverlayUsernameInputEl
      ? consentOverlayUsernameInputEl
      : consentOverlayCancelBtn;
    requestAnimationFrame(() => {
      if (initialFocusEl && typeof initialFocusEl.focus === "function") initialFocusEl.focus();
    });
  });
}

function confirmRemoteFetchConsent(provider, username) {
  if (STATE.remoteConsent[provider]) return Promise.resolve(true);
  return showConfirmModal({
    title: t("privacy.remoteFetchTitle"),
    body: t("privacy.remoteFetchConfirm", {
      provider: providerLabel(provider),
      user: username,
    }),
    acceptLabel: t("privacy.remoteFetchAccept"),
    cancelLabel: t("privacy.remoteFetchCancel"),
    retypeText: String(username || ""),
    retypeLabel: t("privacy.remoteFetchUsernameLabel"),
    mismatchMessage: t("privacy.remoteFetchUsernameMismatch"),
  }).then((accepted) => {
    if (accepted) STATE.remoteConsent[provider] = true;
    return accepted;
  });
}

const MATE_SCORE_BASE = 100000;
const MATE_SCORE_STEP = 1000;
const MAX_ENCODABLE_MATE_DISTANCE = 50;
const MATE_SCORE_THRESHOLD = MATE_SCORE_BASE - MAX_ENCODABLE_MATE_DISTANCE * MATE_SCORE_STEP;

function encodeMateScore(mateInMoves) {
  const distance = Math.min(Math.abs(mateInMoves), MAX_ENCODABLE_MATE_DISTANCE);
  const magnitude = MATE_SCORE_BASE - distance * MATE_SCORE_STEP;
  return mateInMoves > 0 ? magnitude : -magnitude;
}

function decodeEvaluation(moverScore) {
  if (!Number.isFinite(moverScore)) return null;
  const abs = Math.abs(moverScore);
  if (abs >= MATE_SCORE_THRESHOLD) {
    const mateDistance = Math.max(1, Math.round((MATE_SCORE_BASE - abs) / MATE_SCORE_STEP));
    return { kind: "mate", matePly: moverScore >= 0 ? mateDistance : -mateDistance, score: moverScore };
  }
  return { kind: "cp", cp: Math.round(moverScore), score: moverScore };
}

const SCORING_SYSTEMS = {
  simple_labels_v1: {
    labelKey: "scoring.system.simple.label",
    descriptionKey: "scoring.system.simple.description",
  },
};

function normalizeScoringSystem(value) {
  return SCORING_SYSTEMS[value] ? value : DEFAULT_SCORING_SYSTEM;
}

function getScoringSystemMeta(value) {
  return SCORING_SYSTEMS[normalizeScoringSystem(value)];
}

function scoringSystemLabel(value) {
  return t(getScoringSystemMeta(value).labelKey);
}

function updateScoringSystemHint() {
  if (!scoringSystemHintEl) return;
  scoringSystemHintEl.textContent = t(getScoringSystemMeta(STATE.scoringSystem).descriptionKey);
}

// Points are shown with at most two decimals ("7.4", "10"), with the decimal
// comma in Spanish.
function formatPoints(value, options = {}) {
  const { signed = false } = options;
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  let text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  if (preferredLocale() === "es") text = text.replace(".", ",");
  if (signed && rounded > 0) text = `+${text}`;
  return text;
}

function computeLossAgainstBest(bestMoverScore, choiceMoverScore) {
  if (!Number.isFinite(choiceMoverScore)) {
    return { loss: Number.POSITIVE_INFINITY, diff: null, reasonCode: "no_move", best: null, choice: null };
  }
  const best = decodeEvaluation(bestMoverScore);
  const choice = decodeEvaluation(choiceMoverScore);
  if (!best || !choice) {
    return { loss: 2000, diff: null, reasonCode: "invalid_eval", best, choice };
  }

  let loss = 0;
  let reasonCode = "cp_diff";

  if (choice.kind === "mate" && choice.matePly < 0 && !(best.kind === "mate" && best.matePly < 0)) {
    loss = 2500;
    reasonCode = "allows_mate";
  } else if (best.kind === "mate" && best.matePly > 0) {
    if (choice.kind === "mate" && choice.matePly > 0) {
      loss = 40 * Math.max(0, choice.matePly - best.matePly);
      reasonCode = loss === 0 ? "optimal_mate" : "slower_mate";
    } else {
      loss = 1200 + 40 * Math.min(best.matePly, 20);
      reasonCode = "missed_forced_mate";
    }
  } else if (best.kind === "cp" && choice.kind === "cp") {
    loss = clamp(best.cp - choice.cp, 0, 2000);
  } else {
    loss = clamp(best.score - choice.score, 0, 2500);
  }

  return {
    loss,
    diff: Number.isFinite(loss) ? Math.round(loss) : null,
    reasonCode,
    best,
    choice,
  };
}

function getGamePhase(board) {
  let nonPawnMaterial = 0;
  let queens = 0;
  for (const piece of board.board) {
    if (!piece) continue;
    const p = piece.toUpperCase();
    if (p === "Q") queens += 1;
    if (p === "N" || p === "B") nonPawnMaterial += 3;
    if (p === "R") nonPawnMaterial += 5;
    if (p === "Q") nonPawnMaterial += 9;
  }
  if (nonPawnMaterial <= 10 || queens <= 1) return "endgame";
  if (nonPawnMaterial >= 24) return "opening";
  return "middlegame";
}

function adaptiveThreshold(baseThresholdCp, board) {
  const phase = getGamePhase(board);
  const base = clamp(Number(baseThresholdCp) || 150, 50, 800);
  if (phase === "opening") return { phase, threshold: Math.round(base * 1.1) };
  if (phase === "endgame") return { phase, threshold: Math.round(base * 0.75) };
  return { phase, threshold: base };
}

function adaptiveMoveTime(baseMoveTimeMs, board, options = {}) {
  const minMoveTimeMs = clamp(Number(options.minMoveTimeMs) || 50, 50, 10000);
  const maxMoveTimeMs = clamp(Number(options.maxMoveTimeMs) || 10000, minMoveTimeMs, 10000);
  const base = clamp(Number(baseMoveTimeMs) || 400, minMoveTimeMs, maxMoveTimeMs);
  const legal = board.generateMoves();
  const legalCount = legal.length;
  const captureCount = legal.filter((move) => move.capture || move.enPassant).length;
  const inCheck = board.inCheck(board.turn);
  const phase = getGamePhase(board);

  let factor = 1;
  if (inCheck) factor += 0.55;
  if (legalCount >= 32) factor += 0.35;
  else if (legalCount >= 22) factor += 0.18;
  if (captureCount >= 6) factor += 0.3;
  else if (captureCount >= 3) factor += 0.16;
  if (phase === "opening") factor += 0.1;
  if (phase === "endgame") factor += 0.2;

  return clamp(Math.round(base * factor), minMoveTimeMs, maxMoveTimeMs);
}

// The search budget of one round. The size of one search is what the settings
// say (Settings.engineBudget(): a preset in ms and a MultiPV width); the
// difficulty of the position only scales it (0.8x for a quiet position, up to
// 1.6x for a crowded one) and the whole evaluation of the round stays under
// ROUND_EVAL_HARD_CAP_MS however many searches it needs: one for the reference
// (unless the position brings its own lines), one per answer the reference does
// not cover and one for the move of the game. It depends only on the position and the
// mode, so the search started while the person thinks and the one made when
// they answer have the same key and the second is a cache hit.
function getRoundEvaluationPlan(board, position, answerCount = 1) {
  const legalMoves = board.generateMoves();
  const legalCount = legalMoves.length;
  const captureCount = legalMoves.filter((move) => move.capture || move.enPassant).length;
  const inCheck = board.inCheck(board.turn);
  const phase = getGamePhase(board);
  const threshold = Number(position?.thresholdUsed);

  let difficultyScore = 0;
  if (inCheck) difficultyScore += 2.1;
  if (legalCount >= 34) difficultyScore += 2.2;
  else if (legalCount >= 28) difficultyScore += 1.6;
  else if (legalCount >= 22) difficultyScore += 1.0;
  if (captureCount >= 7) difficultyScore += 1.8;
  else if (captureCount >= 4) difficultyScore += 1.1;
  else if (captureCount >= 2) difficultyScore += 0.6;
  if (phase === "endgame") difficultyScore += 1.2;
  if (phase === "opening") difficultyScore += 0.4;
  if (Number.isFinite(threshold) && threshold <= 90) difficultyScore += 0.7;
  if (Number.isFinite(threshold) && threshold <= 70) difficultyScore += 0.5;

  const normalized = clamp(difficultyScore / 7.2, 0, 1);
  let level = "easy";
  let label = "low";
  if (normalized >= 0.74) {
    level = "hard";
    label = "high";
  } else if (normalized >= 0.42) {
    level = "medium";
    label = "medium";
  }

  const budget = engineBudgetFromSettings();
  const multiplier = ROUND_EVAL_MULTIPLIER_MIN + normalized * (ROUND_EVAL_MULTIPLIER_MAX - ROUND_EVAL_MULTIPLIER_MIN);
  const maxTasks = (hasReferenceLines(position) ? 0 : 1) + Math.max(1, answerCount) + 1;
  const perSearch = clamp(Math.round(budget.movetimeMs * multiplier), ROUND_EVAL_MIN_SEARCH_MS, ROUND_EVAL_MAX_SEARCH_MS);
  const movetimeMs = clamp(
    Math.min(perSearch, Math.floor(ROUND_EVAL_HARD_CAP_MS / maxTasks)),
    ROUND_EVAL_MIN_SEARCH_MS,
    ROUND_EVAL_MAX_SEARCH_MS,
  );
  return {
    level,
    label,
    multiplier: Math.round(multiplier * 100) / 100,
    movetimeMs,
    multiPv: budget.multiPv,
    maxTasks,
    totalBudgetMs: movetimeMs * maxTasks,
  };
}

// ---------- Scoring a round (Ludus.Scoring) ----------
// Points are 0..10 per position and come from Ludus.Scoring.assess(): how far the
// move is from the engine's best (docs/SCORING.md). This section gets the numbers
// that assess() needs (the reference lines, the score of the move that was not
// among them, the score of the move of the game) and the explanations around it.

// Mover-POV score of a line: engine lines carry { type, value }, the compact
// lines of a Position (and of the notebook) a number already in that encoding.
function lineMoverScore(line) {
  if (!line || typeof line !== "object") return NaN;
  if (typeof line.score === "number") return Number.isFinite(line.score) ? line.score : NaN;
  const scoring = ludusModule("Scoring");
  return scoring && line.score && typeof line.score === "object" ? scoring.encodeScore(line.score) : NaN;
}

function lineFirstUci(line) {
  if (!line || typeof line !== "object") return "";
  const uci = typeof line.uci === "string" ? line.uci : (Array.isArray(line.pv) ? line.pv[0] : "");
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(String(uci || "")) ? String(uci) : "";
}

// The lines a position brings with it (classics, notebook cards): the round is
// scored against them and no reference search is needed.
function referenceLinesOf(position) {
  const raw = position && position.reference && Array.isArray(position.reference.lines) ? position.reference.lines : [];
  const out = [];
  raw.forEach((line) => {
    const uci = lineFirstUci(line);
    if (!uci || !Number.isFinite(lineMoverScore(line)) || out.some((entry) => entry.uci === uci)) return;
    out.push({
      uci,
      san: typeof line.san === "string" ? line.san : "",
      score: lineMoverScore(line),
      pv: Array.isArray(line.pv) ? line.pv.filter((move) => typeof move === "string") : [uci],
    });
  });
  return out;
}

function hasReferenceLines(position) {
  return referenceLinesOf(position).length > 0;
}

// Engine lines ({ multipv, depth, score: { type, value }, pv }) in the compact
// form the scoring code works with ({ uci, score: number, pv }), best first.
function compactEngineLines(lines) {
  const out = [];
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const uci = lineFirstUci(line);
    const score = lineMoverScore(line);
    if (!uci || !Number.isFinite(score) || out.some((entry) => entry.uci === uci)) return;
    out.push({ uci, san: "", score, pv: Array.isArray(line.pv) && line.pv.length ? line.pv.filter((move) => typeof move === "string") : [uci] });
  });
  return out;
}

function engineBudgetFromSettings() {
  const settings = ludusModule("Settings");
  try {
    if (settings && typeof settings.engineBudget === "function") {
      const budget = settings.engineBudget();
      if (budget && Number.isFinite(budget.movetimeMs) && Number.isFinite(budget.multiPv)) {
        return { movetimeMs: budget.movetimeMs, multiPv: clamp(Math.round(budget.multiPv), 1, 5) };
      }
    }
  } catch (error) {
    // fall through to the balanced preset
  }
  return { movetimeMs: 1500, multiPv: 3 };
}

// The scoring rules of the running session: what a screen asked for in
// startSession's options, else the person's settings (read every time, so a
// change in the settings applies from the next round).
function sessionScoringSettings() {
  if (STATE.scoringOverride) return STATE.scoringOverride;
  const settings = ludusModule("Settings");
  try {
    if (settings && typeof settings.scoringSettings === "function") return settings.scoringSettings();
  } catch (error) {
    // fall through to the defaults
  }
  const scoring = ludusModule("Scoring");
  return scoring ? scoring.normalizeSettings({}) : {};
}

function formatScoreText(score) {
  const scoring = ludusModule("Scoring");
  if (Number.isFinite(score) && scoring && typeof scoring.formatEval === "function") {
    return scoring.formatEval(score, STATE.language);
  }
  return t("common.notAvailable");
}

function pvToSan(fen, pv, maxPlies = 6) {
  const out = [];
  try {
    const board = new Chess(fen);
    for (const uci of (Array.isArray(pv) ? pv : []).slice(0, maxPlies)) {
      const move = uciToMove(uci, board);
      if (!move) break;
      out.push(moveToSan(board, move));
      board.makeMove(move);
    }
  } catch (error) {
    // A line that cannot be replayed is shown as far as it goes.
  }
  return out;
}

// The lines for the result panel: SAN-converted, with their evaluation.
function buildLinesView(fen, lines, marks = {}) {
  const userUcis = Array.isArray(marks.userUcis) ? marks.userUcis : [];
  return (lines || []).slice(0, 5).map((line, index) => {
    const uci = lineFirstUci(line);
    const score = lineMoverScore(line);
    const sanList = pvToSan(fen, Array.isArray(line.pv) && line.pv.length ? line.pv : [uci], 8);
    return {
      rank: index + 1,
      uci,
      san: sanList[0] || line.san || uci,
      score,
      evalText: formatScoreText(score),
      pvSan: sanList,
      isBest: index === 0,
      isUser: userUcis.includes(uci),
      isMaster: Boolean(marks.masterUci) && uci === marks.masterUci,
    };
  });
}

// The lines a round record keeps (Profile caps them again): at most 3, six
// plies each, only the fields a review needs.
function compactLines(fen, lines) {
  return (lines || []).slice(0, 3).map((line) => {
    const uci = lineFirstUci(line);
    const pv = (Array.isArray(line.pv) && line.pv.length ? line.pv : [uci]).slice(0, 6);
    return { uci, san: pvToSan(fen, pv, 1)[0] || line.san || "", score: Math.round(lineMoverScore(line)), pv };
  }).filter((line) => line.uci);
}

function pickCuriosity() {
  const facts = ludusModule("Facts");
  try {
    if (facts && typeof facts.pick === "function") {
      const fact = facts.pick({ exclude: STATE.recentFacts });
      if (fact && fact.id) {
        STATE.recentFacts.push(fact.id);
        while (STATE.recentFacts.length > RECENT_FACTS_MAX) STATE.recentFacts.shift();
        return fact;
      }
    }
  } catch (error) {
    // A curiosity is decoration.
  }
  return null;
}

function noMoveReasonToScoring(noMoveReason) {
  if (noMoveReason === "timeout") return "timeout";
  if (noMoveReason === "manual_skip" || noMoveReason === "hint_reveal") return "skip";
  return "";
}

// Evaluates the answers of one round (one in solo, two in a duel) against the
// same reference, in one pass.
//
//   answers: [{ move|null, noMoveReason, hintsUsed, timeSpentMs, playerIndex }]
//   plan:    getRoundEvaluationPlan()
//   hooks:   { onProgress({ ratio, elapsedTotalMs }) }
//
// Returns null when the work was cancelled (a new session started meanwhile).
// The reference is the position's own lines when it has them (classics, notebook
// cards) and one MultiPV search at the root otherwise. A move that is not among
// those lines is searched on its own (searchmoves) with the same time, so both
// scores are comparable; the move of the game is scored the same way so its
// evaluation can be shown.
async function evaluateRoundAnswers(base, position, answers, plan, hooks = {}) {
  const fen = position.fen;
  const scoring = ludusModule("Scoring");
  const insightsApi = ludusModule("Insights");
  if (!scoring) throw new Error("Ludus.Scoring is not available");
  const settings = sessionScoringSettings();
  const startedAt = Date.now();
  let completedTasks = 0;
  const report = (fraction) => {
    if (typeof hooks.onProgress !== "function") return;
    hooks.onProgress({
      ratio: clamp((completedTasks + clamp(Number(fraction) || 0, 0, 1)) / Math.max(1, plan.maxTasks), 0, 1),
      elapsedTotalMs: Date.now() - startedAt,
    });
  };
  let sourceUsed = engineSourceName();
  const task = async (options) => {
    const result = await analyzePosition(fen, {
      ...options,
      movetimeMs: plan.movetimeMs,
      onProgress: (progress) => report(progress.ratio),
    });
    completedTasks += 1;
    report(0);
    if (result.source === "local") sourceUsed = "local";
    return result;
  };

  // 1. The reference lines.
  let lines;
  let origin;
  let depth = 0;
  if (hasReferenceLines(position)) {
    lines = referenceLinesOf(position);
    origin = position.reference.origin === "runtime" ? "runtime" : "precomputed";
    depth = Number(position.reference.depth) || 0;
  } else {
    const root = await task({ multiPv: plan.multiPv });
    if (root.aborted) return null;
    lines = compactEngineLines(root.lines);
    origin = "runtime";
    depth = root.depth;
  }
  if (!lines.length) throw new Error("no-analysis");
  const referenceBest = lineMoverScore(lines[0]);

  // 2. The score of a move that is not among the lines.
  const scoreOutsideLines = async (uci) => {
    const one = await task({ searchMoves: [uci], multiPv: 1 });
    if (one.aborted) return { aborted: true };
    const line = one.lines[0] || null;
    let score = lineMoverScore(line);
    if (Number.isFinite(score) && origin === "precomputed" && one.source === "local") {
      // The reference was made by the strong engine and this by the 3-ply
      // fallback, whose numbers are not comparable. Carry over only the
      // difference between the best move and this one, both measured by the fallback.
      const bestOne = await task({ searchMoves: [lines[0].uci], multiPv: 1 });
      if (bestOne.aborted) return { aborted: true };
      const bestLocal = lineMoverScore(bestOne.lines[0]);
      score = Number.isFinite(bestLocal) ? referenceBest - Math.max(0, bestLocal - score) : score;
    }
    return { score, line };
  };

  const masterUci = position.gameMoveUci && uciToMove(position.gameMoveUci, base) ? position.gameMoveUci : "";
  const results = [];
  for (const answer of answers) {
    const uci = answer.move ? moveToUci(answer.move) : null;
    const reason = uci ? "" : noMoveReasonToScoring(answer.noMoveReason);
    const hintsUsed = clamp(Math.round(Number(answer.hintsUsed) || 0), 0, 3);
    let isSacrifice = false;
    try {
      const features = uci && insightsApi ? insightsApi.moveFeatures(fen, uci) : null;
      isSacrifice = Boolean(features && features.sacrifice);
    } catch (error) {
      isSacrifice = false;
    }
    const input = { lines, userUci: uci, masterUci, settings, reason, hintsUsed };
    let assessment = scoring.assess(input, { isSacrifice });
    if (assessment.needsEvaluation && uci && !assessment.error) {
      const outside = await scoreOutsideLines(uci);
      if (outside.aborted) return null;
      if (Number.isFinite(outside.score)) {
        assessment = scoring.assess({ ...input, userScore: outside.score }, { isSacrifice });
      }
    }
    assessment = { ...assessment, hintsUsed };
    const provisional = Boolean(uci && assessment.needsEvaluation);

    let insight = { tags: [], messages: [], conceptIds: [], phase: null, verdict: "unknown" };
    try {
      if (insightsApi) {
        const analyzed = insightsApi.analyzeChoice({
          fen,
          userUci: uci,
          bestUci: assessment.bestUci,
          assessment,
          lines,
          masterUci,
          timing: { timeSpentMs: answer.timeSpentMs, limitMs: isUntimedSession() ? 0 : STATE.timer.durationMs, timedOut: reason === "timeout" },
        });
        if (analyzed && !analyzed.error) insight = analyzed;
      }
    } catch (error) {
      // Insights are decoration: never allowed to break a round.
    }

    const userScore = Number.isFinite(assessment.userScore) ? assessment.userScore : NaN;
    results.push({
      playerIndex: answer.playerIndex || 0,
      move: answer.move || null,
      uci,
      san: answer.move ? moveToSan(base, answer.move) : "",
      noMoveReason: uci ? "" : (answer.noMoveReason || "no_move"),
      reason: assessment.reason,
      hintsUsed,
      timeSpentMs: Math.max(0, Math.round(Number(answer.timeSpentMs) || 0)),
      isSacrifice,
      provisional,
      assessment,
      userScore,
      userEvalText: Number.isFinite(userScore) ? formatScoreText(userScore) : t("common.notAvailable"),
      hit: Boolean(uci) && hintsUsed < 3 && (assessment.isBest || assessment.accuracy >= HIT_ACCURACY),
      insights: insight,
    });
  }

  // 3. The move of the game (the master's, or the one the person made in their game).
  let master = null;
  if (masterUci) {
    const rank = lines.findIndex((line) => line.uci === masterUci);
    let score = rank >= 0 ? lineMoverScore(lines[rank]) : NaN;
    if (rank < 0) {
      const outside = await scoreOutsideLines(masterUci);
      if (outside.aborted) return null;
      score = outside.score;
    }
    const masterMove = uciToMove(masterUci, base);
    master = {
      uci: masterUci,
      san: masterMove ? moveToSan(base, masterMove) : (position.gameMoveSan || masterUci),
      score,
      evalText: Number.isFinite(score) ? formatScoreText(score) : (position.gameEvalText || t("common.notAvailable")),
      rank: rank >= 0 ? rank + 1 : null,
    };
  }
  report(1);

  const bestUci = lines[0].uci;
  const bestMove = uciToMove(bestUci, base);
  const marks = { userUcis: results.map((entry) => entry.uci).filter(Boolean), masterUci };
  return {
    fen,
    lines,
    linesView: buildLinesView(fen, lines, marks),
    origin,
    source: sourceUsed,
    depth,
    plan,
    // A local 3-ply "best move" is a guess: it is not kept as the position's
    // best in the records, unless the lines came with the position.
    trustedLines: origin === "precomputed" || sourceUsed === "stockfish",
    best: bestMove,
    bestUci,
    bestSan: bestMove ? moveToSan(base, bestMove) : (position.bestMoveSan || "-"),
    bestScore: referenceBest,
    bestEvalText: formatScoreText(referenceBest),
    game: master ? uciToMove(master.uci, base) : null,
    master,
    answers: results,
  };
}


function formatDelta(referenceScore, comparedScore) {
  if (!Number.isFinite(referenceScore) || !Number.isFinite(comparedScore)) return t("evaluation.deltaUnavailable");
  const delta = Math.round(comparedScore - referenceScore);
  if (delta === 0) return t("evaluation.deltaEqual");
  if (Math.abs(delta) >= 90000) return delta > 0 ? t("evaluation.deltaMateBetter") : t("evaluation.deltaMateWorse");
  return delta > 0
    ? t("evaluation.deltaBetter", { delta })
    : t("evaluation.deltaWorse", { delta });
}

// ---------- Local fallback evaluator ----------

const pieceValues = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0, p: -100, n: -320, b: -330, r: -500, q: -900, k: 0 };
function evaluateMaterial(board) {
  let score = 0;
  for (let i = 0; i < 64; i += 1) {
    const piece = board.board[i];
    if (!piece) continue;
    score += pieceValues[piece];
  }
  return score;
}

function evaluatePosition(board, depth) {
  if (depth <= 0) return evaluateMaterial(board);
  const moves = board.generateMoves();
  if (moves.length === 0) return board.inCheck(board.turn) ? (board.turn === "w" ? -99999 : 99999) : 0;
  let best = board.turn === "w" ? -Infinity : Infinity;
  moves.forEach((move) => {
    const clone = board.clone();
    clone.makeMove(move);
    const score = evaluatePosition(clone, depth - 1);
    if (board.turn === "w") {
      if (score > best) best = score;
    } else if (score < best) {
      best = score;
    }
  });
  return best;
}

function searchBestMove(board, depth) {
  let bestScore = board.turn === "w" ? -Infinity : Infinity;
  let bestMove = null;
  board.generateMoves().forEach((move) => {
    const clone = board.clone();
    clone.makeMove(move);
    const score = evaluatePosition(clone, depth - 1);
    if (board.turn === "w") {
      if (score > bestScore) { bestScore = score; bestMove = move; }
    } else if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });
  return { move: bestMove, score: Math.round(bestScore) };
}

// ---------- Engine (Ludus.Engine) and analyzePosition ----------
// The strong engine is Stockfish in a Worker behind Ludus.Engine (MultiPV,
// searchmoves, progress, abort). Until it is up, or after it fails, a shallow
// 3-ply search of this file answers instead: analyzePosition() hides which one
// it was, and says so in its result.

// Tests and end-to-end checks may hand the engine another transport (see
// Ludus.game.configureEngine); in the browser the default is the Worker on
// vendor/stockfish-18-lite-single.js.
let engineTransportFactory = null;
// Timings a test may shorten (Ludus.game.configureEngine); null: the constants.
const timingOverrides = { minEvalVisibleMs: null, engineRetryBaseMs: null };
// Bumped every time the engine is dropped, so a load that finishes after the
// person already went home does not leave an engine running behind their back.
let engineEpoch = 0;

function resetEngineToLocal() {
  engineEpoch += 1;
  const instance = STATE.engine.instance;
  STATE.engine = { mode: "local", instance: null, ready: false };
  if (instance) {
    try {
      instance.terminate();
    } catch (error) {
      // ignore terminate failures
    }
  }
}

function localFallbackDepth(depth) {
  return clamp(Number(depth) || LOCAL_FALLBACK_MAX_DEPTH, 1, LOCAL_FALLBACK_MAX_DEPTH);
}

// One attempt at starting the strong engine. The worker requests the engine
// file itself, so the app no longer fetches it first just to check it is there.
async function setupStockfish() {
  resetEngineToLocal();
  const epoch = engineEpoch;
  const engineApi = ludusModule("Engine");
  if (!engineApi || typeof engineApi.create !== "function") return false;
  let instance = null;
  try {
    const config = { readyTimeoutMs: ENGINE_READY_TIMEOUT_MS };
    if (typeof engineTransportFactory === "function") config.createTransport = engineTransportFactory;
    instance = engineApi.create(config);
    const ready = await instance.ready();
    if (!ready || epoch !== engineEpoch) {
      try {
        instance.terminate();
      } catch (error) {
        // ignore
      }
      return false;
    }
    STATE.engine = { mode: "stockfish", instance, ready: true };
    return true;
  } catch (error) {
    if (instance) {
      try {
        instance.terminate();
      } catch (terminateError) {
        // ignore
      }
    }
    if (epoch === engineEpoch) resetEngineToLocal();
    return false;
  }
}

let engineLoad = null;

// Loads the strong engine once however many places ask for it, retrying a few
// times with a growing pause. A first attempt failing on a weak connection is
// ordinary for a download this size and used to condemn the whole page load to
// the shallow local engine.
function ensureStockfishLoading() {
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return Promise.resolve(true);
  if (!engineLoad) {
    engineLoad = (async () => {
      for (let attempt = 0; attempt < ENGINE_LOAD_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          const baseMs = timingOverrides.engineRetryBaseMs !== null ? timingOverrides.engineRetryBaseMs : ENGINE_RETRY_BASE_MS;
          await sleepMs(baseMs * attempt);
        }
        if (await setupStockfish()) return true;
      }
      return false;
    })().finally(() => {
      engineLoad = null;
    });
  }
  return engineLoad;
}

// Stops whatever the engine is doing for this page and invalidates every
// analysis started so far: a new session, or leaving the game, calls this so no
// result of the old work can land on the new screen.
function abortEngineWork() {
  STATE.analysis.generation += 1;
  STATE.analysis.inflight.clear();
  const instance = STATE.engine.instance;
  if (instance && typeof instance.stop === "function") {
    try {
      instance.stop({ all: true });
    } catch (error) {
      // The engine may be gone already.
    }
  }
}

function engineSourceName() {
  return STATE.engine.mode === "stockfish" && STATE.engine.ready && STATE.engine.instance ? "stockfish" : "local";
}

function cleanUciList(list, max = 32) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const uci = String(entry || "").trim().toLowerCase();
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) && !out.includes(uci) && out.length < max) out.push(uci);
  });
  return out;
}

function normalizeAnalysisRequest(fen, options) {
  const cleanFen = String(fen || "").trim().replace(/\s+/g, " ");
  if (!cleanFen) return null;
  const opts = options && typeof options === "object" ? options : {};
  const depth = Number(opts.depth) > 0 ? clamp(Math.round(Number(opts.depth)), 1, 40) : 0;
  let movetimeMs = Number(opts.movetimeMs) > 0 ? clamp(Math.round(Number(opts.movetimeMs)), 10, 60000) : 0;
  if (!movetimeMs && !depth) movetimeMs = DEFAULT_ANALYSIS_MS;
  return {
    fen: cleanFen,
    multiPv: clamp(Math.round(Number(opts.multiPv) || 1), 1, 8),
    movetimeMs,
    depth,
    searchMoves: cleanUciList(opts.searchMoves),
    onProgress: typeof opts.onProgress === "function" ? opts.onProgress : null,
  };
}

function analysisCacheKey(source, request) {
  return `${source}|${request.fen}|d${request.depth}|t${request.movetimeMs}|m${request.multiPv}|s${request.searchMoves.join(",")}`;
}

function cloneAnalysisLines(lines) {
  return (lines || []).map((line) => ({ ...line, score: { ...line.score }, pv: line.pv.slice() }));
}

function readAnalysisCache(key) {
  const cache = STATE.analysis.cache;
  const hit = cache.get(key);
  if (!hit) return null;
  // Touch it: the entry that was used last is the last to be dropped.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function writeAnalysisCache(key, entry) {
  const cache = STATE.analysis.cache;
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > ANALYSIS_CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
}

// The shallow fallback, in the shape of an engine line: score from the mover's
// point of view, mate as { type: "mate", value } (only the mates a 3-ply search
// can see: mate in 1, mate in 2, or "mated next move"), pv of one move.
function localScoreObject(moverScore, afterBoard) {
  if (Math.abs(moverScore) >= 90000) {
    if (moverScore > 0) {
      const mated = afterBoard.generateMoves().length === 0 && afterBoard.inCheck(afterBoard.turn);
      return { type: "mate", value: mated ? 1 : 2 };
    }
    return { type: "mate", value: -1 };
  }
  return { type: "cp", value: clamp(Math.round(moverScore), -4000, 4000) };
}

function localAnalysisLine(board, move, whiteScore, depth) {
  const mover = board.turn === "w" ? whiteScore : -whiteScore;
  const after = board.clone();
  after.makeMove(move);
  return { multipv: 1, depth, score: localScoreObject(mover, after), pv: [moveToUci(move)] };
}

// One line: the best move of the 3-ply search, or, with searchMoves, the score
// of the (first legal) move asked for. Synchronous, so it yields to the page
// first: the shallow search must not freeze a click that is still being handled.
async function runLocalAnalysis(request) {
  await yieldToUi();
  const board = new Chess(request.fen);
  const depth = localFallbackDepth(request.depth || LOCAL_FALLBACK_MAX_DEPTH);
  if (request.searchMoves.length) {
    const lines = [];
    request.searchMoves.forEach((uci) => {
      const move = uciToMove(uci, board);
      if (!move) return;
      const clone = board.clone();
      clone.makeMove(move);
      lines.push({ move, whiteScore: evaluatePosition(clone, depth - 1) });
    });
    const scored = lines
      .map((entry) => localAnalysisLine(board, entry.move, entry.whiteScore, depth))
      .sort((a, b) => lineMoverScore(b) - lineMoverScore(a));
    return { lines: scored.slice(0, 1), depth, aborted: false };
  }
  const best = searchBestMove(board, depth);
  if (!best.move) return { lines: [], depth, aborted: false };
  return { lines: [localAnalysisLine(board, best.move, best.score, depth)], depth, aborted: false };
}

async function runStockfishAnalysis(request, isAborted) {
  const instance = STATE.engine.instance;
  const startedAt = Date.now();
  let depthSeen = 0;
  const report = (ratio) => {
    if (!request.onProgress) return;
    request.onProgress({ ratio, elapsedMs: Date.now() - startedAt, targetMs: request.movetimeMs, depth: depthSeen });
  };
  // The engine reports when it has something new to say; a steady bar needs its own clock.
  const ticker = request.onProgress
    ? setInterval(() => {
      const elapsed = Date.now() - startedAt;
      report(clamp(request.movetimeMs > 0 ? elapsed / request.movetimeMs : depthSeen / Math.max(1, request.depth || 18), 0, 0.98));
    }, 120)
    : null;
  try {
    const result = await instance.analyze({
      fen: request.fen,
      movetimeMs: request.movetimeMs || undefined,
      depth: request.depth || undefined,
      multiPv: request.searchMoves.length ? 1 : request.multiPv,
      searchMoves: request.searchMoves.length ? request.searchMoves : undefined,
      onInfo: (info) => {
        depthSeen = info.depth;
      },
      signal: { get aborted() { return isAborted(); } },
    });
    return { lines: result.lines, depth: result.depth, aborted: Boolean(result.aborted && isAborted()), timedOut: Boolean(result.timedOut) };
  } finally {
    if (ticker) clearInterval(ticker);
  }
}

// analyzePosition(fen, { multiPv, movetimeMs, depth, searchMoves, onProgress, signal })
//   -> { lines, source: "stockfish" | "local", depth, cached?, aborted? }
//
// lines[] are engine lines ({ multipv, depth, score: { type: "cp" | "mate", value },
// pv: [uci] }), scores from the point of view of the side to move: feed them to
// Ludus.Scoring (and Ludus.Engine.moverScore) as they are. With the shallow
// fallback there is one line and the mates it can see are encoded the same way.
// Results are cached (fen, depth, time, MultiPV and searchmoves make the key);
// the same request made while it is still running joins it instead of asking the
// engine twice. If the strong engine fails on the way the page drops to the
// fallback for the rest of the session, and the answer says so in `source`.
// `aborted` (with no lines) means a new session / leaving the game cancelled it.
async function analyzePosition(fen, options = {}) {
  const request = normalizeAnalysisRequest(fen, options);
  const callerSignal = options && options.signal ? options.signal : null;
  const generation = STATE.analysis.generation;
  const isAborted = () => Boolean(callerSignal && callerSignal.aborted) || generation !== STATE.analysis.generation;
  if (!request) return { lines: [], source: engineSourceName(), depth: 0, aborted: false };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (isAborted()) return { lines: [], source: engineSourceName(), depth: 0, aborted: true };
    const source = engineSourceName();
    const key = analysisCacheKey(source, request);
    const cached = readAnalysisCache(key);
    if (cached) {
      if (request.onProgress) request.onProgress({ ratio: 1, elapsedMs: 0, targetMs: request.movetimeMs, cached: true });
      return { lines: cloneAnalysisLines(cached.lines), source, depth: cached.depth, cached: true, aborted: false };
    }

    const inflightKey = `${generation}|${key}`;
    let pending = STATE.analysis.inflight.get(inflightKey);
    const joined = Boolean(pending);
    if (!pending) {
      pending = (async () => {
        if (source === "stockfish") {
          try {
            const result = await runStockfishAnalysis(request, isAborted);
            if (result.aborted) return { ...result, source, lines: [] };
            if (result.lines.length) return { ...result, source };
            // The engine answered but had no line to give (a game that is
            // already over, say): the fallback covers this one request only.
          } catch (error) {
            if (isAborted()) return { lines: [], depth: 0, aborted: true, source };
            console.info("The strong engine failed; the fallback takes over.", error);
            resetEngineToLocal();
          }
        }
        const local = await runLocalAnalysis(request);
        return { ...local, source: "local" };
      })().finally(() => {
        if (STATE.analysis.inflight.get(inflightKey) === pending) STATE.analysis.inflight.delete(inflightKey);
      });
      STATE.analysis.inflight.set(inflightKey, pending);
    }

    const result = await pending;
    if (result.aborted && !isAborted()) continue; // someone else's cancellation: ask again
    if (joined && request.onProgress) request.onProgress({ ratio: 1, elapsedMs: 0, targetMs: request.movetimeMs, cached: true });
    if (!result.aborted && !result.timedOut && result.lines.length) {
      writeAnalysisCache(analysisCacheKey(result.source, request), { lines: cloneAnalysisLines(result.lines), depth: result.depth });
    }
    if (request.onProgress && !result.aborted) request.onProgress({ ratio: 1, elapsedMs: 0, targetMs: request.movetimeMs, depth: result.depth });
    return {
      lines: cloneAnalysisLines(result.lines),
      source: result.source,
      depth: result.depth,
      aborted: Boolean(result.aborted),
    };
  }
  return { lines: [], source: engineSourceName(), depth: 0, aborted: true };
}


function inferPlayerName(games) {
  const map = new Map();
  games.forEach((g) => {
    [g.tags.White, g.tags.Black].forEach((n) => {
      const clean = cleanTagValue(n);
      if (!clean) return;
      map.set(clean, (map.get(clean) || 0) + 1);
    });
  });
  const best = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "";
}

// Picks whose mistakes the session trains. The username the person asked for
// wins over counting names: with a single downloaded game, or when the same
// opponent appears as often as the user, frequency picks the opponent. Returns
// the spelling used in the game tags so the screen shows the real name.
function resolveTargetPlayerName(games, requestedName) {
  const requested = normalizeName(requestedName);
  if (!requested) return { name: inferPlayerName(games), requestedMissing: false };
  for (const game of games) {
    for (const tag of [game.tags.White, game.tags.Black]) {
      const clean = cleanTagValue(tag);
      if (clean && normalizeName(clean) === requested) {
        return { name: clean, requestedMissing: false };
      }
    }
  }
  return { name: "", requestedMissing: true };
}

function getPlayerColor(tags, targetName) {
  const white = normalizeName(tags.White);
  const black = normalizeName(tags.Black);
  const target = normalizeName(targetName);
  if (!target) return null;
  if (white === target) return "w";
  if (black === target) return "b";
  return null;
}

function buildMeta(tags, moveNumber, sideToMove) {
  const players = `${cleanTagValue(tags.White) || t("common.white")} vs ${cleanTagValue(tags.Black) || t("common.black")}`;
  const event = cleanTagValue(tags.Event) || t("common.gameFallback");
  const date = cleanTagValue(tags.Date);
  const yearMatch = date.match(/^(\d{4})/);
  const year = yearMatch ? yearMatch[1] : "";
  const site = cleanTagValue(tags.Site);
  const eco = cleanTagValue(tags.ECO);
  const result = cleanTagValue(tags.Result);
  return {
    players,
    event,
    year,
    site,
    eco,
    result,
    moveNumber,
    sideToMove,
  };
}

function buildRandomCandidateQueue(games, targetName) {
  const byGame = [];
  games.forEach((game, gameIdx) => {
    const playerColor = getPlayerColor(game.tags, targetName);
    if (!playerColor) return;
    const plyIndices = [];
    for (let ply = 0; ply < game.sanMoves.length; ply += 1) {
      const mover = ply % 2 === 0 ? "w" : "b";
      if (mover === playerColor) plyIndices.push(ply);
    }
    if (plyIndices.length === 0) return;
    byGame.push({ gameIdx, playerColor, plyIndices: shuffle(plyIndices) });
  });

  const shuffledGames = shuffle(byGame);
  const queue = [];

  // Interleave candidates by game so sessions naturally mix different games.
  let remaining = true;
  while (remaining) {
    remaining = false;
    shuffledGames.forEach((entry) => {
      const ply = entry.plyIndices.pop();
      if (!Number.isInteger(ply)) return;
      remaining = true;
      queue.push({ gameIdx: entry.gameIdx, playerColor: entry.playerColor, ply });
    });
  }
  return queue;
}

function updateAnalysisProgress(done, total, detected, extraText) {
  const safeTotal = Math.max(total || 0, 1);
  const pctRaw = clamp((done / safeTotal) * 100, 0, 100);
  let pctLabel = Math.round(pctRaw * 100) / 100;
  if (done > 0 && pctRaw > 0 && pctLabel === 0) pctLabel = 0.01;
  const pctVisual = done > 0 ? Math.max(pctRaw, 0.35) : 0;
  analysisProgressWrapEl.classList.remove("hidden");
  analysisProgressBarEl.style.width = `${pctVisual}%`;
  analysisProgressLabelEl.textContent = t("analysis.progressLabel", {
    pct: pctLabel,
    done,
    total: total || 0,
    extra: extraText ? ` - ${extraText}` : "",
  });
  if (STATE.userMode === "engineer") {
    analysisMetricsEl.classList.remove("hidden");
    analysisMetricsEl.textContent = t("analysis.metrics.engineer", {
      total: total || 0,
      done,
      detected: detected || 0,
    });
  } else {
    analysisMetricsEl.classList.add("hidden");
  }
}

function resetAnalysisProgress() {
  analysisProgressBarEl.style.width = "0%";
  analysisProgressLabelEl.textContent = "0%";
  analysisMetricsEl.classList.add("hidden");
  analysisMetricsEl.textContent = t("analysis.metrics.zero");
}

function updateNextSearchStatus(ctx, phaseText = "", ordinal = null) {
  if (!roundStatusEl || !ctx) return;
  // Clear the text content since the central overlay already shows the "Searching" UI.
  roundStatusEl.textContent = "";
}

// Candidate mistake search (own games): cheap single-line searches, best move
// first and then only the move that was played (searchmoves), each on a short
// adaptive budget. MultiPV would make every candidate slower for nothing here:
// the round itself gets the full MultiPV analysis when it is played.
async function evaluateCandidateForMistake(candidate, ctx) {
  const game = ctx.games[candidate.gameIdx];
  if (!game) return null;
  const { tags, sanMoves } = game;

  const chess = new Chess(game.startFen || Chess.START_FEN);
  for (let ply = 0; ply <= candidate.ply; ply += 1) {
    const san = sanMoves[ply];
    const move = sanToMove(san, chess);
    if (!move) return null;

    if (ply === candidate.ply) {
      const moverColor = chess.turn;
      if (moverColor !== candidate.playerColor) return null;

      const before = chess.clone();
      const moveNumber = Math.floor(ply / 2) + 1;

      if (before.generateMoves().length < MIN_LEGAL_MOVES_FOR_CANDIDATE) return null;

      const adaptive = adaptiveThreshold(ctx.thresholdCp, before);
      const budgetMs = adaptiveMoveTime(ctx.moveTimeMs, before);
      const playedUci = moveToUci(move);
      const beforeFen = before.fen();

      const bestResult = await analyzePosition(beforeFen, { multiPv: 1, movetimeMs: budgetMs });
      const bestLine = bestResult.lines[0];
      if (!bestLine) return null;
      const bestUci = lineFirstUci(bestLine);
      // The person played the engine's move: nothing to learn here, and one search saved.
      if (!bestUci || bestUci === playedUci) return null;
      const playedResult = await analyzePosition(beforeFen, { searchMoves: [playedUci], multiPv: 1, movetimeMs: budgetMs });
      const playedLine = playedResult.lines[0];
      if (!playedLine) return null;

      const bestMover = lineMoverScore(bestLine);
      const playedMover = lineMoverScore(playedLine);
      const scored = computeLossAgainstBest(bestMover, playedMover);

      if ((scored.diff || 0) < adaptive.threshold) return null;

      const bestMove = uciToMove(bestUci, before);
      return {
        id: `own:${Ludus.util.hashString(beforeFen)}`,
        source: "own",
        fen: beforeFen,
        meta: buildMeta(tags, moveNumber, moverColor),
        gameIdx: candidate.gameIdx,
        gameMoveUci: playedUci,
        gameMoveSan: moveToSan(before, move),
        gameEvalText: formatScoreText(playedMover),
        bestMoveUci: bestUci,
        bestMoveSan: bestMove ? moveToSan(before, bestMove) : bestUci,
        bestEvalText: formatScoreText(bestMover),
        lossCp: scored.diff || 0,
        thresholdUsed: adaptive.threshold,
        phase: adaptive.phase,
        gameIndex: candidate.gameIdx + 1,
      };
    }

    chess.makeMove(move);
  }
  return null;
}

// Reports how the search ended, not only what it found. Cancelling and running
// out of candidates both used to come back as nothing, so cancelling ended the
// session as if there were no positions left.
async function findNextMistake(ctx, extraStatusPrefix = "") {
  const mistake = await searchNextMistake(ctx, extraStatusPrefix);
  if (mistake) return { status: "found", mistake };
  return { status: STATE.ui.searchCancelRequested ? "cancelled" : "exhausted", mistake: null };
}

async function searchNextMistake(ctx, extraStatusPrefix = "") {
  if (!ctx || STATE.analysisInProgress) return null;
  STATE.analysisInProgress = true;
  STATE.ui.searchCancelRequested = false;
  const searchStartedAt = Date.now();
  let evaluatedInThisSearch = 0;
  const isNextSearch = String(extraStatusPrefix || "").trim().toLowerCase().startsWith("siguiente");
  try {
    if (!Array.isArray(ctx.repeatMistakes)) ctx.repeatMistakes = [];
    if (ctx.cursor >= ctx.candidates.length && ctx.repeatMistakes.length > 0) {
      const fallback = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(fallback.gameIdx)) usedGames.add(fallback.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detectedRepeated"));
      analysisStatusEl.textContent = t("analysis.status.reused", { prefix: extraStatusPrefix, count: ctx.detected });
      if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
      return fallback;
    }

    let scannedThisCall = 0;
    const maxScanPerCall = 140;
    while (
      ctx.cursor < ctx.candidates.length &&
      !STATE.ui.searchCancelRequested &&
      Date.now() - searchStartedAt < MISTAKE_SEARCH_TIME_BUDGET_MS &&
      evaluatedInThisSearch < MISTAKE_SEARCH_CANDIDATE_BUDGET
    ) {
      const candidate = ctx.candidates[ctx.cursor];
      const ordinal = ctx.cursor + 1;
      analysisStatusEl.textContent = t("analysis.status.candidate", {
        prefix: extraStatusPrefix,
        ordinal,
        total: ctx.total,
        detected: ctx.detected,
      });
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.evaluatingCandidate", { ordinal, total: ctx.total }));
      if (isNextSearch) updateNextSearchStatus(ctx, "Evaluando candidata", ordinal);
      await yieldToUi();

      ctx.cursor += 1;
      const mistake = await evaluateCandidateForMistake(candidate, ctx);
      ctx.analyzed += 1;
      if (STATE.ui.searchCancelRequested) {
        // Cancelling while a candidate was being evaluated has to stop here.
        // Keep what the engine just found so the next search can reuse it.
        if (mistake) ctx.repeatMistakes.push(mistake);
        break;
      }
      if (mistake) {
        const gameIdx = Number.isInteger(mistake.gameIdx) ? mistake.gameIdx : candidate.gameIdx;
        const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
        const uniqueGameCount = Number.isInteger(ctx.uniqueGameCount) ? ctx.uniqueGameCount : 0;
        const alreadyUsed = usedGames ? usedGames.has(gameIdx) : false;
        const canStillDiversify = usedGames && uniqueGameCount > 0 && usedGames.size < uniqueGameCount;

        if (!alreadyUsed || !canStillDiversify) {
          if (usedGames) usedGames.add(gameIdx);
          ctx.detected += 1;
          updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detected"));
          analysisStatusEl.textContent = t("analysis.status.ready", { prefix: extraStatusPrefix, count: ctx.detected });
          if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada");
          return mistake;
        }

        // Keep repeated-game candidates as fallback and continue searching unseen games.
        ctx.repeatMistakes.push(mistake);
      }

      scannedThisCall += 1;
      evaluatedInThisSearch += 1;
      if (scannedThisCall >= maxScanPerCall && ctx.repeatMistakes.length > 0) {
        const fallback = ctx.repeatMistakes.shift();
        const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
        if (usedGames && Number.isInteger(fallback.gameIdx)) usedGames.add(fallback.gameIdx);
        ctx.detected += 1;
        updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detectedRepeated"));
        analysisStatusEl.textContent = t("analysis.status.continuity", { prefix: extraStatusPrefix, count: ctx.detected });
        if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
        return fallback;
      }

      if (ctx.analyzed % 2 === 0) {
        updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.searchingError"));
        if (isNextSearch) updateNextSearchStatus(ctx, "Buscando error");
        await yieldToUi();
      }
    }

    if (!STATE.ui.searchCancelRequested && ctx.repeatMistakes.length > 0) {
      const deferredRepeat = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(deferredRepeat.gameIdx)) usedGames.add(deferredRepeat.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detectedRepeated"));
      analysisStatusEl.textContent = t("analysis.status.noFresh", { prefix: extraStatusPrefix, count: ctx.detected });
      if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
      return deferredRepeat;
    }

    if (STATE.ui.searchCancelRequested) {
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.cancelled"));
      if (isNextSearch) updateNextSearchStatus(ctx, "Búsqueda cancelada");
      return null;
    }

    updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.finished"));
    analysisStatusEl.textContent = t("analysis.status.noMore", { prefix: extraStatusPrefix });
    if (isNextSearch) updateNextSearchStatus(ctx, "Búsqueda finalizada");
    return null;
  } finally {
    STATE.analysisInProgress = false;
  }
}

// ---------- UI / Gameplay ----------

function setBoardPerspective(turn) {
  const perspective = turn === "b" ? "b" : "w";
  if (STATE.boardPerspective !== perspective) {
    STATE.boardPerspective = perspective;
    STATE.keyboardFocusSquare = null;
    buildBoard();
  }
}

function boardInputAcceptsMoves() {
  if (STATE.ui.blockBoardInput) return false;
  if (!STATE.board || !STATE.positions.length) return false;
  const isAnalysisMode = STATE.ui.phase === "result_analysis";
  if (!isAnalysisMode && nextBtn.disabled === false) return false;
  if (!isAnalysisMode && (STATE.roundSubmitted || STATE.isResolvingRound)) return false;
  return true;
}

function pieceAriaName(piece) {
  const keyByPiece = {
    P: "piece.whitePawn",
    N: "piece.whiteKnight",
    B: "piece.whiteBishop",
    R: "piece.whiteRook",
    Q: "piece.whiteQueen",
    K: "piece.whiteKing",
    p: "piece.blackPawn",
    n: "piece.blackKnight",
    b: "piece.blackBishop",
    r: "piece.blackRook",
    q: "piece.blackQueen",
    k: "piece.blackKing",
  };
  return keyByPiece[piece] ? t(keyByPiece[piece]) : t("board.empty");
}

function boardSquareAriaLabel(squareName, piece, stateParts = []) {
  const state = stateParts.filter(Boolean).join("");
  return t("board.squareLabel", {
    square: squareName,
    piece: piece ? pieceAriaName(piece) : t("board.empty"),
    state,
  });
}

function setBoardKeyboardFocusSquare(squareName, options = {}) {
  if (!boardEl || !squareName) return;
  const target = boardEl.querySelector(`[data-square="${squareName}"]`);
  if (!target) return;
  boardEl.querySelectorAll(".square").forEach((square) => {
    square.tabIndex = square === target ? 0 : -1;
  });
  STATE.keyboardFocusSquare = squareName;
  if (options.focus) target.focus();
}

function visibleBoardStartSquare() {
  const firstSquare = boardEl ? boardEl.querySelector(".square") : null;
  return firstSquare?.dataset?.square || null;
}

function nextKeyboardSquare(squareName, key) {
  if (!squareName || !/^([a-h])([1-8])$/.test(squareName)) return null;
  const fileIndex = files.indexOf(squareName[0]);
  const rank = Number(squareName[1]);
  const perspectiveMultiplier = STATE.boardPerspective === "b" ? -1 : 1;
  let nextFileIndex = fileIndex;
  let nextRank = rank;

  if (key === "ArrowRight") nextFileIndex += perspectiveMultiplier;
  if (key === "ArrowLeft") nextFileIndex -= perspectiveMultiplier;
  if (key === "ArrowUp") nextRank += perspectiveMultiplier;
  if (key === "ArrowDown") nextRank -= perspectiveMultiplier;

  if (nextFileIndex < 0 || nextFileIndex > 7 || nextRank < 1 || nextRank > 8) return null;
  return `${files[nextFileIndex]}${nextRank}`;
}

function onSquareKeyDown(event, squareName) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSquareClick(squareName);
    return;
  }
  if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return;
  const nextSquare = nextKeyboardSquare(squareName, event.key);
  if (!nextSquare) return;
  event.preventDefault();
  setBoardKeyboardFocusSquare(nextSquare, { focus: true });
}

function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";
  boardEl.setAttribute("role", "grid");
  boardEl.setAttribute("aria-label", t("board.ariaLabel"));
  const ranks = STATE.boardPerspective === "b" ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const orderedFiles = STATE.boardPerspective === "b" ? [...files].reverse() : files;
  const leftEdgeFile = STATE.boardPerspective === "b" ? "h" : "a";
  const bottomEdgeRank = STATE.boardPerspective === "b" ? 8 : 1;

  ranks.forEach((rank, rowIndex) => {
    const row = document.createElement("div");
    row.className = "board-row";
    row.setAttribute("role", "row");
    row.setAttribute("aria-rowindex", String(rowIndex + 1));

    orderedFiles.forEach((fileLetter, colIndex) => {
      const fileNum = files.indexOf(fileLetter) + 1;
      const square = document.createElement("div");
      square.className = `square ${(rank + fileNum) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.square = `${fileLetter}${rank}`;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-rowindex", String(rowIndex + 1));
      square.setAttribute("aria-colindex", String(colIndex + 1));
      square.tabIndex = -1;
      square.addEventListener("click", () => onSquareClick(square.dataset.square));
      square.addEventListener("focus", () => {
        STATE.keyboardFocusSquare = square.dataset.square;
      });
      square.addEventListener("keydown", (event) => onSquareKeyDown(event, square.dataset.square));

      if (fileLetter === leftEdgeFile) {
        const rankCoord = document.createElement("span");
        rankCoord.className = "coord coord-rank";
        rankCoord.textContent = String(rank);
        square.appendChild(rankCoord);
      }
      if (rank === bottomEdgeRank) {
        const fileCoord = document.createElement("span");
        fileCoord.className = "coord coord-file";
        fileCoord.textContent = fileLetter;
        square.appendChild(fileCoord);
      }

      row.appendChild(square);
    });

    boardEl.appendChild(row);
  });
}

function squareCenterOnBoard(squareName) {
  if (!boardArrowsEl || !squareName) return null;
  const squareEl = boardEl.querySelector(`[data-square="${squareName}"]`);
  if (!squareEl) return null;
  const hostRect = boardArrowsEl.getBoundingClientRect();
  const rect = squareEl.getBoundingClientRect();
  return {
    x: rect.left - hostRect.left + (rect.width / 2),
    y: rect.top - hostRect.top + (rect.height / 2),
    size: Math.min(rect.width, rect.height),
  };
}

function renderBoardArrows() {
  if (!boardArrowsEl) return;
  boardArrowsEl.innerHTML = "";

  // Arrows belong to the result, except the one that gives the move away when
  // the hint is taken to its last level.
  if (!STATE.resultView || (!STATE.resultView.visible && !hintRevealsMove())) return;

  const width = boardArrowsEl.clientWidth || boardEl.clientWidth;
  const height = boardArrowsEl.clientHeight || boardEl.clientHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  boardArrowsEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  boardArrowsEl.setAttribute("preserveAspectRatio", "none");

  const ns = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(ns, "defs");

  const arrowStyles = {
    best: { id: "arrow-head-best", color: "rgba(31, 143, 95, 0.75)" },
    game: { id: "arrow-head-game", color: "rgba(0, 188, 212, 0.65)" },
    user: { id: "arrow-head-user", color: "rgba(25, 118, 210, 0.55)" },
    userAlt: { id: "arrow-head-userAlt", color: "rgba(0, 188, 212, 0.55)" },
  };

  Object.values(arrowStyles).forEach(style => {
    const marker = document.createElementNS(ns, "marker");
    marker.setAttribute("id", style.id);
    marker.setAttribute("markerWidth", "11");
    marker.setAttribute("markerHeight", "9");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "4.5");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");

    const arrowHead = document.createElementNS(ns, "path");
    arrowHead.setAttribute("d", "M0,0 L9,4.5 L0,9 z");
    arrowHead.setAttribute("fill", style.color);
    marker.appendChild(arrowHead);
    defs.appendChild(marker);
  });
  boardArrowsEl.appendChild(defs);

  if (!STATE.revealed) return;

  Object.entries(STATE.revealed).forEach(([key, move]) => {
    if (!move || !Number.isFinite(move.from) || !Number.isFinite(move.to)) return;

    const fromSquare = Chess.indexToSquare(move.from);
    const toSquare = Chess.indexToSquare(move.to);
    const from = squareCenterOnBoard(fromSquare);
    const to = squareCenterOnBoard(toSquare);
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 2) return;

    const ux = dx / distance;
    const uy = dy / distance;
    const startTrim = Math.max(8, from.size * 0.15);
    const endTrim = Math.max(12, to.size * 0.28);
    const x1 = from.x + ux * startTrim;
    const y1 = from.y + uy * startTrim;
    const x2 = to.x - ux * endTrim;
    const y2 = to.y - uy * endTrim;

    const line = document.createElementNS(ns, "line");
    line.classList.add("board-arrow-line");
    line.style.stroke = arrowStyles[key] ? arrowStyles[key].color : "rgba(100, 100, 100, 0.5)";
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("marker-end", `url(#${arrowStyles[key] ? arrowStyles[key].id : ""})`);

    boardArrowsEl.appendChild(line);
  });
}

function renderBoard() {
  if (!boardEl) return;
  boardEl.setAttribute("aria-label", t("board.ariaLabel"));
  const acceptsInput = boardInputAcceptsMoves();
  boardEl.querySelectorAll(".square").forEach((square) => {
    square.classList.remove(
      "selected", "legal", "capture",
      "best-from", "best-to", "game-from", "game-to", "user-from", "user-to", "user-alt-from", "user-alt-to",
      "hint-from", "hint-to",
    );
    const existingPiece = square.querySelector(".piece-img");
    if (existingPiece) existingPiece.remove();

    if (!STATE.board) return;
    const index = Chess.squareToIndex(square.dataset.square);
    const piece = STATE.board.pieceAt(index);
    if (piece) {
      const image = document.createElement("img");
      image.className = "piece-img";
      image.src = PIECE_IMAGES[piece];
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.draggable = false;
      square.appendChild(image);
    }
  });

  if (STATE.selection) {
    const selected = boardEl.querySelector(`[data-square="${STATE.selection}"]`);
    if (selected) selected.classList.add("selected");
  }

  STATE.legalMoves.forEach((move) => {
    const target = boardEl.querySelector(`[data-square="${Chess.indexToSquare(move.to)}"]`);
    if (!target) return;
    target.classList.add(move.capture ? "capture" : "legal");
  });

  const paint = (move, fromClass, toClass) => {
    if (!move) return;
    const from = boardEl.querySelector(`[data-square="${Chess.indexToSquare(move.from)}"]`);
    const to = boardEl.querySelector(`[data-square="${Chess.indexToSquare(move.to)}"]`);
    if (from) from.classList.add(fromClass);
    if (to) to.classList.add(toClass);
  };

  paint(STATE.revealed.best, "best-from", "best-to");
  paint(STATE.revealed.game, "game-from", "game-to");
  // A hint reuses the "best" highlight (the same green ring) plus its own class:
  // level 1 marks the piece to move, level 2 also its destination.
  const hintMove = visibleHintMove();
  if (hintMove) {
    const hintFrom = boardEl.querySelector(`[data-square="${Chess.indexToSquare(hintMove.from)}"]`);
    if (hintFrom) hintFrom.classList.add("hint-from", "best-from");
    if (hintMove.showTo) {
      const hintTo = boardEl.querySelector(`[data-square="${Chess.indexToSquare(hintMove.to)}"]`);
      if (hintTo) hintTo.classList.add("hint-to", "best-to");
    }
  }
  paint(STATE.revealed.user, "user-from", "user-to");
  paint(STATE.revealed.userAlt, "user-alt-from", "user-alt-to");

  const startSquare = visibleBoardStartSquare();
  const focusSquare = STATE.keyboardFocusSquare && boardEl.querySelector(`[data-square="${STATE.keyboardFocusSquare}"]`)
    ? STATE.keyboardFocusSquare
    : (STATE.selection || startSquare);

  boardEl.querySelectorAll(".square").forEach((square) => {
    const squareName = square.dataset.square;
    const piece = STATE.board ? STATE.board.pieceAt(Chess.squareToIndex(squareName)) : null;
    const stateParts = [];
    if (square.classList.contains("selected")) stateParts.push(t("board.selected"));
    if (square.classList.contains("capture")) stateParts.push(t("board.captureTarget"));
    else if (square.classList.contains("legal")) stateParts.push(t("board.legalTarget"));
    // Not by colour alone: a hinted square says so to a screen reader too.
    if (square.classList.contains("hint-from")) stateParts.push(t("core.hint.square.from"));
    if (square.classList.contains("hint-to")) stateParts.push(t("core.hint.square.to"));
    if (!acceptsInput) stateParts.push(t("board.disabled"));

    square.setAttribute("aria-label", STATE.board ? boardSquareAriaLabel(squareName, piece, stateParts) : squareName);
    square.setAttribute("aria-selected", square.classList.contains("selected") ? "true" : "false");
    square.setAttribute("aria-disabled", acceptsInput ? "false" : "true");
    square.tabIndex = STATE.board && squareName === focusSquare ? 0 : -1;
  });
  if (focusSquare) STATE.keyboardFocusSquare = focusSquare;
  renderBoardArrows();
}

function renderGameInfo(position) {
  const m = position.meta;
  const event = m.event || t("common.gameFallback");
  const year = m.year || "?";
  const eco = m.eco || "-";
  const result = m.result || "-";
  const move = m.moveNumber ? String(m.moveNumber) : "-";
  const players = m.players || "-";
  if (gameDetailsMiniEl) {
    if (STATE.userMode === "citizen") {
      gameDetailsMiniEl.textContent = t("game.infoCitizen", { players, event, year, move });
    } else {
      gameDetailsMiniEl.textContent = t("game.infoEngineer", { players, event, year, eco, result, move });
    }
  }
}

function snapshotMove(move) {
  if (!move || !Number.isFinite(move.from) || !Number.isFinite(move.to)) return null;
  const copy = { from: move.from, to: move.to };
  if (move.promotion) copy.promotion = move.promotion;
  return copy;
}

function historyEntryLabel(entry) {
  const round = Number.isFinite(entry?.round) ? entry.round : "-";
  return t("evaluation.historyPosition", { round });
}

function renderHistoryPreview(entry) {
  if (!roundResultEl || !entry) return;
  const moduleLine = `<p><strong>${escapeHtml(t("evaluation.historyModule"))}:</strong> ${escapeHtml(entry.bestSan || "-")}</p>`;
  const gameLine = `<p><strong>${escapeHtml(t("evaluation.historyGame"))}:</strong> ${escapeHtml(entry.gameSan || "-")}</p>`;
  let userLines = "";
  if (entry.mode === "duel") {
    userLines = `
      <p><strong>${escapeHtml(entry.player1Name || duelPlayerName(0))}:</strong> ${escapeHtml(entry.player1San || qualityLabel("no_move"))}</p>
      <p><strong>${escapeHtml(entry.player2Name || duelPlayerName(1))}:</strong> ${escapeHtml(entry.player2San || qualityLabel("no_move"))}</p>
    `;
  } else {
    userLines = `<p><strong>${escapeHtml(t("evaluation.historyYourMove"))}:</strong> ${escapeHtml(entry.userSan || qualityLabel("no_move"))}</p>`;
  }
  roundResultEl.innerHTML = `
    <div class="history-preview">
      <p class="history-preview-title"><strong>${escapeHtml(historyEntryLabel(entry))}</strong></p>
      ${moduleLine}
      ${gameLine}
      ${userLines}
    </div>
  `;
}

function openHistoryEntry(index) {
  if (!Array.isArray(STATE.historyEntries) || STATE.historyEntries.length === 0) return;
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= STATE.historyEntries.length) return;
  const entry = STATE.historyEntries[idx];
  STATE.historySelectedIdx = idx;
  renderHistoryList();

  if (!entry || !entry.fen) return;
  STATE.board = new Chess(entry.fen);
  setBoardPerspective(STATE.board.turn);
  if (entry.meta) {
    renderGameInfo({ meta: entry.meta });
  }
  if (roundStatusEl) {
    roundStatusEl.textContent = t("game.roundReview", { label: historyEntryLabel(entry) });
  }
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  if (entry.mode === "duel") {
    const primaryUserMove = entry.player2Move || entry.player1Move || null;
    const secondaryUserMove = entry.player2Move && entry.player1Move ? entry.player1Move : null;
    STATE.revealed = {
      best: entry.bestMove || null,
      game: entry.gameMove || null,
      user: primaryUserMove,
      userAlt: secondaryUserMove,
    };
  } else {
    STATE.revealed = {
      best: entry.bestMove || null,
      game: entry.gameMove || null,
      user: entry.userMove || null,
      userAlt: null,
    };
  }
  renderBoard();
  if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");
  renderHistoryPreview(entry);
}

function renderHistoryList() {
  if (!historyEl) return;
  if (!Array.isArray(STATE.historyEntries) || STATE.historyEntries.length === 0) {
    historyEl.innerHTML = `<li class="history-empty">${escapeHtml(t("evaluation.historyEmpty"))}</li>`;
    return;
  }
  historyEl.innerHTML = "";
  STATE.historyEntries.forEach((entry, idx) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item-btn";
    btn.dataset.historyIndex = String(idx);
    btn.textContent = historyEntryLabel(entry);
    btn.addEventListener("click", () => openHistoryEntry(idx));
    if (idx === STATE.historySelectedIdx) btn.classList.add("active");
    li.appendChild(btn);
    historyEl.appendChild(li);
  });
}

function pushHistoryEntry(entry) {
  if (!entry) return;
  STATE.historyEntries.unshift(entry);
  STATE.historySelectedIdx = 0;
  renderHistoryList();
}

function renderSessionProgress() {
  const played = STATE.sessionPlayed;
  const target = soloSessionTarget();
  const remaining = Math.max(0, target - played);
  if (soloProgressLineEl) soloProgressLineEl.innerHTML = renderSessionProgressBar(played, target);
  if (!isDuelMode()) {
    sessionProgressEl.textContent = t("game.progressSolo", { played, target, remaining });
    return;
  }
  const p1 = duelPlayerName(0);
  const p2 = duelPlayerName(1);
  const currentRound = Math.min(Math.max(1, STATE.index + 1), target);
  sessionProgressEl.textContent = t("game.progressDuel", {
    round: currentRound,
    target,
    remaining,
    p1,
    p2,
    p1Hits: STATE.duel.hits[0],
    p2Hits: STATE.duel.hits[1],
  });
}

function startRound(options = {}) {
  const position = STATE.positions[STATE.index];
  if (!position) return;

  const preserveDuelRoundResults = Boolean(options.preserveDuelRoundResults);
  if (isDuelMode() && !preserveDuelRoundResults) {
    STATE.duel.roundResults = [null, null];
  }

  STATE.board = new Chess(position.fen);
  setBoardPerspective(STATE.board.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.roundSubmitted = false;
  STATE.isResolvingRound = false;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  STATE.duel.handoffReady = false;
  resetHintState();
  setUiPhase("playing", false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();

  renderGameInfo(position);
  renderSessionTitle();
  const totalTarget = Math.max(1, STATE.targetPositions || STATE.positions.length || 1);
  // El rótulo dice sólo la posición; de quién es el turno lo dice el centro de
  // la barra de ronda, así no se repite el mismo dato dos veces.
  roundStatusEl.textContent = t("game.roundSolo", { current: STATE.index + 1, target: totalTarget });
  if (roundResultPanelEl) roundResultPanelEl.classList.add("hidden");
  roundResultEl.innerHTML = "";
  setScoringInfoVisible(false);
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  updatePlayerPanels();
  setThinkingMode(true);
  stopRoundTimer();
  startRoundTimer();
  nextBtn.disabled = true;
  skipBtn.disabled = false;
  nextBtn.textContent = t("buttons.nextPosition");

  renderBoard();
  updateHintButton();
  focusBoardAfterRoundStart();
  // The person is about to think for a while and the engine has nothing to do:
  // the analysis that scoring needs starts now, so the answer is scored almost at once.
  prefetchRoundReference(position);
}

function onSquareClick(square) {
  STATE.keyboardFocusSquare = square;
  if (STATE.ui.blockBoardInput) return;
  if (!STATE.board || !STATE.positions.length) return;
  const isAnalysisMode = STATE.ui.phase === "result_analysis";
  if (!isAnalysisMode && nextBtn.disabled === false) return;
  if (!isAnalysisMode && (STATE.roundSubmitted || STATE.isResolvingRound)) return;

  const index = Chess.squareToIndex(square);
  const piece = STATE.board.pieceAt(index);

  if (STATE.selection) {
    const matches = STATE.legalMoves.filter((candidate) => candidate.to === index);
    // Several legal moves share the same from/to only when a pawn can
    // under-promote: queen, rook, bishop and knight are all reachable by the
    // same click. Ask which one instead of silently taking the first (queen).
    if (matches.length > 1) {
      openPromotionPicker(matches, isAnalysisMode);
      return;
    }
    const move = matches[0];
    if (move) {
      if (isAnalysisMode) {
        STATE.board.makeMove(move);
        STATE.selection = null;
        STATE.legalMoves = [];
        renderBoard();
        return;
      }
      submitUserMove(move);
      return;
    }
  }

  if (!piece) {
    STATE.selection = null;
    STATE.legalMoves = [];
    renderBoard();
    return;
  }

  if ((STATE.board.turn === "w" && piece === piece.toLowerCase()) ||
    (STATE.board.turn === "b" && piece === piece.toUpperCase())) {
    STATE.selection = null;
    STATE.legalMoves = [];
    renderBoard();
    return;
  }

  STATE.selection = square;
  STATE.legalMoves = STATE.board.generateMoves().filter((m) => m.from === index);
  renderBoard();
}

async function submitUserMove(move) {
  await resolveRound(move);
}

// Opens the piece-choice picker instead of committing a move outright. Used
// only when a click's destination is ambiguous between under-promotions.
function openPromotionPicker(matches, isAnalysisMode) {
  if (!promotionPickerEl || !matches.length) return;
  const isWhitePromotion = matches[0].promotion === matches[0].promotion.toUpperCase();
  promotionChoiceEls.forEach((btn, i) => {
    if (!btn) return;
    const code = ["Q", "R", "B", "N"][i];
    const pieceChar = isWhitePromotion ? code : code.toLowerCase();
    const img = btn.querySelector("img");
    if (img) {
      img.src = PIECE_IMAGES[pieceChar];
      img.alt = pieceAriaName(pieceChar);
    }
    btn.setAttribute("aria-label", pieceAriaName(pieceChar));
  });
  STATE.pendingPromotion = {
    matches,
    isAnalysisMode,
    returnFocusEl: document.activeElement || null,
  };
  promotionPickerEl.classList.remove("hidden");
  // Deferred so the browser has laid out the now-visible buttons before one
  // of them is asked to take focus.
  setTimeout(() => {
    if (promotionChoiceEls[0]) promotionChoiceEls[0].focus();
  }, 0);
}

// Closes the picker without committing anything and returns focus to wherever
// it was before the picker opened (Escape, or a choice already handled).
function closePromotionPicker(options = {}) {
  if (!promotionPickerEl) return;
  const pending = STATE.pendingPromotion;
  STATE.pendingPromotion = null;
  promotionPickerEl.classList.add("hidden");
  const returnFocusEl = pending?.returnFocusEl;
  if (!options.skipFocusReturn && returnFocusEl && typeof returnFocusEl.focus === "function") {
    returnFocusEl.focus();
  }
}

function choosePromotion(promotionLetter) {
  const pending = STATE.pendingPromotion;
  if (!pending) return;
  const chosen = pending.matches.find(
    (m) => (m.promotion || "").toUpperCase() === String(promotionLetter).toUpperCase(),
  );
  closePromotionPicker({ skipFocusReturn: true });
  if (!chosen) return;
  if (pending.isAnalysisMode) {
    STATE.board.makeMove(chosen);
    STATE.selection = null;
    STATE.legalMoves = [];
    renderBoard();
    return;
  }
  submitUserMove(chosen);
}

function onPromotionPickerKeyDown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closePromotionPicker();
    return;
  }
  if (event.key !== "Tab") return;
  // Trap focus among the four choices instead of letting Tab leave the picker.
  const currentIndex = promotionChoiceEls.indexOf(document.activeElement);
  if (currentIndex === -1) return;
  const lastIndex = promotionChoiceEls.length - 1;
  if (!event.shiftKey && currentIndex === lastIndex) {
    event.preventDefault();
    promotionChoiceEls[0].focus();
  } else if (event.shiftKey && currentIndex === 0) {
    event.preventDefault();
    promotionChoiceEls[lastIndex].focus();
  }
}

async function submitNoMove(reason = "no_move") {
  await resolveRound(null, { noMoveReason: reason });
}

// ---------- Hints ----------
// Progressive hints for the round on screen, when the settings (or the session)
// allow them and the best move is known before the answer: level 1 marks the
// piece to move, level 2 also its destination, level 3 shows the move and
// closes the round as revealed (0 points, reason "skip", hintsUsed 3). The
// points they cost are Scoring's (settings.hintCost, applied by assess()).

function hintCostPercent(level) {
  const settings = sessionScoringSettings();
  const cost = settings && settings.hintCost ? settings.hintCost : { level1: 0.15, level2: 0.35, reveal: 1 };
  const fraction = level <= 1 ? cost.level1 : level === 2 ? cost.level2 : cost.reveal;
  return Math.round((Number(fraction) || 0) * 100);
}

function resetHintState() {
  STATE.hint = null;
  STATE.hintsUsed = 0;
}

function hintRevealsMove() {
  return Boolean(STATE.hint && STATE.hint.level >= 3);
}

// What the board shows of the hint. It goes away once the round is being scored
// (the result draws its own arrows).
function visibleHintMove() {
  const hint = STATE.hint;
  if (!hint || hint.level < 1 || STATE.roundSubmitted || STATE.resultView.visible) return null;
  return { from: hint.from, to: hint.to, showTo: hint.level >= 2 };
}

// The root analysis a round is scored against, when it has already finished.
function peekRootAnalysis(position, base) {
  if (hasReferenceLines(position)) return null;
  const plan = getRoundEvaluationPlan(base, position, isDuelMode() ? 2 : 1);
  const request = normalizeAnalysisRequest(position.fen, { multiPv: plan.multiPv, movetimeMs: plan.movetimeMs });
  return request ? (STATE.analysis.cache.get(analysisCacheKey("stockfish", request)) || null) : null;
}

// The move a hint points at, fixed the first time a hint is asked for so level 2
// and 3 keep saying what level 1 said. The position's own lines come first
// (classics, notebook), then the deeper analysis if it has finished, then the
// best move the mistake search found.
function findHintTarget(position, base) {
  let uci = lineFirstUci(referenceLinesOf(position)[0]);
  if (!uci) {
    const cached = peekRootAnalysis(position, base);
    if (cached && cached.lines.length) uci = lineFirstUci(cached.lines[0]);
  }
  if (!uci) uci = String(position.bestMoveUci || "");
  const move = uci ? uciToMove(uci, base) : null;
  return move ? { move, uci: moveToUci(move) } : null;
}

function hintAvailable() {
  if (!STATE.hintsEnabled || !STATE.board || !STATE.positions.length) return false;
  if (STATE.ui.phase !== "playing" || STATE.ui.blockBoardInput) return false;
  if (STATE.roundSubmitted || STATE.isResolvingRound || STATE.resultView.visible) return false;
  if ((STATE.hintsUsed || 0) >= 3) return false;
  const position = STATE.positions[STATE.index];
  if (!position) return false;
  if (STATE.hint && STATE.hint.uci) return true;
  try {
    return Boolean(findHintTarget(position, new Chess(position.fen)));
  } catch (error) {
    return false;
  }
}

function updateHintButton() {
  if (!hintBtn) return;
  hintBtn.classList.toggle("hidden", !STATE.hintsEnabled);
  const nextLevel = Math.min(3, (STATE.hintsUsed || 0) + 1);
  hintBtn.textContent = (STATE.hintsUsed || 0) >= 3
    ? t("core.hint.done")
    : t(`core.hint.next.${nextLevel}`, { pct: hintCostPercent(nextLevel) });
  hintBtn.disabled = !hintAvailable();
}

// A hint is announced through the clock's polite live region (the round bar's
// status): it is the one that is on screen and polite while a round is played,
// and only pressing the hint button writes to it, so it stays quiet otherwise.
function announceHint(text) {
  if (soloClockAnnounceEl) soloClockAnnounceEl.textContent = text;
}

// Ludus.game.hint(): asks for the next hint of the round on screen.
// -> { level, from?, to?, uci? } (squares as "e2"), or null when no hint can be given now.
function requestHint() {
  if (!hintAvailable()) return null;
  const position = STATE.positions[STATE.index];
  const base = new Chess(position.fen);
  if (!STATE.hint) {
    const target = findHintTarget(position, base);
    if (!target) return null;
    STATE.hint = {
      level: 0,
      uci: target.uci,
      from: target.move.from,
      to: target.move.to,
      promotion: target.move.promotion || null,
      san: moveToSan(base, target.move),
      piece: base.pieceAt(target.move.from),
    };
  }
  const hint = STATE.hint;
  hint.level += 1;
  STATE.hintsUsed = hint.level;
  const from = Chess.indexToSquare(hint.from);
  const to = Chess.indexToSquare(hint.to);
  const piece = pieceAriaName(hint.piece);
  const pct = hintCostPercent(hint.level);

  if (hint.level === 1) {
    announceHint(t("core.hint.said.1", { piece, square: from, pct }));
  } else if (hint.level === 2) {
    announceHint(t("core.hint.said.2", { piece, from, to, pct }));
  } else {
    announceHint(t("core.hint.said.3", { san: hint.san }));
    STATE.revealed = { ...STATE.revealed, best: { from: hint.from, to: hint.to, promotion: hint.promotion || undefined } };
  }
  renderBoard();
  updateHintButton();
  if (hint.level >= 3) {
    // The move is shown: the round ends here, worth nothing.
    void resolveRound(null, { noMoveReason: "hint_reveal" });
    return { level: 3, from, to, uci: hint.uci };
  }
  return hint.level === 1 ? { level: 1, from } : { level: 2, from, to };
}

// The reference analysis of a position that brings no lines of its own, started
// while the person thinks (the engine is idle then). The same request is made
// when the answer is scored, so it costs nothing extra: it is a cache hit, or
// the running search that the scoring joins.
function prefetchRoundReference(position) {
  if (!position || hasReferenceLines(position) || engineSourceName() !== "stockfish") return;
  try {
    const base = new Chess(position.fen);
    const plan = getRoundEvaluationPlan(base, position, isDuelMode() ? 2 : 1);
    void analyzePosition(position.fen, { multiPv: plan.multiPv, movetimeMs: plan.movetimeMs }).then(() => {
      // A finished analysis may know a better move than the one the hint had:
      // nothing to do, the hint keeps the one it chose first, but the button may become available.
      updateHintButton();
    }, () => {});
  } catch (error) {
    // Prefetching is an optimisation.
  }
}

function renderSessionTitle() {
  if (!sessionTitleEl) return;
  const title = STATE.session ? String(STATE.session.title || "") : "";
  sessionTitleEl.textContent = title;
  sessionTitleEl.classList.toggle("hidden", !title);
}

// Keyboard: a new round starts with the focus on the board (where the person plays),
// unless they are typing somewhere else. The button that had it ("Next position")
// has just gone away, which would otherwise leave the focus nowhere.
function focusBoardAfterRoundStart() {
  const active = document.activeElement;
  const lost = !active || active === document.body
    || (resultOverlayEl && typeof resultOverlayEl.contains === "function" && resultOverlayEl.contains(active));
  if (!lost || !boardEl || typeof boardEl.querySelector !== "function") return;
  const target = boardEl.querySelector('.square[tabindex="0"]');
  if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
}


function resultStateClass({ hit = false, noMove = false, isReference = false } = {}) {
  if (isReference) return "state-neutral";
  if (noMove) return "state-neutral";
  return hit ? "state-good" : "state-bad";
}

const INF_BAR_LABEL_BANDS = Object.freeze({
  perfect: { min: 0, max: 12 },
  very_good: { min: 12, max: 26 },
  good: { min: 26, max: 42 },
  interesting: { min: 42, max: 58 },
  dubious: { min: 58, max: 74 },
  bad: { min: 74, max: 88 },
  blunder: { min: 88, max: 100 },
  no_move: { min: 46, max: 56 },
});

function qualityToInfographicPercent(code, diff, maxDiff) {
  const band = INF_BAR_LABEL_BANDS[compatQualityCode(code)] || INF_BAR_LABEL_BANDS.no_move;
  const safeMax = Math.max(1, Number(maxDiff) || 1);
  const safeDiff = Number.isFinite(diff) ? clamp(diff, 0, safeMax) : safeMax * 0.5;
  const ratio = safeDiff / safeMax;
  return clamp(band.min + (band.max - band.min) * ratio, 0, 100);
}

function renderVerticalInfographic({ bestNode, gameNode, userNodes }) {
  const container = document.getElementById("vertical-infographic");
  const nodesContainer = document.getElementById("infographic-nodes");
  if (!container || !nodesContainer) return;

  const maxDiff = 400; // clamp eval differences to 400 for visual scaling
  const minSpacing = 16; // minimum percentage spacing between nodes

  // Collect all nodes to be rendered
  let rawNodes = [];

  if (bestNode && bestNode.san && bestNode.san !== "-") {
    rawNodes.push({
      label: t("evaluation.moduleBest"),
      san: bestNode.san,
      meta: bestNode.meta,
      diff: 0,
      authorClass: "node-engine",
      originalPercent: 0,
      isUser: false
    });
  }

  if (gameNode && gameNode.san && gameNode.san !== "-") {
    rawNodes.push({
      label: t("evaluation.gameLine"),
      san: gameNode.san,
      meta: gameNode.meta,
      diff: gameNode.diff || 0,
      authorClass: "node-p2",
      originalPercent: clamp(((gameNode.diff || 0) / maxDiff) * 100, 0, 100),
      isUser: false
    });
  }

  userNodes.forEach(user => {
    if (!user.noMove) {
      const safeDiff = Number.isFinite(user.diff) ? user.diff : maxDiff;
      const label = typeof user.qualityCode === "string" ? user.qualityCode : "no_move";
      rawNodes.push({
        label: user.label,
        san: user.san,
        meta: user.meta,
        diff: safeDiff,
        authorClass: user.authorClass,
        originalPercent: qualityToInfographicPercent(label, safeDiff, maxDiff),
        isUser: true
      });
    }
  });

  // Group by SAN
  let groupedMap = new Map();
  rawNodes.forEach(node => {
    if (!groupedMap.has(node.san)) {
      groupedMap.set(node.san, {
        san: node.san,
        diff: node.diff,
        originalPercent: node.originalPercent,
        authors: []
      });
    }
    groupedMap.get(node.san).authors.push({
      label: node.label,
      authorClass: node.authorClass,
      meta: node.meta
    });
  });

  let groupedNodes = Array.from(groupedMap.values());

  // Sort them from top (0) to bottom (100)
  groupedNodes.sort((a, b) => a.originalPercent - b.originalPercent);

  // Apply minimum spacing rule so they don't overlap vertically
  let currentTop = 0;
  groupedNodes.forEach((node, index) => {
    if (index === 0) {
      node.finalPercent = node.originalPercent;
    } else {
      node.finalPercent = Math.max(node.originalPercent, currentTop + minSpacing);
    }
    currentTop = node.finalPercent;
  });

  let html = "";
  groupedNodes.forEach(node => {
    // Determine the primary class for the border/line (we'll just use the first author's class)
    const primaryClass = node.authors[0].authorClass;

    let authorLabelsHtml = node.authors.map(author => `
       <div class="node-author-block ${escapeHtml(author.authorClass)}">
         <span class="node-label">${escapeHtml(author.label)}</span>
         <span class="node-eval">${escapeHtml(author.meta)}</span>
       </div>
     `).join('');

    html += `
      <div class="infographic-node grouped-node ${escapeHtml(primaryClass)}" style="top: ${node.finalPercent.toFixed(1)}%;">
        <span class="node-move">${escapeHtml(node.san)}</span>
        <div class="node-authors-list">
          ${authorLabelsHtml}
        </div>
      </div>
    `;
  });

  nodesContainer.innerHTML = html;
  container.classList.remove("hidden");
}

function renderRoundFeedbackTable(bestSan, bestEvalText, gameSan, gameEvalText, userSan, userEvalText, bestMover, gameMover, userMover, scored, noMoveReason = "", extra = {}) {
  const noMove = extra.noMove !== undefined ? Boolean(extra.noMove) : !Number.isFinite(userMover);
  const noMoveByTimeout = noMoveReason === "timeout";
  const duelNoMoveNote = noMoveByTimeout
    ? t("evaluation.timeoutZeroPoints")
    : (noMove ? t("evaluation.noMoveZeroPoints") : "");
  const duelSummary = `${t("evaluation.classification")}: ${qualityLabel(scored.qualityCode)} | ${t("evaluation.delta")}: ${formatDelta(bestMover, userMover)} | ${t("evaluation.points")}: ${formatPoints(scored.points)}${duelNoMoveNote ? ` | ${duelNoMoveNote}` : ""}`;

  let userNodes = [];

  if (extra.mode === "duel" && extra.duel) {
    const p1 = extra.duel.player1 || { name: duelPlayerName(0), san: "-", qualityCode: "no_move", points: 0, hit: false };
    const p2 = extra.duel.player2 || { name: duelPlayerName(1), san: "-", qualityCode: "no_move", points: 0, hit: false };

    if (p1.san) {
      userNodes.push({
        label: p1.name,
        san: p1.san,
        meta: qualityLabel(p1.qualityCode),
        qualityCode: p1.qualityCode,
        diff: Number.isFinite(p1.diff) ? p1.diff : null,
        authorClass: "node-p1",
        noMove: false
      });
    }
    if (p2.san) {
      userNodes.push({
        label: p2.name,
        san: p2.san,
        meta: qualityLabel(p2.qualityCode),
        qualityCode: p2.qualityCode,
        diff: Number.isFinite(p2.diff) ? p2.diff : null,
        authorClass: "node-p2", // Player 2 is LightBlue
        noMove: false
      });
    }

    roundResultEl.innerHTML = `<p class="result-summary-line">${escapeHtml(extra.duel.summary || duelSummary)}</p>`;
  } else {
    const infographicEl = document.getElementById("vertical-infographic");
    if (!noMove) {
      userNodes.push({
        label: t("evaluation.yourMove"),
        san: userSan,
        meta: qualityLabel(scored.qualityCode),
        qualityCode: scored.qualityCode,
        diff: Number.isFinite(scored.diff) ? scored.diff : null,
        authorClass: qualityToVerdictClass(scored.qualityCode) || "node-p1",
        noMove: false
      });

      roundResultEl.innerHTML = ""; // No extra summary line for solo mode, as header handles points
      if (infographicEl) infographicEl.classList.remove("hidden");
    } else {
      const soloNoMoveNote = noMoveByTimeout
        ? t("evaluation.timeoutZeroPoints")
        : t("evaluation.noMoveZeroPoints");
      roundResultEl.innerHTML = `<p class="result-summary-line">${escapeHtml(soloNoMoveNote)}</p>`;
      if (infographicEl) infographicEl.classList.add("hidden");
    }
  }
  // Re-enable and reset the reveal buttons
  if (revealBestBtn) {
    revealBestBtn.classList.remove("hidden");
    revealBestBtn.textContent = t("buttons.revealBest");
  }
  if (revealGameBtn) {
    // A position without the move of a game (a review card) has nothing to compare with.
    const hasGameMove = extra.hasGameMove !== undefined ? Boolean(extra.hasGameMove) : true;
    revealGameBtn.classList.toggle("hidden", !hasGameMove);
    revealGameBtn.textContent = revealGameButtonLabel();
  }

  if (!(extra.mode !== "duel" && noMove)) {
    renderVerticalInfographic({ bestNode: null, gameNode: null, userNodes });
  }
}

function finalSessionSummaryText() {
  if (!isDuelMode()) return t("game.finalScoreSolo", { score: soloScoreText() });
  const p1 = duelPlayerName(0);
  const p2 = duelPlayerName(1);
  const s1 = STATE.duel.scores[0];
  const s2 = STATE.duel.scores[1];
  let winner = t("game.finalDraw");
  if (s1 > s2) winner = t("game.finalWinner", { player: p1 });
  if (s2 > s1) winner = t("game.finalWinner", { player: p2 });
  return t("game.finalMatchScore", {
    p1,
    p2,
    s1: formatPoints(s1),
    s2: formatPoints(s2),
    winner,
  });
}

// The round flow: the answer is scored against the engine (evaluateRoundAnswers),
// the result is drawn, the round is announced on the bus ("round:completed", one
// record per player) and the person can move on.
async function resolveRound(move, options = {}) {
  if (STATE.roundSubmitted || STATE.isResolvingRound) return;
  const sessionToken = STATE.sessionToken;
  stopRoundTimer();
  STATE.roundSubmitted = true;
  STATE.isResolvingRound = true;
  const duelFirstTurn = isDuelMode() && STATE.duel.currentPlayer === 0;
  try {
    const { position, base, noMove, noMoveReason, timeSpentMs, hintsUsed } =
      prepareRoundResolutionContext(move, options, duelFirstTurn);

    if (duelFirstTurn) {
      handleDuelFirstTurnHandoff(base, position, move, noMoveReason, { timeSpentMs, hintsUsed });
      return;
    }

    showEvaluatingMoveOnBoard(move, noMove, noMoveReason);

    const answers = buildAnswersToEvaluate(move, noMoveReason, { timeSpentMs, hintsUsed });
    const plan = getRoundEvaluationPlan(base, position, answers.length);
    const evaluationVisibleStartedAt = beginRoundEvaluationOverlay(plan);

    await waitForEngineToLoad();
    if (!isCurrentSessionWork(sessionToken)) return;

    const evaluation = await evaluateRoundAnswers(base, position, answers, plan, {
      onProgress: (payload = {}) => {
        const ratio = clamp(Number(payload.ratio) || 0, 0, 1);
        const elapsedTotalMs = Math.max(0, Number(payload.elapsedTotalMs) || 0);
        setPositionSearchProgress(ratio, t("overlay.progressLabel", {
          pct: Math.round(ratio * 100),
          elapsed: (elapsedTotalMs / 1000).toFixed(1),
          total: (plan.totalBudgetMs / 1000).toFixed(1),
        }));
      },
    });
    // null: the work was cancelled (a new session, or leaving the game).
    if (!evaluation || !isCurrentSessionWork(sessionToken)) return;

    const stillCurrent = await settleRoundEvaluationVisibility(sessionToken, evaluationVisibleStartedAt);
    if (!stillCurrent) return;

    if (!isDuelMode()) {
      renderSoloRoundOutcome(base, position, evaluation);
      return;
    }

    renderDuelRoundOutcome(base, position, evaluation);
  } catch (error) {
    if (!isCurrentSessionWork(sessionToken)) return;
    hidePositionSearchOverlay();
    hideHandoffOverlay();
    hideResultOverlay();
    restoreBoardToRoundStart();
    if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");
    roundResultEl.textContent = t("analysis.status.roundError", { error: error.message || t("common.unknown") });
    STATE.roundSubmitted = false;
    skipBtn.disabled = false;
    nextBtn.disabled = true;
    setUiPhase("playing", false);
    // The answer was not scored, so the round goes back to how it was. A revealed
    // move is taken back one level (it stays on the screen of the person who saw it
    // and still costs what the second hint cost).
    if (STATE.hint && STATE.hint.level >= 3) {
      STATE.hint.level = 2;
      STATE.hintsUsed = 2;
    }
    startRoundTimer();
    updateHintButton();
  } finally {
    STATE.isResolvingRound = false;
  }
}

// Someone answering before the strong engine has finished loading waits for it
// (the overlay is up, with its carousel), but only as long as the session
// promised: after that the fallback scores the round and the download carries on.
async function waitForEngineToLoad() {
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return;
  const loading = engineLoad;
  if (!loading) return;
  const startedAt = STATE.session ? STATE.session.startedAt : Date.now();
  const remainingMs = Math.max(1500, startedAt + ENGINE_SESSION_WAIT_MS - Date.now());
  await Promise.race([loading, sleepMs(remainingMs)]);
}

// Puts the board back to the position the round started from. The played move
// is shown on the board before the engine runs, so a failed evaluation would
// otherwise leave the screen one move ahead of the position that the next
// attempt is scored against.
function restoreBoardToRoundStart() {
  const position = STATE.positions[STATE.index];
  if (!position) return;
  STATE.board = new Chess(position.fen);
  STATE.userMove = null;
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  setBoardPerspective(STATE.board.turn);
  renderBoard();
}

// Computes per-round config, snapshots the starting position, and resets
// selection/legal-move UI state before a round is evaluated.
function prepareRoundResolutionContext(move, options, duelFirstTurn) {
  const position = STATE.positions[STATE.index];
  const base = new Chess(position.fen);
  const noMove = !move;
  const noMoveReason = noMove ? (options.noMoveReason || "no_move") : "";
  const limitMs = isUntimedSession() ? 0 : Math.max(0, STATE.timer.durationMs);
  const elapsedMs = STATE.roundStartedAt ? Math.max(0, Date.now() - STATE.roundStartedAt) : 0;
  const timeSpentMs = Math.round(limitMs > 0 ? Math.min(elapsedMs, limitMs) : elapsedMs);
  const hintsUsed = clamp(Math.round(Number(STATE.hintsUsed) || 0), 0, 3);

  STATE.userMove = move || null;
  STATE.selection = null;
  STATE.legalMoves = [];
  skipBtn.disabled = true;
  if (hintBtn) hintBtn.disabled = true;
  setUiPhase(duelFirstTurn ? "handoff_wait_eval" : "playing", true);

  return { position, base, noMove, noMoveReason, timeSpentMs, hintsUsed };
}

// Duel mode, player 1's turn: stash their pending move without evaluating it
// yet, and hand the board off to player 2 to play their reply.
function handleDuelFirstTurnHandoff(base, position, move, noMoveReason, extra = {}) {
  STATE.duel.roundResults[0] = {
    pendingMove: move ? { ...move } : null,
    noMoveReason,
    userMove: snapshotMove(move),
    timeSpentMs: extra.timeSpentMs || 0,
    hintsUsed: extra.hintsUsed || 0,
  };
  if (move) playSound("move");
  STATE.board = new Chess(position.fen);
  setBoardPerspective(base.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  renderBoard();
  roundResultEl.innerHTML = "";
  showHandoffOverlay(t("game.handoff.title", { player: duelPlayerName(1) }), t("game.handoff.subtitle"));
  STATE.duel.handoffReady = true;
  setUiPhase("handoff_ready", true);
  nextBtn.textContent = t("buttons.nextPosition");
  nextBtn.disabled = true;
  skipBtn.disabled = true;
  updateHintButton();
  setThinkingMode(false);
  renderSessionProgress();
  updateScoreDisplay();
  setPanelActiveState(1);
  updateRoundTurn(1);
  updateCompetitiveStatus();
  setScoringInfoVisible(false);
}

// Shows the "evaluating" placeholder text and, if the user made a move,
// applies it to the visible board right away (before the engine runs).
function showEvaluatingMoveOnBoard(move, noMove, noMoveReason) {
  roundResultEl.textContent = noMoveReason === "timeout"
    ? t("overlay.timeoutEvaluating")
    : (noMove ? t("overlay.closingWithoutMove") : t("overlay.evaluatingMove"));

  if (move) {
    STATE.board.makeMove(move);
    STATE.revealed = { ...STATE.revealed, user: move };
    renderBoard();
    let sound = "move";
    if (STATE.board.inCheck(STATE.board.turn)) sound = "check";
    else if (move.capture || move.enPassant) sound = "capture";
    playSound(sound);
  }
}

// Builds the answers the engine needs to score for this round: one in solo
// mode, or both players' in duel mode (scored against the same reference, in
// one pass). Each carries what Ludus.Scoring needs besides the move: the hints
// used and how long the person took.
function buildAnswersToEvaluate(move, noMoveReason, extra = {}) {
  const current = { move, noMoveReason, hintsUsed: extra.hintsUsed || 0, timeSpentMs: extra.timeSpentMs || 0 };
  if (!isDuelMode()) return [{ ...current, playerIndex: 0 }];
  const p1Pending = STATE.duel.roundResults[0];
  const p1Move = p1Pending && p1Pending.pendingMove ? { ...p1Pending.pendingMove } : null;
  return [
    {
      move: p1Move,
      noMoveReason: p1Move ? "" : (p1Pending?.noMoveReason || "no_move"),
      hintsUsed: p1Pending?.hintsUsed || 0,
      timeSpentMs: p1Pending?.timeSpentMs || 0,
      playerIndex: 0,
    },
    { ...current, playerIndex: 1 },
  ];
}

// Shows the "searching" overlay with its progress bar before the engine work
// starts; a wait that turns out long gets the curiosity carousel.
function beginRoundEvaluationOverlay(plan) {
  const evaluationTitle = isDuelMode()
    ? t("overlay.evaluatingBoth")
    : t("overlay.evaluatingYours");
  const budgetLabel = `${(plan.totalBudgetMs / 1000).toFixed(1)}s max`;
  showPositionSearchOverlay(
    evaluationTitle,
    t("overlay.difficultyBudget", { label: t(`difficulty.${plan.label}`), budget: budgetLabel }),
    {
      showProgress: true,
      progressRatio: 0,
      progressLabel: t("overlay.progressLabel", {
        pct: 0,
        elapsed: "0.0",
        total: (plan.totalBudgetMs / 1000).toFixed(1),
      }),
      facts: true,
      factsDelayMs: OVERLAY_FACTS_DELAY_MS,
    },
  );
  return Date.now();
}

// After the evaluation: keep the overlay up just long enough not to flash (the
// person still sees that something was evaluated), then take it down. Returns
// false when a newer session has taken over meanwhile.
async function settleRoundEvaluationVisibility(sessionToken, evaluationVisibleStartedAt) {
  if (!isCurrentSessionWork(sessionToken)) return false;
  const evaluationVisibleElapsedMs = Date.now() - evaluationVisibleStartedAt;
  const minVisibleMs = timingOverrides.minEvalVisibleMs !== null ? timingOverrides.minEvalVisibleMs : MIN_ROUND_EVAL_VISIBLE_MS;
  if (evaluationVisibleElapsedMs < minVisibleMs) {
    await sleepMs(minVisibleMs - evaluationVisibleElapsedMs);
  }
  if (!isCurrentSessionWork(sessionToken)) return false;
  hidePositionSearchOverlay();
  setThinkingMode(false);
  return true;
}

// ---------- After the evaluation: the result, the records, the events ----------

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

// A sound for how the round went (Audio honours the settings itself).
function playResultSound(answer) {
  if (!answer) return;
  if (!answer.uci) {
    if (answer.reason === "timeout") playSound("wrong");
    return;
  }
  const quality = answer.assessment.qualityCode;
  if (quality === "brilliant" || quality === "great") playSound("great");
  else if (answer.hit) playSound("correct");
  else if (answer.assessment.accuracy < 40) playSound("wrong");
}

function positionSourceOf(position) {
  if (["own", "classic", "notebook", "daily"].includes(position.source)) return position.source;
  const kind = STATE.session ? STATE.session.kind : "own";
  if (kind === "review") return "notebook";
  return ["classic", "daily"].includes(kind) ? kind : "own";
}

// The profile a player's rounds are recorded for: the person at the device in
// solo, the linked profile of each player in a duel (null for a guest, whom
// Profile does not record).
function sessionProfileId(playerIndex) {
  const ids = STATE.session && Array.isArray(STATE.session.profileIds) ? STATE.session.profileIds : [];
  return (isDuelMode() ? ids[playerIndex === 1 ? 1 : 0] : ids[0]) || null;
}

function activeProfileId() {
  const profile = ludusModule("Profile");
  try {
    const active = profile && typeof profile.active === "function" ? profile.active() : null;
    return active && active.id ? active.id : null;
  } catch (error) {
    return null;
  }
}

function insightTexts(insights) {
  const insightsApi = ludusModule("Insights");
  try {
    return insightsApi && insights && Array.isArray(insights.messages) ? insightsApi.renderMessages(insights.messages, STATE.language) : [];
  } catch (error) {
    return [];
  }
}

// Everything the result panel needs, kept on STATE.resultView.context so a
// coach panel can draw it without computing anything again: the full
// assessment(s), the lines (SAN, with their evaluation), the insight messages,
// the move of the game, and the curiosity of the round.
function buildRoundContext(kind, position, evaluation) {
  const answers = evaluation.answers.map((answer) => ({
    playerIndex: answer.playerIndex,
    name: isDuelMode() ? duelPlayerName(answer.playerIndex) : "",
    uci: answer.uci,
    san: answer.san,
    move: snapshotMove(answer.move),
    noMoveReason: answer.noMoveReason,
    reason: answer.reason,
    hintsUsed: answer.hintsUsed,
    timeSpentMs: answer.timeSpentMs,
    provisional: answer.provisional,
    hit: answer.hit,
    isSacrifice: answer.isSacrifice,
    userScore: answer.userScore,
    assessment: answer.assessment,
    insights: {
      tags: answer.insights.tags || [],
      messages: answer.insights.messages || [],
      conceptIds: answer.insights.conceptIds || [],
      phase: answer.insights.phase || null,
      verdict: answer.insights.verdict || "unknown",
      texts: insightTexts(answer.insights),
    },
  }));
  const primary = answers[answers.length - 1];
  return {
    kind,
    round: STATE.index + 1,
    positionId: position.id || "",
    fen: position.fen,
    source: positionSourceOf(position),
    best: { uci: evaluation.bestUci, san: evaluation.bestSan, score: evaluation.bestScore, evalText: evaluation.bestEvalText },
    master: evaluation.master,
    lines: evaluation.linesView,
    answers,
    assessment: primary.assessment,
    assessments: answers.map((entry) => entry.assessment),
    insights: primary.insights,
    fact: pickCuriosity(),
    engine: { source: evaluation.source, origin: evaluation.origin, depth: evaluation.depth, movetimeMs: evaluation.plan.movetimeMs },
    hintsUsed: primary.hintsUsed,
    points: primary.assessment.points,
    maxPoints: primary.assessment.maxPoints,
    session: STATE.session ? { id: STATE.session.id, kind: STATE.session.kind, title: STATE.session.title } : null,
  };
}

// The RoundRecord of section 9 of docs/ARCHITECTURE.md.
function buildRoundRecord(position, base, evaluation, answer) {
  const session = STATE.session;
  const assessment = answer.assessment;
  const source = positionSourceOf(position);
  const meta = position.meta && typeof position.meta === "object" ? position.meta : {};
  const trusted = evaluation.trustedLines;
  const record = {
    id: Ludus.util.uid("r_"),
    ts: Date.now(),
    profileId: sessionProfileId(answer.playerIndex),
    sessionId: session ? session.id : "",
    sessionKind: session ? session.kind : "own",
    source,
    positionId: position.id || `${source}:${Ludus.util.hashString(position.fen)}`,
    fen: position.fen,
    sideToMove: base.turn,
    phase: (answer.insights && answer.insights.phase) || position.phase || getGamePhase(base),
    userUci: answer.uci,
    userSan: answer.san || "",
    bestUci: trusted ? evaluation.bestUci : null,
    bestSan: trusted ? evaluation.bestSan : "",
    points: assessment.points,
    accuracy: assessment.accuracy,
    qualityCode: assessment.qualityCode,
    winLossPct: assessment.winLossPct,
    cpLoss: assessment.cpLoss,
    isBest: assessment.isBest,
    rank: assessment.rank,
    onlyMove: assessment.onlyMove,
    timeSpentMs: answer.timeSpentMs,
    hintsUsed: answer.hintsUsed,
    timedOut: answer.reason === "timeout",
    tags: answer.insights && Array.isArray(answer.insights.tags) ? answer.insights.tags.slice(0, 12) : [],
    lines: trusted ? compactLines(position.fen, evaluation.lines) : [],
    meta: {
      players: meta.players,
      event: meta.event,
      year: meta.year,
      site: meta.site,
      eco: meta.eco,
      result: meta.result,
      moveNumber: meta.moveNumber,
      sideToMove: base.turn,
    },
  };
  if (evaluation.master) {
    record.masterUci = evaluation.master.uci;
    record.masterSan = evaluation.master.san;
  }
  // A notebook position is graded by Profile itself when it records a round of
  // source "notebook" (the card is the position): nothing else to call.
  if (position.cardId) record.cardId = position.cardId;
  return record;
}

function profileLevelNumber(profileId) {
  if (!profileId) return 0;
  const profile = ludusModule("Profile");
  try {
    const stats = profile && typeof profile.stats === "function" ? profile.stats(profileId) : null;
    return stats && stats.level ? Number(stats.level.level) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function celebrateLevelUp(profileId) {
  const profile = ludusModule("Profile");
  let title = "";
  try {
    const stats = profile && typeof profile.stats === "function" ? profile.stats(profileId) : null;
    title = stats && stats.level && stats.level.title ? stats.level.title : "";
  } catch (error) {
    title = "";
  }
  showToast(t("core.toast.levelUp", { title }), { kind: "levelup" });
  playSound("levelup", { delay: 0.3 });
}

// Announces a round on the bus (Profile.attach records it) and notices a level
// up: the result of recordRound is not returned through the bus, so the level
// is compared before and after.
function emitRoundCompleted(record) {
  const levelBefore = profileLevelNumber(record.profileId);
  busEmit("round:completed", { round: record });
  const levelAfter = profileLevelNumber(record.profileId);
  if (levelBefore > 0 && levelAfter > levelBefore) celebrateLevelUp(record.profileId);
}

// A daily challenge position: finishing the round completes the day.
function completeDailyChallenge(dailyKey, accuracy, profileId) {
  const profile = ludusModule("Profile");
  try {
    if (!profile || !profile.daily || typeof profile.daily.complete !== "function") return;
    const result = profile.daily.complete(dailyKey, accuracy, profileId || undefined);
    if (result && result.levelUp) celebrateLevelUp(profileId);
  } catch (error) {
    console.error("[Ludus] the daily challenge could not be completed", error);
  }
}

function recordRoundOutcome(position, base, evaluation) {
  evaluation.answers.forEach((answer) => {
    let record = null;
    try {
      record = buildRoundRecord(position, base, evaluation, answer);
    } catch (error) {
      console.error("[Ludus] the round record could not be built", error);
      return;
    }
    if (STATE.session) {
      STATE.session.records.push({
        playerIndex: answer.playerIndex,
        points: record.points,
        accuracy: record.accuracy,
        qualityCode: record.qualityCode,
        isBest: record.isBest,
        roundId: record.id,
      });
    }
    emitRoundCompleted(record);
    if (position.dailyKey && !isDuelMode()) completeDailyChallenge(position.dailyKey, record.accuracy, record.profileId);
  });
}

// Solo mode: renders the result board/feedback table, updates the score and
// history, and leaves the UI ready for the next position.
function renderSoloRoundOutcome(base, position, evaluation) {
  const answer = evaluation.answers[0];
  const assessment = answer.assessment;
  STATE.board = new Chess(position.fen);
  setBoardPerspective(base.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  // Someone who was shown the move (the last hint) sees its arrow again.
  STATE.revealed = {
    best: answer.hintsUsed >= 3 ? snapshotMove(evaluation.best) : null,
    game: null,
    user: answer.move || null,
    userAlt: null,
  };
  captureResultSnapshot(position.fen);
  renderBoard();
  STATE.resultView.context = buildRoundContext("round_solo", position, evaluation);
  renderSoloResultPanels(STATE.resultView.context);
  setUiPhase("result", true);
  STATE.score = roundScore(STATE.score + assessment.points);
  STATE.sessionPlayed += 1;
  if (answer.hit) STATE.sessionHits += 1;
  pushHistoryEntry({
    round: STATE.index + 1,
    mode: "solo",
    fen: position.fen,
    meta: position.meta,
    bestSan: evaluation.bestSan,
    gameSan: evaluation.master ? evaluation.master.san : (position.gameMoveSan || "-"),
    userSan: answer.san || "",
    bestMove: snapshotMove(evaluation.best),
    gameMove: snapshotMove(evaluation.game),
    userMove: snapshotMove(answer.move),
  });
  nextBtn.textContent = t("buttons.nextPosition");
  nextBtn.disabled = false;
  skipBtn.disabled = true;
  if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  setScoringInfoVisible(true);
  updateHintButton();
  playResultSound(answer);
  recordRoundOutcome(position, base, evaluation);
}

// Duel mode: builds both players' results, updates duel scores/hits, renders
// the comparison feedback table, and leaves the UI ready for the next position.
function renderDuelRoundOutcome(base, position, evaluation) {
  const [first, second] = evaluation.answers;
  const r1 = { points: first.assessment.points, hit: first.hit, userMove: snapshotMove(first.move) };
  const r2 = { points: second.assessment.points, hit: second.hit, userMove: snapshotMove(second.move) };
  STATE.duel.roundResults = [r1, r2];
  STATE.duel.scores[0] = roundScore(STATE.duel.scores[0] + (r1.points || 0));
  STATE.duel.scores[1] = roundScore(STATE.duel.scores[1] + (r2.points || 0));
  if (r1.hit) STATE.duel.hits[0] += 1;
  if (r2.hit) STATE.duel.hits[1] += 1;

  STATE.board = new Chess(position.fen);
  setBoardPerspective(base.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.revealed = {
    best: null,
    game: null,
    user: second.move || null,
    userAlt: r1.userMove || null,
  };
  captureResultSnapshot(position.fen);
  renderBoard();
  hideHandoffOverlay();
  STATE.resultView.context = buildRoundContext("round_duel", position, evaluation);
  renderDuelResultPanels(STATE.resultView.context);
  if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");
  STATE.sessionPlayed += 1;
  pushHistoryEntry({
    round: STATE.index + 1,
    mode: "duel",
    fen: position.fen,
    meta: position.meta,
    bestSan: evaluation.bestSan,
    gameSan: evaluation.master ? evaluation.master.san : (position.gameMoveSan || "-"),
    bestMove: snapshotMove(evaluation.best),
    gameMove: snapshotMove(evaluation.game),
    player1Name: duelPlayerName(0),
    player2Name: duelPlayerName(1),
    player1San: first.san,
    player2San: second.san,
    player1Move: r1.userMove,
    player2Move: r2.userMove,
  });
  nextBtn.textContent = t("buttons.nextPosition");
  nextBtn.disabled = false;
  skipBtn.disabled = true;
  STATE.duel.handoffReady = false;
  setUiPhase("result", true);
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  setScoringInfoVisible(true);
  updateHintButton();
  playResultSound(r1.points >= r2.points ? first : second);
  recordRoundOutcome(position, base, evaluation);
}

// The end of a session: builds its record, announces it ("session:completed") and
// shows the closing summary in place of the round result.
function showSessionSummary({ noMorePositions = false } = {}) {
  const record = finishSession();
  if (roundResultEl) roundResultEl.classList.add("hidden");
  if (resultAnalysisBtn) resultAnalysisBtn.classList.add("hidden");
  if (nextBtn) nextBtn.classList.add("hidden");

  if (sessionSummaryResultEl) sessionSummaryResultEl.classList.remove("hidden");
  STATE.resultView.context = { kind: "session_summary", noMorePositions, session: record };
  if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = sessionSummaryScoreText();
  if (summaryDetailsTextEl) {
    summaryDetailsTextEl.textContent = finalSessionSummaryText() + (noMorePositions ? ` ${t("game.noMorePositions")}` : "");
  }
  if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");

  roundStatusEl.textContent = t("game.sessionDone");
  skipBtn.disabled = true;
  stopRoundTimer();
  setThinkingMode(false);
  updateCompetitiveStatus();
  setScoringInfoVisible(true);
  setUiPhase("result", true);
  updateHintButton();

  // Show only the summary card overlay
  revealResultOverlay();
  if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
  updateRoundTimerUi(0);
  renderBoardArrows();
}

// The SessionRecord of section 9 (docs/ARCHITECTURE.md), emitted once. In a duel
// the totals count both players and `duel` carries each player's score and
// linked profile (Profile stores the session for every linked profile).
function finishSession() {
  const session = STATE.session;
  if (!session) return null;
  if (session.completed) return session.record || null;
  session.completed = true;
  const scoring = ludusModule("Scoring");
  const summary = scoring
    ? scoring.summarize(session.records.map((entry) => ({
      points: entry.points,
      maxPoints: POINTS_PER_POSITION,
      accuracy: entry.accuracy,
      qualityCode: entry.qualityCode,
      isBest: entry.isBest,
    })))
    : { points: STATE.score, maxPoints: session.records.length * POINTS_PER_POSITION, avgAccuracy: 0, byQuality: {} };
  const byQuality = {};
  Object.keys(summary.byQuality || {}).forEach((code) => {
    if (summary.byQuality[code] > 0) byQuality[code] = summary.byQuality[code];
  });
  const record = {
    id: session.id,
    ts: Date.now(),
    profileId: session.mode === "duel" ? null : (session.profileIds[0] || null),
    kind: session.kind,
    title: session.title,
    mode: session.mode,
    positions: STATE.sessionPlayed,
    points: summary.points,
    maxPoints: summary.maxPoints,
    avgAccuracy: summary.avgAccuracy,
    durationMs: Math.min(Math.max(0, Date.now() - session.startedAt), 86400000),
    byQuality,
    roundIds: session.records.map((entry) => entry.roundId),
  };
  if (session.mode === "duel") {
    record.duel = {
      names: [duelPlayerName(0), duelPlayerName(1)],
      scores: [STATE.duel.scores[0], STATE.duel.scores[1]],
      profileIds: [session.profileIds[0] || null, session.profileIds[1] || null],
    };
  }
  session.record = record;
  busEmit("session:completed", { session: record });
  return record;
}

async function nextPosition() {
  if (STATE.ui.phase !== "result" && STATE.ui.phase !== "result_analysis") return;
  if (STATE.resultView.analysisMode) {
    applyResultSnapshotToBoard();
    STATE.resultView.analysisMode = false;
    updateResultAnalysisControls();
  }
  const resultSnapshot = captureResultViewSnapshot();
  hideResultOverlay();

  if (isDuelMode()) {
    STATE.duel.currentPlayer = 0;
    STATE.duel.handoffReady = false;
    STATE.duel.roundResults = [null, null];
  }
  setUiPhase("playing", false);

  if (STATE.index >= Math.max(1, STATE.targetPositions) - 1) {
    showSessionSummary({ noMorePositions: false });
    return;
  }

  if (STATE.index >= STATE.positions.length - 1) {
    const ctx = STATE.analysisContext;
    if (!ctx) {
      // A fixed list of positions (classics, review, daily): this was the last one.
      showSessionSummary({ noMorePositions: false });
      return;
    }

    nextBtn.disabled = true;
    skipBtn.disabled = true;
    // Do not show a duplicate loading message on the top bar
    roundStatusEl.textContent = "";
    showPositionSearchOverlay(t("overlay.searchingNext"), "", { cancellable: true, facts: true });
    setUiPhase("loading_next_position", true);
    const sessionToken = STATE.sessionToken;
    const search = await findNextMistake(ctx, "Siguiente: ");
    if (!isCurrentSessionWork(sessionToken)) return;
    if (search.status === "cancelled") {
      hidePositionSearchOverlay();
      restoreResultView(resultSnapshot);
      return;
    }
    const nextMistake = search.mistake;
    if (!nextMistake) {
      hidePositionSearchOverlay();
      showSessionSummary({ noMorePositions: true });
      return;
    }
    showPositionSearchOverlay(t("game.positionFound"), formatPositionSearchMeta(nextMistake));
    await sleepMs(1200);
    // The session can be restarted during this pause. Without this check the
    // finished search would open a round on top of the screen that was just
    // reset, with a clock and a score belonging to a session that is gone.
    if (!isCurrentSessionWork(sessionToken)) return;
    hidePositionSearchOverlay();
    STATE.positions.push(nextMistake);
    STATE.allMistakes.push(nextMistake);
    STATE.index += 1;
    startRound();
    return;
  }
  STATE.index += 1;
  startRound();
}

function revealDuelSecondTurn() {
  if (!isDuelMode()) return;
  if (STATE.ui.phase !== "handoff_ready") return;
  if (STATE.duel.currentPlayer !== 0) return;
  if (!STATE.duel.roundResults[0]) return;
  STATE.duel.currentPlayer = 1;
  STATE.duel.handoffReady = false;
  hideHandoffOverlay();
  startRound({ preserveDuelRoundResults: true });
}

// Clears everything a session left on the page: the round, the clock, the
// overlays, the summary, the hints. It does not route anywhere.
function resetGameSurface() {
  stopRoundTimer();
  setThinkingMode(false);
  setScoringInfoVisible(false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  closePromotionPicker({ skipFocusReturn: true });
  hideResultOverlay();

  if (resultOverlayInnerEl) resultOverlayInnerEl.classList.remove("hidden"); // Restore normal layout exactly
  if (sessionSummaryResultEl) sessionSummaryResultEl.classList.add("hidden");
  if (summaryMenuBtn) summaryMenuBtn.classList.add("hidden");
  if (roundResultEl) roundResultEl.classList.remove("hidden");
  if (resultAnalysisBtn) resultAnalysisBtn.classList.remove("hidden");
  // The summary hides this button; without showing it again the next session
  // would have no way to move on from a result.
  if (nextBtn) nextBtn.classList.remove("hidden");

  setUiPhase("playing", false);
  STATE.positions = [];
  STATE.allMistakes = [];
  STATE.index = 0;
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.board = null;
  STATE.roundSubmitted = false;
  STATE.isResolvingRound = false;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  STATE.analysisContext = null;
  STATE.historyEntries = [];
  STATE.historySelectedIdx = -1;
  if (revealBestBtn) revealBestBtn.classList.remove("revealed-state");
  if (revealGameBtn) revealGameBtn.classList.remove("revealed-state");
  STATE.score = 0;
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  resetHintState();
  resetDuelState();
  renderHistoryList();
  renderSessionTitle();
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  updateHintButton();
  if (roundResultPanelEl) roundResultPanelEl.classList.add("hidden");
  if (roundResultEl) roundResultEl.innerHTML = "";
  if (skipBtn) skipBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
}

// Ends whatever is going on, without recording it as a completed session: the
// round timer, the engine work, downloads in flight, overlays, and the session
// itself. Rounds already played were recorded as they were played. The strong
// engine is dropped too (it is loaded again when someone is about to play)
// unless a new session is about to start, which will need it.
function abortSessionInternal({ keepEngine = false } = {}) {
  beginSessionWork();
  abortEngineWork();
  if (!keepEngine) resetEngineToLocal();
  STATE.session = null;
  STATE.ui.setupAnalyzing = false;
  STATE.ui.searchCancelRequested = true;
  stopWizardFacts();
  setWizardFormControlsDisabled(false);
  resetGameSurface();
  STATE.scoringOverride = null;
  if (analysisProgressWrapEl) analysisProgressWrapEl.classList.add("hidden");
}

// The wizard was left while it was still searching (the router hides "setup"):
// the download and the search stop, nothing is left running behind the next screen.
function cancelSetupWork() {
  if (!STATE.ui.setupAnalyzing && !STATE.analysisInProgress) return;
  beginSessionWork();
  abortEngineWork();
  STATE.ui.searchCancelRequested = true;
  STATE.ui.setupAnalyzing = false;
  stopWizardFacts();
  setWizardFormControlsDisabled(false);
  resetAnalysisProgress();
  if (analysisProgressWrapEl) analysisProgressWrapEl.classList.add("hidden");
  if (analysisStatusEl) analysisStatusEl.textContent = t("wizard.status.currentStep");
  updateAnalyzeButtonState();
}

// "Volver al inicio": drops the session (and its engine), gets the wizard ready
// for the next one and goes home.
function restartToSetup() {
  abortSessionInternal();
  if (analysisStatusEl) analysisStatusEl.textContent = t("wizard.status.currentStep");
  if (playerNameDetectedEl) playerNameDetectedEl.textContent = t("players.enterUserContinue");
  resetAnalysisProgress();
  resetSetupWizard({
    mode: "solo",
    statusMessage: t("wizard.status.nextSession"),
  });
  updatePgnSelectionUi();
  buildBoard();
  renderBoard();
  goHome();
}

function hasActiveSessionProgress() {
  return STATE.ui.setupAnalyzing
    || STATE.isResolvingRound
    || STATE.positions.length > 0
    || STATE.sessionPlayed > 0
    || STATE.sessionHits > 0
    || STATE.duel.roundResults.some(Boolean);
}

async function confirmRestartToSetup() {
  if (!hasActiveSessionProgress()) return true;
  return showConfirmModal({
    title: t("confirm.restartTitle"),
    body: t("confirm.restartToSetup"),
    acceptLabel: t("confirm.restartAccept"),
    cancelLabel: t("confirm.restartCancel"),
  });
}

// ---------- Sessions (Ludus.game) ----------
// A session is a list of positions played one after the other, by one person or
// by two on the same device. Fixed lists (classics, review, daily) go through
// startSession(); the person's own games keep their lazy pipeline (wizard ->
// download -> search) and join the same lifecycle when the first position is
// found (enterPlayModeWithFirstPosition). Both announce themselves on the bus:
// "session:started" {session}, "round:completed" {round} per answer and
// "session:completed" {session} (see docs/ARCHITECTURE.md section 9).

const SESSION_KINDS = ["own", "classic", "review", "daily"];

function defaultSessionTitle(kind) {
  return t(`core.session.default.${kind}`);
}

// The positions a session is played with: a copy of each, with what the round
// needs filled in (an id, a source, meta). Anything that is not a playable
// position (no FEN, an illegal FEN, no legal move) is left out.
function normalizeSessionPositions(list, kind) {
  const fallbackSource = kind === "review" ? "notebook" : (["classic", "daily"].includes(kind) ? kind : "own");
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw) => {
    if (!raw || typeof raw !== "object" || typeof raw.fen !== "string") return;
    let board = null;
    try {
      board = new Chess(raw.fen.trim());
    } catch (error) {
      return;
    }
    if (!board || board.generateMoves().length === 0) return;
    const position = { ...raw, fen: raw.fen.trim() };
    if (!["own", "classic", "notebook", "daily"].includes(position.source)) position.source = fallbackSource;
    position.id = raw.id ? String(raw.id) : `${position.source}:${Ludus.util.hashString(position.fen)}`;
    position.meta = raw.meta && typeof raw.meta === "object" ? { ...raw.meta } : {};
    if (!position.meta.sideToMove) position.meta.sideToMove = board.turn;
    out.push(position);
  });
  return out;
}

function publicSessionInfo(session) {
  if (!session) return null;
  return {
    id: session.id,
    kind: session.kind,
    title: session.title,
    mode: session.mode,
    names: session.names ? session.names.slice() : null,
    profileIds: session.profileIds.slice(),
    startedAt: session.startedAt,
    positions: session.positions,
    options: { ...session.options },
  };
}

// What the session plays with, from the settings unless the screen that starts
// it says otherwise (options: { clock, hints, scoring }).
function applySessionOptions(options) {
  const opts = options && typeof options === "object" ? options : {};
  const clock = opts.clock && typeof opts.clock === "object" ? opts.clock : {};
  const clockMode = clock.mode === "untimed" || clock.mode === "timed" ? clock.mode : settingsGet("clock.mode", "timed");
  STATE.clockMode = clockMode === "untimed" ? "untimed" : "timed";
  STATE.turnTimeSeconds = normalizeTurnTimeSeconds(clock.seconds != null ? clock.seconds : settingsGet("clock.seconds", DEFAULT_TURN_TIME_SECONDS));
  STATE.hintsEnabled = typeof opts.hints === "boolean" ? opts.hints : Boolean(settingsGet("hints.enabled", true));
  STATE.scoringOverride = null;
  const scoring = ludusModule("Scoring");
  if (opts.scoring && typeof opts.scoring === "object" && scoring) {
    STATE.scoringOverride = scoring.normalizeSettings({ ...sessionScoringSettings(), ...opts.scoring });
  }
}

// Ludus.game.startSession({ kind, title, mode, names, profileIds, positions, options })
// -> Promise<void>, resolved once the first round is on screen. The session is
// the given list, in order (its length is the session's length); the engine
// starts loading in the background, because someone is about to play.
async function startSession(config = {}) {
  const cfg = config && typeof config === "object" ? config : {};
  const kind = SESSION_KINDS.includes(cfg.kind) ? cfg.kind : "classic";
  const positions = normalizeSessionPositions(cfg.positions, kind);
  if (!positions.length) throw new Error("Ludus.game.startSession: there are no playable positions");
  const mode = cfg.mode === "duel" ? "duel" : "solo";
  const names = mode === "duel"
    ? [0, 1].map((index) => sanitizePlayerName(Array.isArray(cfg.names) ? cfg.names[index] : "", defaultDuelPlayerName(index)).slice(0, 20))
    : null;
  const profileIds = mode === "duel"
    ? [0, 1].map((index) => (Array.isArray(cfg.profileIds) && typeof cfg.profileIds[index] === "string" ? cfg.profileIds[index] : null))
    : [Array.isArray(cfg.profileIds) && typeof cfg.profileIds[0] === "string" ? cfg.profileIds[0] : activeProfileId()];

  // Whatever was going on ends here; the engine, if it is up, is kept for this one.
  abortSessionInternal({ keepEngine: true });
  STATE.ui.searchCancelRequested = false;
  beginSessionWork();

  applyGameFormat(mode);
  if (names) STATE.duel.players = names;
  resetDuelState();
  applySessionOptions(cfg.options);
  STATE.positions = positions;
  STATE.targetPositions = positions.length;
  STATE.index = 0;
  STATE.score = 0;
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  STATE.analysisContext = null;
  STATE.session = {
    id: Ludus.util.uid("s_"),
    kind,
    title: String(cfg.title || "").trim().slice(0, 80) || defaultSessionTitle(kind),
    mode,
    names,
    profileIds,
    options: cfg.options && typeof cfg.options === "object" ? { ...cfg.options } : {},
    startedAt: Date.now(),
    positions: positions.length,
    completed: false,
    records: [],
    record: null,
  };
  renderHistoryList();
  updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
  const session = STATE.session;
  // The engine loads while the first round is played; when it is up, the analysis
  // that scoring needs (and a better hint) starts on the position still on screen.
  void ensureStockfishLoading().then((ready) => {
    if (!ready || STATE.session !== session || STATE.roundSubmitted || !session || session.completed) return;
    prefetchRoundReference(STATE.positions[STATE.index]);
    updateHintButton();
  });
  routerShow("game");
  startRound();
  busEmit("session:started", { session: publicSessionInfo(STATE.session) });
}

function isSessionActive() {
  return Boolean(STATE.session && !STATE.session.completed);
}

// Ludus.game.abort(): stops the round timer, the engine work, downloads and
// overlays, forgets the session (no "session:completed": what was played was
// already recorded round by round) and goes back to the home screen.
function abortSession() {
  abortSessionInternal();
  goHome();
}

// Leaving while something is in progress asks first (what the confirm dialog of
// "Volver al inicio" says). Resolves to true when the session was left.
async function leaveSession() {
  if (!(await confirmRestartToSetup())) return false;
  restartToSetup();
  return true;
}


function refreshLocalizedUi() {
  applyStaticTranslations();
  updateOnlineProviderUi();
  syncLocalizedPlayerDefaults();
  updateScoringSystemHint();
  updateResultAnalysisControls();
  updateScoreDisplay();
  updateCompetitiveStatus();
  renderSessionProgress();
  renderSessionTitle();
  updateHintButton();
  updateRoundTimerUi();
  renderHistoryList();
  updatePgnSelectionUi();
  if (STATE.setupWizard.sourceError?.key) {
    showWizardSourceError(STATE.setupWizard.sourceError.key, STATE.setupWizard.sourceError.params || {});
  } else if (STATE.setupWizard.step === 2) {
    const validation = validateWizardStep(2);
    if (!validation.valid && wizardSourceErrorEl && !wizardSourceErrorEl.classList.contains("hidden")) {
      wizardSourceErrorEl.textContent = validation.reason;
    }
  } else if (STATE.setupWizard.sourceError?.raw && wizardSourceErrorEl) {
    wizardSourceErrorEl.textContent = STATE.setupWizard.sourceError.raw;
    wizardSourceErrorEl.classList.remove("hidden");
    if (wizardSourceCtaEl) wizardSourceCtaEl.classList.remove("hidden");
  }

  if (STATE.positions[STATE.index]) {
    renderGameInfo(STATE.positions[STATE.index]);
  }
  if (STATE.board) renderBoard();

  if (STATE.historySelectedIdx >= 0 && STATE.historyEntries[STATE.historySelectedIdx]) {
    renderHistoryPreview(STATE.historyEntries[STATE.historySelectedIdx]);
  }

  if (STATE.resultView.visible && STATE.resultView.context && !STATE.resultView.analysisMode) {
    renderResultViewContext();
  }

  if (handoffOverlayEl && !handoffOverlayEl.classList.contains("hidden") && isDuelMode() && STATE.duel.currentPlayer === 0) {
    showHandoffOverlay(t("game.handoff.title", { player: duelPlayerName(1) }), t("game.handoff.subtitle"));
  }

  if (positionSearchOverlayEl && !positionSearchOverlayEl.classList.contains("hidden") && STATE.ui.positionSearchState) {
    const overlayState = STATE.ui.positionSearchState;
    const isFoundTitle = SUPPORTED_LANGUAGES.some((language) => rawTranslation("game.positionFound", language) === overlayState.title);
    const isSearchTitle = SUPPORTED_LANGUAGES.some((language) => rawTranslation("overlay.searchingNext", language) === overlayState.title)
      || SUPPORTED_LANGUAGES.some((language) => rawTranslation("game.searchingNext", language) === overlayState.title);
    const translatedTitle = overlayState.showProgress
      ? (isDuelMode() ? t("overlay.evaluatingBoth") : t("overlay.evaluatingYours"))
      : (STATE.ui.phase === "loading_next_position" || isSearchTitle
        ? t("overlay.searchingNext")
        : (isFoundTitle ? t("game.positionFound") : overlayState.title));
    showPositionSearchOverlay(translatedTitle, overlayState.meta, {
      showProgress: overlayState.showProgress,
      progressRatio: overlayState.progressRatio,
      progressLabel: overlayState.progressLabel,
      cancellable: overlayState.cancellable,
      // The carousel already on screen keeps running (it follows the language itself).
      facts: overlayState.facts,
      factsDelayMs: overlayState.factsDelayMs,
    });
  }

  if (!document.body.classList.contains("playing-mode")) {
    const readiness = validateWizardStep(STATE.setupWizard.step);
    if (analysisStatusEl && !STATE.ui.setupAnalyzing) {
      const readyMessage = STATE.setupWizard.step === 3 ? t("wizard.step3.analysisPrompt") : t("wizard.status.currentStep");
      analysisStatusEl.textContent = readiness.valid ? readyMessage : readiness.reason;
    }
  }
}

// The best move of the round on screen: what the result was scored against
// (the analysis), else what the position itself knows.
function resultBestMove(position) {
  const context = STATE.resultView.context;
  if (context && context.best && context.best.uci) return { uci: context.best.uci, san: context.best.san };
  const uci = lineFirstUci(referenceLinesOf(position)[0]) || String(position.bestMoveUci || "");
  return uci ? { uci, san: position.bestMoveSan || "-" } : null;
}

function revealSpecificMove(type) {
  if (!STATE.revealed) STATE.revealed = {};
  const p = STATE.positions[STATE.index];
  if (!p) return;

  if (type === "best") {
    if (revealBestBtn.classList.contains("revealed-state")) {
      revealBestBtn.classList.remove("revealed-state");
      revealBestBtn.textContent = t("buttons.revealBest");
      STATE.revealed.best = null;
    } else {
      const best = resultBestMove(p);
      if (!best) return;
      const from = Chess.squareToIndex(best.uci.substring(0, 2));
      const to = Chess.squareToIndex(best.uci.substring(2, 4));
      const prom = best.uci.length > 4 ? best.uci[4] : undefined;
      STATE.revealed.best = { from, to, promotion: prom };
      if (revealBestBtn) {
        revealBestBtn.textContent = t("evaluation.bestPrefix", { san: best.san || "-" });
        revealBestBtn.classList.add("revealed-state");
      }
    }
  } else if (type === "game") {
    if (revealGameBtn.classList.contains("revealed-state")) {
      revealGameBtn.classList.remove("revealed-state");
      revealGameBtn.textContent = revealGameButtonLabel();
      STATE.revealed.game = null;
    } else {
      if (!p.gameMoveUci) return;
      const from = Chess.squareToIndex(p.gameMoveUci.substring(0, 2));
      const to = Chess.squareToIndex(p.gameMoveUci.substring(2, 4));
      const prom = p.gameMoveUci.length > 4 ? p.gameMoveUci[4] : undefined;
      STATE.revealed.game = { from, to, promotion: prom };
      if (revealGameBtn) {
        revealGameBtn.textContent = t("evaluation.gamePrefix", { san: p.gameMoveSan || "-" });
        revealGameBtn.classList.add("revealed-state");
      }
    }
  }

  renderBoard();
}

async function getActivePgnTextSources() {
  if (!hasAnyPgnSource(true)) return [];
  return STATE.remotePgnSources.map((entry) => ({
    name: entry.name,
    text: entry.text,
    username: entry.username || "",
  }));
}

async function fetchLichessPgn() {
  const rawUser = getConfiguredRemoteUsername();
  if (!rawUser) {
    if (onlineStatusEl) onlineStatusEl.textContent = t("provider.enterLichessUser");
    showWizardSourceError("provider.enterLichessContinue", {}, "username");
    return false;
  }

  const settings = getLichessFetchSettings();
  const nowMs = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const sinceMs = nowMs - oneYearMs;
  const preferredLabel = joinPreferredTimeClasses(settings.preferredPerf);
  const cacheKey = remotePgnCacheKey("lichess", rawUser, cacheSignature({
    provider: "lichess",
    maxGames: settings.maxGames,
    preferredPerf: settings.preferredPerf,
    minSlowGames: settings.minSlowGames,
    fallbackBlitz: settings.fallbackBlitz,
    fallbackBullet: settings.fallbackBullet,
  }));

  const cached = await readCachedRemotePgn(cacheKey);
  if (cached) {
    return installRemotePgnSource(cached.source, { messageKey: "provider.usingCachedBase" });
  }

  const lichessThrottle = remoteFetchThrottleBlock();
  if (lichessThrottle) {
    if (onlineStatusEl) onlineStatusEl.textContent = t(lichessThrottle.key, lichessThrottle.params);
    showWizardSourceError(lichessThrottle.key, lichessThrottle.params);
    return false;
  }

  if (!(await confirmRemoteFetchConsent("lichess", rawUser))) {
    if (onlineStatusEl) onlineStatusEl.textContent = t("privacy.remoteFetchCancelled");
    showWizardSourceError("privacy.remoteFetchCancelled");
    return false;
  }

  recordRemoteFetch();

  if (onlineStatusEl) {
    if (STATE.userMode === "citizen") {
      onlineStatusEl.textContent = t("provider.downloadingFor", { user: rawUser, protocol: describeLichessNormalProtocol(settings) });
    } else {
      onlineStatusEl.textContent = t("provider.searchingUpTo", { max: settings.maxGames, user: rawUser, preferred: preferredLabel });
    }
  }

  const fetchChunk = async (perfTypes, max) => {
    const params = new URLSearchParams();
    params.set("max", String(max));
    params.set("since", String(sinceMs));
    params.set("perfType", perfTypes.join(","));
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(rawUser)}?${params.toString()}`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Accept: "application/x-chess-pgn" },
      timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
      retries: REMOTE_FETCH_RETRIES,
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error(t("network.rateLimited"));
      throw new Error(t("provider.lichessResponse", { status: response.status }));
    }
    const text = await readResponseTextWithLimit(response);
    return { text, games: countPgnGames(text) };
  };

  try {
    const slow = await fetchChunk(settings.preferredPerf, settings.maxGames);
    let finalText = slow.text;
    let totalGames = slow.games;
    let blitzGames = 0;
    let bulletGames = 0;
    let qualityWarning = "";

    if (settings.fallbackBlitz && totalGames < settings.minSlowGames && totalGames < settings.maxGames) {
      const remaining = settings.maxGames - totalGames;
      if (onlineStatusEl) {
        onlineStatusEl.textContent = t("provider.completingBlitz", { count: totalGames, preferred: preferredLabel, remaining });
      }
      await sleepMs(220);
      const blitz = await fetchChunk(["blitz"], remaining);
      blitzGames = blitz.games;
      totalGames += blitzGames;
      if (blitz.text && blitz.text.trim()) {
        finalText = finalText && finalText.trim() ? `${finalText.trim()}\n\n${blitz.text.trim()}\n` : blitz.text;
      }
    }

    if (settings.fallbackBullet && totalGames < settings.minSlowGames && totalGames < settings.maxGames) {
      const remaining = settings.maxGames - totalGames;
      const warningContext = blitzGames > 0
        ? t("provider.bulletContextStillShort", { user: rawUser, preferred: preferredLabel })
        : t("provider.bulletContextNoBlitz", { user: rawUser, preferred: preferredLabel });
      if (onlineStatusEl) {
        onlineStatusEl.textContent = t("provider.bulletAttempt", { context: warningContext, remaining });
      }
      await sleepMs(220);
      const bullet = await fetchChunk(["bullet"], remaining);
      bulletGames = bullet.games;
      totalGames += bulletGames;
      if (bullet.text && bullet.text.trim()) {
        finalText = finalText && finalText.trim() ? `${finalText.trim()}\n\n${bullet.text.trim()}\n` : bullet.text;
      }
      if (bulletGames > 0) {
        qualityWarning = t("provider.bulletCompleted", { context: warningContext });
      }
    }

    if (totalGames <= 0) {
      throw new Error(t("provider.noGamesForFilters"));
    }

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    const source = {
      name: `lichess_${safeUser}_${today}.pgn`,
      text: finalText,
      provider: "lichess",
      username: rawUser,
      games: totalGames,
      warning: qualityWarning,
      detail: {
        slow: slow.games,
        blitz: blitzGames,
        bullet: bulletGames,
        preferred: settings.preferredPerf.join(","),
      },
    };

    const installed = installRemotePgnSource(source);
    // Respects the "don't keep downloaded games after this session"
    // preference: the base still lives in STATE for this session (via
    // installRemotePgnSource above), it just never reaches IndexedDB.
    if (!loadNoPersistDownloadsPreference()) {
      void writeCachedRemotePgn(cacheKey, source);
    }
    if (!installed) return false;
    if (onlineStatusEl) {
      if (bulletGames > 0) {
        onlineStatusEl.textContent = t("provider.readyBullet", {
          warning: `${qualityWarning} `,
          total: totalGames,
          user: rawUser,
          slow: slow.games,
          preferred: preferredLabel,
          blitz: blitzGames,
          bullet: bulletGames,
        });
      } else if (blitzGames > 0) {
        onlineStatusEl.textContent = t("provider.readyBlitz", {
          total: totalGames,
          user: rawUser,
          slow: slow.games,
          preferred: preferredLabel,
          blitz: blitzGames,
        });
      } else {
        onlineStatusEl.textContent = t("provider.readyPreferred", { total: totalGames, user: rawUser, preferred: preferredLabel });
      }
    }
    return true;
  } catch (error) {
    const stale = await readCachedRemotePgn(cacheKey, { allowStale: true });
    if (stale) {
      return installRemotePgnSource(stale.source, { messageKey: "provider.usingStaleCachedBase" });
    }
    const message = t("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
    if (onlineStatusEl) onlineStatusEl.textContent = message;
    showWizardSourceError("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
    return false;
  }
}

function parseChessComArchiveUrl(url) {
  const match = String(url || "").match(/\/games\/(\d{4})\/(\d{2})\/?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { url, year, month };
}

function isArchiveInLastTwelveMonths(year, month) {
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 11);
  return monthDate >= cutoff;
}

async function fetchChessComPgn() {
  const rawUser = getConfiguredRemoteUsername();
  if (!rawUser) {
    if (onlineStatusEl) onlineStatusEl.textContent = t("provider.enterChesscomUser");
    showWizardSourceError("provider.enterChesscomContinue", {}, "username");
    return false;
  }

  const settings = getChessComFetchSettings();
  const preferredLabel = joinPreferredTimeClasses(settings.preferredSlowClasses);
  const cacheKey = remotePgnCacheKey("chesscom", rawUser, cacheSignature({
    provider: "chesscom",
    maxGames: settings.maxGames,
    preferredSlowClasses: settings.preferredSlowClasses,
    minSlowGames: settings.minSlowGames,
    fallbackBlitz: settings.fallbackBlitz,
    fallbackBullet: settings.fallbackBullet,
  }));

  const cached = await readCachedRemotePgn(cacheKey);
  if (cached) {
    return installRemotePgnSource(cached.source, { messageKey: "provider.usingCachedBase" });
  }

  const chesscomThrottle = remoteFetchThrottleBlock();
  if (chesscomThrottle) {
    if (onlineStatusEl) onlineStatusEl.textContent = t(chesscomThrottle.key, chesscomThrottle.params);
    showWizardSourceError(chesscomThrottle.key, chesscomThrottle.params);
    return false;
  }

  if (!(await confirmRemoteFetchConsent("chesscom", rawUser))) {
    if (onlineStatusEl) onlineStatusEl.textContent = t("privacy.remoteFetchCancelled");
    showWizardSourceError("privacy.remoteFetchCancelled");
    return false;
  }

  recordRemoteFetch();

  if (onlineStatusEl) {
    if (STATE.userMode === "citizen") {
      onlineStatusEl.textContent = t("provider.downloadingFor", { user: rawUser, protocol: describeChessComNormalProtocol(settings) });
    } else {
      onlineStatusEl.textContent = t("provider.searchingUpTo", { max: settings.maxGames, user: rawUser, preferred: preferredLabel });
    }
  }

  const monthGamesCache = new Map();
  const seenGames = new Set();
  const selectedPgn = [];
  // URLs that already failed once during this download are not retried in a
  // later fallback pass (report 10: retrying the same failed month across
  // three passes multiplies worst-case wait and provider rate-limit risk).
  const failedArchiveUrls = new Set();
  const failedMonthLabels = [];

  // Threaded into every fetchWithTimeout call below so a new session
  // (beginSessionWork -> abortActiveRemoteDownload) actually cancels an
  // in-flight request instead of only discarding its result once it settles.
  const downloadController = typeof AbortController === "function" ? new AbortController() : null;
  activeRemoteDownloadController = downloadController;
  const downloadSignal = downloadController ? downloadController.signal : undefined;

  const loadArchiveGames = async (archiveUrl) => {
    if (monthGamesCache.has(archiveUrl)) return monthGamesCache.get(archiveUrl);
    const response = await fetchWithTimeout(archiveUrl, {
      timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
      retries: REMOTE_FETCH_RETRIES,
      signal: downloadSignal,
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error(t("network.rateLimited"));
      throw new Error(t("provider.chesscomReadArchiveError", { status: response.status, url: archiveUrl }));
    }
    const payload = await readResponseJsonWithLimit(response);
    const games = Array.isArray(payload?.games) ? payload.games : [];
    monthGamesCache.set(archiveUrl, games);
    return games;
  };

  const takeGamesFromArchive = (games, allowedClassesSet, remaining) => {
    if (remaining <= 0) return 0;
    const ordered = games.slice().sort((a, b) => (Number(b.end_time) || 0) - (Number(a.end_time) || 0));
    let added = 0;
    for (const game of ordered) {
      if (added >= remaining) break;
      const rules = String(game?.rules || "chess").toLowerCase();
      if (rules !== "chess") continue;
      const timeClass = String(game?.time_class || "").toLowerCase();
      if (!allowedClassesSet.has(timeClass)) continue;
      const pgn = String(game?.pgn || "").trim();
      if (!pgn) continue;
      const key = String(game?.uuid || game?.url || `${timeClass}|${game?.end_time || 0}|${pgn.slice(0, 48)}`);
      if (seenGames.has(key)) continue;
      seenGames.add(key);
      selectedPgn.push(pgn);
      added += 1;
    }
    return added;
  };

  // Bounds the worst case from report 10 (twelve months x up to three
  // fallback passes, each with its own 15s timeout and retries, could
  // otherwise chain minutes of waiting): once this much wall-clock time has
  // passed, the download stops walking further months and reports whatever
  // games it already gathered instead of continuing to hang.
  let downloadStartedAt = Date.now();
  let budgetExceeded = false;
  const withinBudget = () => {
    if (Date.now() - downloadStartedAt > CHESSCOM_DOWNLOAD_BUDGET_MS) {
      budgetExceeded = true;
      return false;
    }
    return true;
  };

  try {
    const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(rawUser.toLowerCase())}/games/archives`;
    const archivesResponse = await fetchWithTimeout(archivesUrl, {
      timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
      retries: REMOTE_FETCH_RETRIES,
      signal: downloadSignal,
    });
    if (!archivesResponse.ok) {
      if (archivesResponse.status === 429) {
        throw new Error(t("network.rateLimited"));
      }
      if (archivesResponse.status === 404) {
        throw new Error(t("provider.userNotFoundOrPrivate"));
      }
      throw new Error(t("provider.chesscomResponse", { status: archivesResponse.status }));
    }
    const archivesPayload = await readResponseJsonWithLimit(archivesResponse);
    const archives = (Array.isArray(archivesPayload?.archives) ? archivesPayload.archives : [])
      .map(parseChessComArchiveUrl)
      .filter(Boolean)
      .filter((archive) => isArchiveInLastTwelveMonths(archive.year, archive.month))
      .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

    if (archives.length === 0) {
      throw new Error(t("provider.noMonthlyArchives"));
    }

    downloadStartedAt = Date.now();

    const slowClasses = new Set(settings.preferredSlowClasses);
    let slowGames = 0;
    let blitzGames = 0;
    let bulletGames = 0;
    let totalGames = 0;
    let qualityWarning = "";

    // Walks every archive for one pass (preferred/slow, Blitz, or Bullet),
    // reporting "month X/Y" on the shared analysis progress bar as it goes.
    const runArchivePass = async (allowedClassesSet, passLabel) => {
      let passAdded = 0;
      for (let i = 0; i < archives.length; i += 1) {
        if (totalGames >= settings.maxGames) break;
        if (!withinBudget()) break;
        const archive = archives[i];
        updateAnalysisProgress(i + 1, archives.length, 0, t("provider.monthProgress", {
          year: archive.year,
          month: String(archive.month).padStart(2, "0"),
          pass: passLabel,
        }));
        if (failedArchiveUrls.has(archive.url)) continue;
        let games;
        try {
          games = await loadArchiveGames(archive.url);
        } catch (archiveError) {
          failedArchiveUrls.add(archive.url);
          failedMonthLabels.push(`${archive.year}-${String(archive.month).padStart(2, "0")}`);
          continue;
        }
        const added = takeGamesFromArchive(games, allowedClassesSet, settings.maxGames - totalGames);
        passAdded += added;
        totalGames += added;
      }
      return passAdded;
    };

    slowGames = await runArchivePass(slowClasses, preferredLabel);

    if (settings.fallbackBlitz && totalGames < settings.minSlowGames && totalGames < settings.maxGames && withinBudget()) {
      const remaining = settings.maxGames - totalGames;
      if (onlineStatusEl) {
        onlineStatusEl.textContent = t("provider.completingBlitz", { count: totalGames, preferred: preferredLabel, remaining });
      }
      await sleepMs(220);
      blitzGames = await runArchivePass(new Set(["blitz"]), "Blitz");
    }

    let warningContext = "";
    if (settings.fallbackBullet && totalGames < settings.minSlowGames && totalGames < settings.maxGames && withinBudget()) {
      const remaining = settings.maxGames - totalGames;
      warningContext = blitzGames > 0
        ? t("provider.bulletContextStillShort", { user: rawUser, preferred: preferredLabel })
        : t("provider.bulletContextNoBlitz", { user: rawUser, preferred: preferredLabel });
      if (onlineStatusEl) {
        onlineStatusEl.textContent = t("provider.bulletAttempt", { context: warningContext, remaining });
      }
      await sleepMs(220);
      bulletGames = await runArchivePass(new Set(["bullet"]), "Bullet");
      if (bulletGames > 0) {
        qualityWarning = t("provider.bulletCompleted", { context: warningContext });
      }
    }

    if (totalGames <= 0 || selectedPgn.length === 0) {
      throw new Error(t("provider.noGamesForFilters"));
    }

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    const source = {
      name: `chesscom_${safeUser}_${today}.pgn`,
      text: `${selectedPgn.join("\n\n")}\n`,
      provider: "chesscom",
      username: rawUser,
      games: totalGames,
      warning: qualityWarning,
      detail: {
        slow: slowGames,
        blitz: blitzGames,
        bullet: bulletGames,
        preferred: settings.preferredSlowClasses.join(","),
      },
    };

    const installed = installRemotePgnSource(source);
    // Respects the "don't keep downloaded games after this session"
    // preference: the base still lives in STATE for this session (via
    // installRemotePgnSource above), it just never reaches IndexedDB.
    if (!loadNoPersistDownloadsPreference()) {
      void writeCachedRemotePgn(cacheKey, source);
    }
    if (!installed) return false;
    if (onlineStatusEl) {
      let readyMessage;
      if (bulletGames > 0) {
        readyMessage = t("provider.readyBullet", {
          warning: `${qualityWarning} `,
          total: totalGames,
          user: rawUser,
          slow: slowGames,
          preferred: preferredLabel,
          blitz: blitzGames,
          bullet: bulletGames,
        });
      } else if (blitzGames > 0) {
        readyMessage = t("provider.readyBlitz", {
          total: totalGames,
          user: rawUser,
          slow: slowGames,
          preferred: preferredLabel,
          blitz: blitzGames,
        });
      } else {
        readyMessage = t("provider.readyPreferred", { total: totalGames, user: rawUser, preferred: preferredLabel });
      }
      if (failedMonthLabels.length > 0) {
        readyMessage = `${readyMessage} ${t("provider.monthsSkipped", { months: failedMonthLabels.join(", ") })}`;
      }
      if (budgetExceeded) {
        readyMessage = `${readyMessage} ${t("provider.downloadBudgetExceeded")}`;
      }
      onlineStatusEl.textContent = readyMessage;
    }
    return true;
  } catch (error) {
    // The download was aborted because a new session started (see
    // beginSessionWork), not because of a real failure: whatever screen the
    // person is on now has already moved past this download, so there is
    // nothing useful to show here.
    if (downloadSignal?.aborted) return false;
    const stale = await readCachedRemotePgn(cacheKey, { allowStale: true });
    if (stale) {
      return installRemotePgnSource(stale.source, { messageKey: "provider.usingStaleCachedBase" });
    }
    let message = t("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
    if (budgetExceeded) message = `${message} ${t("provider.downloadBudgetExceeded")}`;
    if (onlineStatusEl) onlineStatusEl.textContent = message;
    showWizardSourceError("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
    return false;
  } finally {
    if (activeRemoteDownloadController === downloadController) {
      activeRemoteDownloadController = null;
    }
  }
}

// ---------- Main session pipeline ----------

async function startSessionPipeline() {
  const readiness = getSetupReadiness();
  if (!readiness.valid) {
    if (analysisStatusEl) analysisStatusEl.textContent = readiness.reason;
    updateAnalyzeButtonState();
    return;
  }

  const sessionToken = resetSessionStateForNewPipeline();
  const effectiveConfig = getEffectiveAnalysisConfig();
  STATE.scoringSystem = effectiveConfig.scoringSystem;
  updateCompetitiveStatus();

  try {
    await ensureEngineForSession();
    if (!isCurrentSessionWork(sessionToken)) return;
    if (!(await ensurePgnSourceAvailable(sessionToken))) return;

    const ctx = await loadCandidateAnalysisContext(effectiveConfig);
    if (!ctx) return;

    const firstSearch = await findNextMistake(ctx, "Inicio: ");
    if (!isCurrentSessionWork(sessionToken)) return;
    if (!firstSearch.mistake) {
      sendWizardBackToSourceStep("provider.noUsefulMistakes", { analyzed: ctx.analyzed, total: ctx.total });
      return;
    }

    enterPlayModeWithFirstPosition(firstSearch.mistake, ctx);
  } catch (error) {
    if (!isCurrentSessionWork(sessionToken)) return;
    const message = t("analysis.status.error", { error: error.message || t("common.unknown") });
    analysisStatusEl.textContent = message;
    analysisProgressWrapEl.classList.add("hidden");
    analysisMetricsEl.classList.add("hidden");
    sendWizardBackToSourceStep("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
  } finally {
    if (isCurrentSessionWork(sessionToken)) {
      STATE.ui.setupAnalyzing = false;
      stopWizardFacts();
      setWizardFormControlsDisabled(false);
      updateAnalyzeButtonState();
    }
  }
}

// Resets session counters, wizard config, and the game/history UI for a
// fresh analysis run, and opens a new session token for staleness checks.
function resetSessionStateForNewPipeline() {
  clearWizardSourceError();
  const sessionToken = beginSessionWork();
  STATE.ui.setupAnalyzing = true;
  setWizardFormControlsDisabled(true);
  if (analyzeBtn) analyzeBtn.disabled = true;
  resetAnalysisProgress();
  analysisProgressWrapEl.classList.remove("hidden");
  // Downloading and scanning games is a long wait: chess history keeps it company.
  startWizardFacts();
  stopRoundTimer();
  setThinkingMode(false);
  setScoringInfoVisible(false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();
  setUiPhase("playing", false);
  STATE.session = null;
  STATE.scoringOverride = null;
  STATE.clockMode = settingsGet("clock.mode", "timed") === "untimed" ? "untimed" : "timed";
  STATE.hintsEnabled = Boolean(settingsGet("hints.enabled", true));
  resetHintState();
  STATE.allMistakes = [];
  STATE.positions = [];
  STATE.index = 0;
  STATE.score = 0;
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  const setupConfig = collectWizardConfig();
  STATE.turnTimeSeconds = setupConfig.turnTimeSeconds;
  if (turnTimeSecondsEl) turnTimeSecondsEl.value = String(setupConfig.turnTimeSeconds);
  applyGameFormat(setupConfig.mode);
  readDuelPlayersFromInputs();
  resetDuelState();
  updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
  updateScoreDisplay();
  updatePlayerPanels();
  renderSessionProgress();
  STATE.historyEntries = [];
  STATE.historySelectedIdx = -1;
  renderHistoryList();
  STATE.analysisContext = null;
  nextBtn.disabled = true;
  skipBtn.disabled = true;
  STATE.targetPositions = setupConfig.sessionSize;
  return sessionToken;
}

// Brings the strong engine back before a session starts. Going back to the start
// terminates its worker, so without this every later session in the same tab
// would be scored by the shallow local fallback without ever saying so.
async function ensureEngineForSession() {
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return;
  analysisStatusEl.textContent = t("analysis.status.prepareEngine");
  // Do not hold the session hostage to a 7 MB download on a bad connection:
  // after this wait the session starts on the local engine and the download
  // carries on, so later rounds can still use the strong one.
  await Promise.race([ensureStockfishLoading(), sleepMs(ENGINE_SESSION_WAIT_MS)]);
}

// True when this session is being scored by the shallow local fallback instead
// of the strong engine, which changes how demanding the scoring is.
function isUsingFallbackEngine() {
  return STATE.engine.mode !== "stockfish" || !STATE.engine.ready;
}

// Makes sure a PGN source is loaded, downloading one from the configured
// provider if needed. Returns false (after already reporting the error or
// bailing out silently on a stale session) when the pipeline should stop.
async function ensurePgnSourceAvailable(sessionToken) {
  if (hasAnyPgnSource(true)) return true;
  const requestedUser = getConfiguredRemoteUsername();
  const requestedProvider = STATE.sourceMode;
  analysisStatusEl.textContent = t("analysis.status.prepareBase", { provider: providerLabel(STATE.sourceMode) });
  const downloaded = STATE.sourceMode === "chesscom"
    ? await fetchChessComPgn()
    : await fetchLichessPgn();
  if (!isCurrentSessionWork(sessionToken)) return false;
  if (!downloaded || !hasAnyPgnSource(true)) {
    const configChanged = normalizeName(getConfiguredRemoteUsername()) !== normalizeName(requestedUser)
      || getRemoteProviderModeFromUi() !== requestedProvider;
    sendWizardBackToSourceStep(configChanged ? "provider.configChangedDuringDownload" : "common.sourceError");
    return false;
  }
  return true;
}

// Parses the active PGN sources into games, detects the target player, and
// builds the candidate-mistake search context. Returns null (after already
// sending the wizard back to the source step) when nothing usable was found.
async function loadCandidateAnalysisContext(effectiveConfig) {
  const sources = await getActivePgnTextSources();
  // buildGameFromText returns null for a game that trips a parsing budget
  // (oversized, an oversized comment, too many plies, variation nesting too
  // deep); that game is skipped instead of the whole batch failing. Games
  // that declare a custom starting FEN (SetUp "1" + FEN) but whose pair is
  // invalid or inconsistent are skipped too, rather than replayed from the
  // initial position, same spirit as failedMonths below for failed downloads.
  let skippedInvalidStartFen = 0;
  const allGames = sources
    .flatMap(({ text }) => splitGamesFromText(text)
      .map((gameText) => {
        const built = buildGameFromText(gameText);
        if (!built) return null;
        const start = resolveGameStartFen(built.tags);
        return { ...built, startFen: start.fen, validStartFen: start.valid };
      })
      .filter(Boolean))
    .filter((game) => {
      if (game.validStartFen) return true;
      skippedInvalidStartFen += 1;
      return false;
    });

  if (allGames.length === 0) {
    sendWizardBackToSourceStep("provider.noPublicValidGames");
    return null;
  }

  const requestedName = sources.map((entry) => entry.username).find(Boolean) || "";
  const target = resolveTargetPlayerName(allGames, requestedName);
  const playerName = target.name;
  playerNameDetectedEl.textContent = playerName || t("players.notDetected");

  if (!playerName) {
    if (target.requestedMissing) {
      sendWizardBackToSourceStep("provider.requestedPlayerMissing", { user: requestedName });
    } else {
      sendWizardBackToSourceStep("provider.playerNotDetected");
    }
    return null;
  }

  const depth = INTERNAL_ANALYSIS_DEPTH;
  const moveTimeMs = effectiveConfig.moveTimeMs;
  const threshold = effectiveConfig.thresholdCp;
  const candidates = buildRandomCandidateQueue(allGames, playerName);
  const uniqueGameCount = new Set(candidates.map((c) => c.gameIdx)).size;
  if (candidates.length === 0) {
    sendWizardBackToSourceStep("provider.noAnalyzablePositions");
    return null;
  }

  updateAnalysisProgress(0, candidates.length, 0, t("game.searchingNext"));
  analysisStatusEl.textContent = t("analysis.status.shuffle", { games: allGames.length, player: playerName });

  const ctx = {
    games: allGames,
    targetName: playerName,
    depth,
    moveTimeMs,
    thresholdCp: threshold,
    candidates,
    total: candidates.length,
    analyzed: 0,
    detected: 0,
    cursor: 0,
    usedGameIndices: new Set(),
    uniqueGameCount,
    repeatMistakes: [],
  };
  STATE.analysisContext = ctx;
  return ctx;
}

// Stores the first found mistake as the session's starting position, updates
// the session-hint text, and switches the UI from setup into play mode.
function enterPlayModeWithFirstPosition(firstMistake, ctx) {
  STATE.allMistakes = [firstMistake];
  STATE.positions = [firstMistake];
  if (STATE.userMode === "engineer") {
    sessionHintEl.textContent = t("game.sessionHintEngineer", {
      target: STATE.targetPositions,
      system: scoringSystemLabel(STATE.scoringSystem),
      detected: ctx.detected,
      analyzed: ctx.analyzed,
      total: ctx.total,
    });
  } else {
    sessionHintEl.textContent = t("game.sessionHintCitizen", { target: STATE.targetPositions, detected: ctx.detected });
  }
  analysisStatusEl.textContent = isUsingFallbackEngine()
    ? `${t("analysis.status.firstReady")} ${t("analysis.status.localEngineNotice")}`
    : t("analysis.status.firstReady");
  // The own-games pipeline joins the same lifecycle as any other session.
  const duel = STATE.gameFormat === "duel";
  STATE.session = {
    id: Ludus.util.uid("s_"),
    kind: "own",
    title: t("core.session.own", { user: gameMoveAuthorName() }),
    mode: duel ? "duel" : "solo",
    names: duel ? [duelPlayerName(0), duelPlayerName(1)] : null,
    profileIds: duel
      ? [0, 1].map((index) => (Array.isArray(STATE.setupWizard.profileIds) ? STATE.setupWizard.profileIds[index] || null : null))
      : [activeProfileId()],
    options: {},
    startedAt: Date.now(),
    positions: STATE.targetPositions,
    completed: false,
    records: [],
    record: null,
  };
  // The search is over: hiding the wizard must not read as leaving it half way.
  STATE.ui.setupAnalyzing = false;
  routerShow("game");
  startRound();
  busEmit("session:started", { session: publicSessionInfo(STATE.session) });
}

// ---------- Events ----------

// Arrow-key navigation for the five exclusive-choice button groups (mode,
// platform, position count, turn time, language); see setRadioGroupTabIndex
// for the roving tabindex that keeps them a single Tab stop each.
wireRadioGroupKeyboardNav(languageGroupEls);
wireRadioGroupKeyboardNav(wizardModeGroupEls);
wireRadioGroupKeyboardNav(wizardPlatformGroupEls);
wireRadioGroupKeyboardNav(wizardSizeChipEls);
wireRadioGroupKeyboardNav(wizardTimerChipEls);

if (languageBtnEs) {
  languageBtnEs.addEventListener("click", () => {
    setLanguage("es");
  });
}

if (languageBtnEn) {
  languageBtnEn.addEventListener("click", () => {
    setLanguage("en");
  });
}

if (sourceBackBtn) {
  sourceBackBtn.addEventListener("click", () => {
    goHome();
  });
}

if (wizardPrevBtn) {
  wizardPrevBtn.addEventListener("click", () => {
    goToWizardStep(STATE.setupWizard.step - 1);
  });
}

if (wizardNextBtn) {
  wizardNextBtn.addEventListener("click", () => {
    const current = clamp(Number(STATE.setupWizard.step) || 1, 1, 3);
    const validation = validateWizardStep(current);
    if (!validation.valid) {
      if (current === 1) showWizardStepError(validation.reason, validation.field);
      if (current === 2) showWizardSourceError(validation.reason, {}, validation.field);
      if (current === 3) {
        if (analysisStatusEl) analysisStatusEl.textContent = validation.reason;
        if (validation.field === "count") setFieldInvalid(sessionSizeEl, "analysis-status");
      }
      focusFirstInvalidWizardControl(current, validation);
      return;
    }
    clearWizardStepError();
    clearWizardSourceError();
    clearFieldInvalid(sessionSizeEl, "analysis-status");
    goToWizardStep(current + 1);
    if (analysisStatusEl) analysisStatusEl.textContent = t("wizard.status.nextStep");
  });
}

if (summaryMenuBtn) {
  summaryMenuBtn.addEventListener("click", () => {
    restartToSetup();
  });
}

if (wizardModeSoloBtn) {
  wizardModeSoloBtn.addEventListener("click", () => {
    STATE.setupWizard.mode = "solo";
    if (gameFormatEl) gameFormatEl.value = "solo";
    clearWizardStepError();
    renderWizardStep();
  });
}

if (wizardModeDuelBtn) {
  wizardModeDuelBtn.addEventListener("click", () => {
    STATE.setupWizard.mode = "duel";
    if (gameFormatEl) gameFormatEl.value = "duel";
    clearWizardStepError();
    renderWizardStep();
  });
}

if (wizardProviderLichessBtn) {
  wizardProviderLichessBtn.addEventListener("click", () => {
    const previous = STATE.setupWizard.platform;
    STATE.setupWizard.platform = "lichess";
    if (onlineProviderSelectEl) onlineProviderSelectEl.value = "lichess";
    setSourceMode("lichess");
    if (previous !== "lichess" && STATE.remotePgnSources.length > 0) clearRemotePgnSources();
    clearWizardSourceError();
    updatePgnSelectionUi();
  });
}

if (wizardProviderChessComBtn) {
  wizardProviderChessComBtn.addEventListener("click", () => {
    const previous = STATE.setupWizard.platform;
    STATE.setupWizard.platform = "chesscom";
    if (onlineProviderSelectEl) onlineProviderSelectEl.value = "chesscom";
    setSourceMode("chesscom");
    if (previous !== "chesscom" && STATE.remotePgnSources.length > 0) clearRemotePgnSources();
    clearWizardSourceError();
    updatePgnSelectionUi();
  });
}

if (onlineProviderSelectEl) {
  onlineProviderSelectEl.addEventListener("change", () => {
    const nextMode = getRemoteProviderModeFromUi();
    const previous = STATE.setupWizard.platform;
    STATE.setupWizard.platform = nextMode;
    setSourceMode(nextMode);
    if (previous !== nextMode && STATE.remotePgnSources.length > 0) {
      clearRemotePgnSources();
    }
    clearWizardSourceError();
    updatePgnSelectionUi();
  });
}

if (onlineUserInputEl) {
  onlineUserInputEl.addEventListener("input", () => {
    STATE.setupWizard.username = sanitizeWizardUsername(onlineUserInputEl.value);
    if (STATE.remotePgnSources.length > 0) {
      clearRemotePgnSources();
    }
    clearWizardSourceError();
    updatePgnSelectionUi();
  });
}

if (sessionSizeEl) {
  sessionSizeEl.addEventListener("input", () => {
    STATE.setupWizard.sessionSize = clamp(Number(sessionSizeEl.value) || DEFAULT_CITIZEN_SESSION_SIZE, 1, 200);
    sessionSizeEl.value = String(STATE.setupWizard.sessionSize);
    if (STATE.remotePgnSources.length > 0) {
      clearRemotePgnSources();
    }
    updatePgnSelectionUi();
  });
}

wizardSizeChipEls.forEach((chipEl) => {
  chipEl.addEventListener("click", () => {
    const size = clamp(Number(chipEl.getAttribute("data-size")) || DEFAULT_CITIZEN_SESSION_SIZE, 1, 200);
    STATE.setupWizard.sessionSize = size;
    if (sessionSizeEl) sessionSizeEl.value = String(size);
    if (STATE.remotePgnSources.length > 0) clearRemotePgnSources();
    updatePgnSelectionUi();
  });
});

wizardTimerChipEls.forEach((chipEl) => {
  chipEl.addEventListener("click", () => {
    const seconds = normalizeTurnTimeSeconds(
      chipEl.getAttribute("data-seconds"),
      { fallback: DEFAULT_TURN_TIME_SECONDS },
    );
    setWizardTurnTimeSeconds(seconds);
    renderWizardStep();
    updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
    updateCompetitiveStatus();
  });
});

// The landing page's start button is found by delegation, so it keeps working
// if the landing screen re-renders its markup when it mounts.
document.addEventListener("click", (event) => {
  const target = event && event.target;
  const button = target && typeof target.closest === "function" ? target.closest("#landing-start-btn") : null;
  if (button) startFromLanding();
});

if (hintBtn) {
  hintBtn.addEventListener("click", () => {
    requestHint();
  });
}

if (wizardRetryUserBtn) {
  wizardRetryUserBtn.addEventListener("click", () => {
    clearWizardSourceError();
    if (onlineUserInputEl) onlineUserInputEl.focus();
  });
}

if (wizardSwitchPlatformBtn) {
  wizardSwitchPlatformBtn.addEventListener("click", () => {
    const nextPlatform = STATE.setupWizard.platform === "chesscom" ? "lichess" : "chesscom";
    STATE.setupWizard.platform = nextPlatform;
    if (onlineProviderSelectEl) onlineProviderSelectEl.value = nextPlatform;
    setSourceMode(nextPlatform);
    clearRemotePgnSources();
    clearWizardSourceError();
    updatePgnSelectionUi();
  });
}

if (wizardClearCacheBtn) {
  let clearCacheArmed = false;
  let clearCacheArmTimer = null;
  const setClearCacheArmed = (armed) => {
    clearCacheArmed = Boolean(armed);
    const key = clearCacheArmed ? "wizard.step2.clearCacheConfirm" : "wizard.step2.clearCache";
    wizardClearCacheBtn.setAttribute("data-i18n", key);
    wizardClearCacheBtn.textContent = t(key);
    wizardClearCacheBtn.classList.toggle("is-armed", clearCacheArmed);
    if (clearCacheArmTimer) {
      clearTimeout(clearCacheArmTimer);
      clearCacheArmTimer = null;
    }
    if (clearCacheArmed) {
      clearCacheArmTimer = window.setTimeout(() => {
        clearCacheArmTimer = null;
        setClearCacheArmed(false);
      }, 5000);
    }
  };
  wizardClearCacheBtn.addEventListener("click", () => {
    if (!clearCacheArmed) {
      if (wizardClearCacheStatusEl) {
        wizardClearCacheStatusEl.textContent = "";
        wizardClearCacheStatusEl.classList.add("hidden");
      }
      setClearCacheArmed(true);
      return;
    }
    setClearCacheArmed(false);
    void clearAllRemotePgnCache().then(() => {
      if (wizardClearCacheStatusEl) {
        wizardClearCacheStatusEl.textContent = t("wizard.step2.clearCacheDone");
        wizardClearCacheStatusEl.classList.remove("hidden");
      }
    });
  });
}

if (scoringSystemEl) {
  scoringSystemEl.addEventListener("change", () => {
    STATE.scoringSystem = normalizeScoringSystem(scoringSystemEl.value);
    scoringSystemEl.value = STATE.scoringSystem;
    updateScoringSystemHint();
    updateCompetitiveStatus();
  });
}

if (gameFormatEl) {
  gameFormatEl.addEventListener("change", () => {
    applyGameFormat(gameFormatEl.value);
  });
}

if (turnTimeSecondsEl) {
  turnTimeSecondsEl.addEventListener("input", () => {
    const rawSeconds = Number(turnTimeSecondsEl.value);
    if (!Number.isFinite(rawSeconds)) {
      updateWizardTimerChipSelection(NaN);
      return;
    }
    updateWizardTimerChipSelection(rawSeconds);
  });
  turnTimeSecondsEl.addEventListener("change", () => {
    setWizardTurnTimeSeconds(turnTimeSecondsEl.value, { fallback: MIN_TURN_TIME_SECONDS });
    renderWizardStep();
    updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
    updateCompetitiveStatus();
  });
}

[duelPlayerAEl, duelPlayerBEl]
  .filter(Boolean)
  .forEach((inputEl) => {
    inputEl.addEventListener("input", () => {
      const current = collectWizardConfig();
      STATE.setupWizard.duelNames = [...current.duelNames];
      readDuelPlayersFromInputs();
      updateScoreDisplay();
      updateCompetitiveStatus();
      renderSessionProgress();
      renderWizardStep();
    });
  });

if (analyzeBtn) {
  analyzeBtn.addEventListener("click", () => {
    void startSessionPipeline();
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    void nextPosition();
  });
}
if (resultAnalysisBtn) {
  resultAnalysisBtn.addEventListener("click", () => {
    enterResultAnalysisMode();
  });
}
if (resultAnalysisResetBtn) {
  resultAnalysisResetBtn.addEventListener("click", () => {
    resetResultAnalysisBoard();
  });
}
if (revealBestBtn) {
  revealBestBtn.addEventListener("click", () => {
    revealSpecificMove("best");
  });
}
if (revealGameBtn) {
  revealGameBtn.addEventListener("click", () => {
    revealSpecificMove("game");
  });
}
if (skipBtn) {
  skipBtn.addEventListener("click", () => {
    if (!STATE.board || !STATE.positions.length || STATE.ui.blockBoardInput || (nextBtn && nextBtn.disabled === false)) return;
    void submitNoMove("manual_skip");
  });
}
if (restartBtn) restartBtn.addEventListener("click", () => {
  void confirmRestartToSetup().then((confirmed) => {
    if (confirmed) restartToSetup();
  });
});
if (handoffOverlayEl) {
  handoffOverlayEl.addEventListener("click", () => {
    revealDuelSecondTurn();
  });
}
if (positionSearchCancelBtnEl) {
  positionSearchCancelBtnEl.addEventListener("click", () => {
    STATE.ui.searchCancelRequested = true;
  });
}
if (promotionPickerEl) {
  promotionPickerEl.addEventListener("keydown", onPromotionPickerKeyDown);
}
promotionChoiceEls.forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => choosePromotion(btn.dataset.promotion));
});

if (oneColumnGameQuery && typeof oneColumnGameQuery.addEventListener === "function") {
  oneColumnGameQuery.addEventListener("change", () => {
    mountSharedActionsToActivePanel();
  });
}
if (wizardWideScreenQuery && typeof wizardWideScreenQuery.addEventListener === "function") {
  wizardWideScreenQuery.addEventListener("change", syncWizardSummaryDisclosure);
}
if (wizardSummaryBoxEl) {
  // En pantalla ancha la tarjeta de resumen no se pliega: si algo la cierra
  // (por ejemplo el teclado sobre el título), vuelve a abrirse sola.
  wizardSummaryBoxEl.addEventListener("toggle", () => {
    if (!wizardSummaryBoxEl.open) syncWizardSummaryDisclosure();
  });
}

window.addEventListener("resize", () => {
  renderBoardArrows();
  // Rotating a phone or resizing a window changes which column layout is in
  // use, and the round actions belong next to the board only in one of them.
  mountSharedActionsToActivePanel();
});

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.info("Service worker registration skipped:", error);
    });
  });
}

// ---------- Boot: shell, screens, router, public API ----------

const SCREEN_NAMES = ["landing", "home", "classics", "notebook", "progress", "museum", "settings", "account"];

function registerRouterScreen(name, container, screen) {
  const router = ludusModule("router");
  if (!router) return;
  router.register(name, {
    el: container,
    title: screen && screen.title,
    onShow(params) {
      if (name === "landing") document.body.classList.add("landing-active");
      if (screen && typeof screen.show === "function") screen.show(params);
    },
    onHide() {
      if (name === "landing") document.body.classList.remove("landing-active");
      if (screen && typeof screen.hide === "function") screen.hide();
    },
  });
}

// The sections this page always had are screens too: "setup" (the own-games
// wizard) and "game" (the board, its result and its actions).
function registerLegacyScreens() {
  const router = ludusModule("router");
  if (!router) return;
  router.register("setup", {
    el: setupPanelEl,
    onShow() {
      document.body.classList.remove("landing-active");
    },
    onHide() {
      cancelSetupWork();
    },
  });
  router.register("game", {
    el: gameLayoutEl,
    onShow() {
      document.body.classList.add("playing-mode");
      if (sharedActionsEl) sharedActionsEl.classList.remove("hidden");
      updateRoundTimerUi();
    },
    onHide() {
      document.body.classList.remove("playing-mode");
      // Leaving the board by any road but the game's own buttons abandons the
      // session (a finished one just goes away): no timer, no engine and no
      // overlay is left running behind the next screen.
      abortSessionInternal();
    },
  });
}

// One broken screen must never take the app down: it is reported and skipped.
function mountScreens() {
  const screens = ludusModule("Screens") || {};
  SCREEN_NAMES.forEach((name) => {
    const container = document.getElementById(name === "landing" ? "landing-screen" : `screen-${name}`);
    const screen = screens[name];
    if (!container) return;
    let mounted = false;
    if (screen && typeof screen.mount === "function") {
      try {
        screen.mount(container);
        mounted = true;
      } catch (error) {
        console.error(`[Ludus] the "${name}" screen failed to mount`, error);
      }
    }
    mountedScreens[name] = mounted;
    // The landing page is always a screen (its markup is in index.html); the
    // others only when their module mounted.
    if (name === "landing" || mounted) registerRouterScreen(name, container, mounted ? screen : null);
  });
}

// The settings the wizard and the clock reflect follow the settings screen.
function watchSettings() {
  const bus = ludusModule("bus");
  if (!bus || typeof bus.on !== "function") return;
  bus.on("settings:changed", (payload) => {
    const path = payload && payload.path;
    const overrides = STATE.session && STATE.session.options ? STATE.session.options : {};
    if (path === "clock.seconds" && !overrides.clock) {
      setWizardTurnTimeSeconds(payload.value, { skipPersist: true });
      renderWizardStep();
    } else if (path === "clock.mode") {
      if (!STATE.session) STATE.clockMode = payload.value === "untimed" ? "untimed" : "timed";
      renderWizardStep();
    } else if (path === "hints.enabled" && typeof overrides.hints !== "boolean" && !STATE.session) {
      STATE.hintsEnabled = Boolean(payload.value);
      updateHintButton();
    }
  });
  // A new achievement is a small celebration (Profile decides what unlocks).
  bus.on("achievement:unlocked", (payload) => {
    const name = payload && payload.achievement ? payload.achievement.name : "";
    if (!name) return;
    showToast(t("core.toast.achievement", { name }), { kind: "achievement" });
    playSound("levelup");
  });
  bus.on("screen:changed", (payload) => {
    try {
      document.body.dataset.screen = payload && payload.id ? String(payload.id) : "";
    } catch (error) {
      // Cosmetic hook for CSS only.
    }
  });
}

function exposeGameApi() {
  Ludus.game = {
    startSession,
    isActive: isSessionActive,
    abort: abortSession,
    leave: leaveSession,
    openOwnGamesSetup,
    hint: requestHint,
    session: () => publicSessionInfo(STATE.session),
    resultContext: () => STATE.resultView.context,
    analyzePosition,
    isUsingFallbackEngine,
    // For tests and end-to-end checks: hands the engine another transport
    // (a fake, or a Node child process) instead of the Worker, and may shorten
    // the waits (minEvalVisibleMs, retryBaseMs). Drops the engine that is
    // loaded; the next session loads the new one.
    configureEngine(options = {}) {
      const opts = options && typeof options === "object" ? options : {};
      engineTransportFactory = typeof opts.createTransport === "function" ? opts.createTransport : null;
      timingOverrides.minEvalVisibleMs = Number.isFinite(opts.minEvalVisibleMs) ? Math.max(0, opts.minEvalVisibleMs) : null;
      timingOverrides.engineRetryBaseMs = Number.isFinite(opts.retryBaseMs) ? Math.max(0, opts.retryBaseMs) : null;
      abortEngineWork();
      resetEngineToLocal();
      STATE.analysis.cache.clear();
    },
  };
}

function bootCore() {
  exposeGameApi();
  // The person's settings and profile are ready before anything draws.
  try {
    const settings = ludusModule("Settings");
    if (settings && typeof settings.applyToDocument === "function") settings.applyToDocument();
  } catch (error) {
    console.error("[Ludus] settings could not be applied", error);
  }
  try {
    const profile = ludusModule("Profile");
    if (profile) {
      profile.ensureActive();
      profile.attach();
    }
  } catch (error) {
    console.error("[Ludus] the profile could not start", error);
  }
  watchSharedLanguage();
  watchSettings();
  registerLegacyScreens();
  try {
    const shell = ludusModule("shell");
    if (shell && typeof shell.mount === "function") shell.mount(document.querySelector(".app"));
  } catch (error) {
    console.error("[Ludus] the shell failed to mount", error);
  }
  mountScreens();
  // The landing page is for someone who has never been here; everybody else starts at home.
  if (shouldShowLanding()) showLandingScreen();
  else goHome();
}

skipBtn.disabled = true;
updateDocumentLanguage();
updateLanguageToggleUi();
syncLocalizedPlayerDefaults();
applyStaticTranslations();
STATE.scoringSystem = normalizeScoringSystem(scoringSystemEl ? scoringSystemEl.value : DEFAULT_SCORING_SYSTEM);
if (scoringSystemEl) scoringSystemEl.value = STATE.scoringSystem;
updateScoringSystemHint();
updateResultAnalysisControls();
setUserMode("citizen");
STATE.setupWizard.turnTimeSeconds = loadSetupPreference().turnTimeSeconds;
setWizardTurnTimeSeconds(STATE.setupWizard.turnTimeSeconds, { skipPersist: true });
readDuelPlayersFromInputs();
applyGameFormat(gameFormatEl ? gameFormatEl.value : "solo");
setSourceMode("lichess");
resetSetupWizard({
  mode: "solo",
  statusMessage: t("wizard.status.answerQuestions"),
});
updatePgnSelectionUi();
updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
updateScoreDisplay();
updateCompetitiveStatus();
renderHistoryList();
buildBoard();
renderBoard();
bootCore();
refreshLocalizedUi();
registerServiceWorker();
void purgeExpiredRemotePgnCache();
