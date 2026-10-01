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
const wizardRetryDownloadBtn = document.getElementById("wizard-retry-download-btn");
const analysisElapsedEl = document.getElementById("analysis-elapsed");
const analysisCancelBtn = document.getElementById("analysis-cancel-btn");
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

const gameLayoutEl = document.getElementById("game-layout");
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
const hintBtnLabelEl = document.getElementById("hint-btn-label");
// The hints and the two-tap confirmations speak through a live region of their own: the clock's
// one is overwritten by its own milestones (60, 30, 10 s), which could swallow a hint.
const hintAnnounceEl = document.getElementById("hint-announce");
const confirmMoveBtn = document.getElementById("confirm-move-btn");
const confirmMoveLabelEl = document.getElementById("confirm-move-label");
const skipBtnLabelEl = document.getElementById("skip-btn-label");
// The play header, the turn strip and the coach panel (index.html, css/coach.css).
const sessionDotsEl = document.getElementById("session-dots");
const playScoreEl = document.getElementById("play-score");
const playScoreValueEl = document.getElementById("play-score-value");
const playScoreMaxEl = document.getElementById("play-score-max");
const duelScoreEl = document.getElementById("duel-score");
const duelSideEls = [document.getElementById("duel-a"), document.getElementById("duel-b")];
const duelAvatarEls = [document.getElementById("duel-a-avatar"), document.getElementById("duel-b-avatar")];
const duelNameEls = [document.getElementById("duel-a-name"), document.getElementById("duel-b-name")];
const duelPointsEls = [document.getElementById("duel-a-score"), document.getElementById("duel-b-score")];
const soundBtn = document.getElementById("sound-btn");
const roundTurnKingEl = document.getElementById("round-turn-king");
const playAnnounceEl = document.getElementById("play-announce");
const coachPanelEl = document.getElementById("coach-panel");
const coachScrollEl = document.getElementById("coach-scroll");
const coachExpandBtn = document.getElementById("coach-expand");
const coachExpandLabelEl = document.getElementById("coach-expand-label");
const coachThinkingEl = document.getElementById("coach-thinking");
const resultLiveEl = document.getElementById("result-overlay-live");
const summaryActionsEl = document.getElementById("summary-actions");
const legendEl = document.getElementById("co-legend");
const nextBtnLabelEl = document.getElementById("next-btn-label");
const revealBestLabelEl = document.getElementById("reveal-best-label");
const revealGameLabelEl = document.getElementById("reveal-game-label");
const resultAnalysisLabelEl = document.getElementById("result-analysis-label");
const handoffOverlayAvatarEl = document.getElementById("handoff-overlay-avatar");
const handoffOverlayEyebrowEl = document.getElementById("handoff-overlay-eyebrow");
const sessionTitleEl = document.getElementById("session-title");
const positionSearchCancelBtnEl = document.getElementById("position-search-cancel-btn");
const promotionPickerEl = document.getElementById("promotion-picker");
const promotionChoiceEls = ["q", "r", "b", "n"].map((code) => document.getElementById(`promotion-choice-${code}`));
const soloClockRailEl = document.getElementById("solo-clock-rail");
const soloClockValueEl = document.getElementById("solo-clock-value");
const soloClockArcEl = document.getElementById("solo-clock-arc");
const soloClockAnnounceEl = document.getElementById("solo-clock-announce");
const resultOverlayEl = document.getElementById("result-overlay");
const resultOverlayInnerEl = document.getElementById("result-overlay-inner");
const resultOverlayTitleEl = document.getElementById("result-overlay-title");
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
const roundResultEl = document.getElementById("round-result");
const nextBtn = document.getElementById("next-btn");
const skipBtn = document.getElementById("skip-btn");
const restartBtn = document.getElementById("restart-btn");
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
// The backup engine gives the page back to the browser after this many milliseconds of work (see createLocalSlicer).
const LOCAL_SLICE_MS = 12;
// The strong engine is a 7 MB download, so give it room on a slow connection
// and retry rather than falling back to the shallow local one for good.
const ENGINE_READY_TIMEOUT_MS = 30000;
const ENGINE_LOAD_ATTEMPTS = 3;
// How many times a strong engine that died in the middle of a session is brought back (from the next round).
const ENGINE_REVIVALS = 2;
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
// A move that is not among the reference lines is judged on the terms of the best line (PF-1, docs/SCORING.md
// section 13): it is searched to the depth the best line reached, and its time ceiling is never below the best
// line's (here: twice it, within the per-search maximum), so reaching that depth is rarely cut short.
const ROUND_EVAL_MOVE_TIME_FACTOR = 2;
// Below this many plies a depth is not a budget worth matching (a mate found in the first plies, a device too slow to
// get past them): the time of the best line is the rule then, as it was before.
const ROUND_EVAL_MIN_MATCH_DEPTH = 8;
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
// The round clock wakes once per displayed second (just after the digits change), not ten
// times a second, and sleeps while the page is hidden (see scheduleClockTick).
const CLOCK_TICK_MARGIN_MS = 4;
// A second tap within this window is the same tap (a double click is not a second hint), and
// a destructive action (skip, reveal) is armed by a first tap and done by a second one within
// the confirmation window.
const HINT_TAP_GAP_MS = 450;
const CONFIRM_TAP_WINDOW_MS = 4000;
// Lichess asks clients to pause a full minute after a 429.
const RATE_LIMIT_PAUSE_MS = 60000;
// The strong engine: the download has no wall-clock limit, only a stall limit (no byte for this
// long); a session that answers before it is up waits while bytes keep arriving, up to a ceiling.
const ENGINE_DOWNLOAD_STALL_MS = 12000;
const ENGINE_WAIT_CEILING_MS = 75000;
const ENGINE_FILE_URL = "vendor/stockfish-18-lite-single.wasm";
// What a first-ever session gets: no clock (the instructions come first), see firstRunUntimed().
const FIRST_RUN_STORAGE_KEY = "ludus.firstRun.v1";
// The last username typed per provider, kept in this browser only (forgotten with the saved games).
const LAST_USER_STORAGE_KEY = "ludus.lastUser.v1";
// A session in progress, kept for this tab only (sessionStorage): a reload offers to go on.
const SESSION_PROGRESS_STORAGE_KEY = "ludus.sessionProgress.v1";
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
    "buttons.start": "Empezar",
    "buttons.backHome": "Volver al inicio",
    "buttons.previous": "Anterior",
    "buttons.next": "Siguiente",
    "buttons.startSession": "Empezar sesión",
    "buttons.retryUser": "Probar otro usuario",
    "buttons.switchPlatform": "Cambiar plataforma",
    "buttons.revealBest": "Mejor jugada",
    "buttons.revealGame": "Jugada de la partida",
    "buttons.revealPlayedBy": "Jugó {name}",
    "buttons.revealYourGame": "Tu partida",
    "buttons.exploreBoard": "Explorar tablero",
    "buttons.resetAnalysis": "Volver a la posición",
    "buttons.nextPosition": "Siguiente posición",
    "buttons.backToMenu": "Volver al inicio",
    "buttons.skipMove": "Saltear (0 pts)",
    "play.title": "Entrenamiento",
    "play.exit": "Salir",
    "play.exit.aria": "Salir de la sesión",
    "play.dots.aria": "Progreso de la sesión",
    "play.score.label": "Puntos",
    "play.score.aria": "Puntaje de la sesión",
    "play.duel.aria": "Marcador del duelo",
    "play.sound.aria": "Sonido",
    "play.sound.on": "Sonido activado",
    "play.sound.off": "Sonido desactivado",
    "play.board.region": "Tablero y acciones",
    "play.panel.aria": "Entrenador",
    "play.scroll.aria": "Notas del entrenador",
    "play.dock.round": "Acciones de la ronda",
    "play.skip.aria": "Saltear esta posición y sumar 0 puntos",
    "play.position": "Posición {current} de {total}",
    "play.finish": "Ver el resumen",
    "play.summary.back": "Volver al resumen",
    "play.turn.duel": "{player} juega con las {side}",
    "play.side.white": "blancas",
    "play.side.black": "negras",
    "play.handoff.eyebrow": "{name} ya jugó",
    "play.handoff.cta": "Tocar para empezar",
    "play.expand": "Ver todo el análisis",
    "play.collapse": "Volver al tablero",
    "play.key.next": "Siguiente",
    "play.key.explore": "Explorar",
    "play.key.best": "Mejor",
    "play.key.master": "Maestro",
    "buttons.cancelSearch": "Cancelar búsqueda",
    "confirm.restartTitle": "¿Volver al inicio?",
    "confirm.restartToSetup": "Lo que respondiste hasta ahora ({answered}) queda guardado en tu progreso y en tu cuaderno, pero no vas a ver el resumen de esta sesión. ¿Volver al inicio igual?",
    "confirm.restartToSetup.unsaved": "Tu navegador no está guardando tu progreso, así que lo que respondiste hasta ahora ({answered}) se puede perder si volvés al inicio, y tampoco vas a ver el resumen de esta sesión. ¿Volver al inicio igual?",
    "confirm.restartToSetup.none": "Todavía no respondiste ninguna posición, así que no se pierde nada. ¿Volver al inicio?",
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
    "wizard.step1.player1Label": "Nombre del participante 1",
    "wizard.step1.player2Label": "Nombre del participante 2",
    "wizard.step2.question": "¿De dónde traemos tus partidas?",
    "wizard.step2.help": "Vamos a descargar partidas públicas del último año para encontrar posiciones.",
    "wizard.step2.howItWorks": "¿Cómo funciona?",
    "wizard.step2.howItWorksBody": "Buscamos tus partidas recientes de ritmo lento (clásico y rápido). Si no alcanzan, sumamos partidas de blitz. Descargamos solo hasta juntar las posiciones que pediste.",
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
    "wizard.step3.analysisPrompt": "Tocá “Empezar sesión”. Descargamos tus partidas y buscamos tus errores: puede tardar hasta un minuto.",
    "wizard.step3.clockNote": "Este tiempo vale solo para esta sesión. Tu reloj de siempre se cambia en Ajustes.",
    "wizard.step3.noLimit": "Sin tiempo",
    "wizard.step3.noLimitHint": "Pensás sin reloj en esta sesión.",
    "wizard.step3.timerShort": "Con menos de 30 segundos casi no alcanza para pensar.",
    "wizard.validation.chooseMode": "Elegí si querés jugar solo/a o contra alguien.",
    "wizard.validation.fillDuelNames": "Completá ambos nombres para el duelo.",
    "wizard.validation.duelNameMax": "Los nombres del duelo pueden tener hasta 20 caracteres.",
    "wizard.validation.choosePlatform": "Elegí Lichess o Chess.com.",
    "wizard.validation.enterUsername": "Ingresá tu nombre de usuario para continuar.",
    "wizard.validation.invalidUsername": "El usuario de {provider} tiene de {min} a {max} caracteres: letras, números, _ o -.",
    "wizard.validation.chooseCount": "Elegí una cantidad entre 1 y 200 posiciones.",
    "wizard.validation.ready": "Configuración lista para comenzar la sesión.",
    "wizard.status.currentStep": "Configurá el paso actual para continuar.",
    "wizard.status.answerQuestions": "Respondé las preguntas para preparar tu sesión.",
    "wizard.status.nextSession": "Configurá tu próxima sesión paso a paso.",
    "wizard.status.modeSourceOptions": "Configurá modo, fuente y opciones de análisis.",
    "compat.gameFormat.solo": "Modo estudio (1 jugador)",
    "compat.gameFormat.duel": "Modo duelo (2 jugadores)",
    "players.default1": "Participante 1",
    "players.default2": "Participante 2",
    "players.targetLabel": "Usuario a analizar",
    "players.targetHint": "Usaremos este usuario para seleccionar posiciones.",
    "players.enterUserContinue": "Ingresá el usuario para continuar.",
    "players.notDetected": "No detectado",
    "players.genericUser": "usuario",
    "labels.clockTitle": "Reloj",
    "labels.clockMilestone": "Quedan {seconds} segundos.",
    "labels.clockTimeUp": "Se acabó el tiempo.",
    "result.title": "Resultado",
    "result.boardToolsLabel": "Herramientas del tablero",
    "scoring.system.simple.label": "Puntos (0 a 10)",
    "scoring.system.simple.description": "Cuanto más cerca esté tu jugada de la mejor del motor, más puntos: hasta 10 por posición.",
    // The quality words ("quality.*") live only in js/scoring.js: one ladder for every screen (CNT-014).
    "common.notAvailable": "No disponible",
    "common.searching": "Pensando…",
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
    "piece.def.whitePawn": "el peón blanco",
    "piece.def.whiteKnight": "el caballo blanco",
    "piece.def.whiteBishop": "el alfil blanco",
    "piece.def.whiteRook": "la torre blanca",
    "piece.def.whiteQueen": "la dama blanca",
    "piece.def.whiteKing": "el rey blanco",
    "piece.def.blackPawn": "el peón negro",
    "piece.def.blackKnight": "el caballo negro",
    "piece.def.blackBishop": "el alfil negro",
    "piece.def.blackRook": "la torre negra",
    "piece.def.blackQueen": "la dama negra",
    "piece.def.blackKing": "el rey negro",
    "promotion.chooseTitle": "Elegí a qué pieza coronar",
    "common.sourceError": "No pudimos traer las partidas. Probá de nuevo en un rato.",
    "network.responseTooLarge": "La respuesta de {provider} es demasiado grande y la rechazamos por seguridad. Probá de nuevo más tarde.",
    "download.error.notFound": "No encontramos a {user} en {provider}. Revisá cómo está escrito el usuario o probá con la otra plataforma.",
    "download.error.noGames": "{user} no tiene partidas públicas de los últimos 12 meses en {provider}. Probá con otro usuario o con la otra plataforma.",
    "download.error.rateLimited": "{provider} nos pidió ir más despacio. Volvemos a intentar automáticamente en {seconds} {seconds?segundo|segundos}.",
    "download.error.rateLimitedNow": "{provider} nos pidió ir más despacio. Probá de nuevo en un rato.",
    "download.error.server": "{provider} no está respondiendo bien ahora (error {status}). Probá de nuevo en unos minutos.",
    "download.error.offline": "Parece que no tenés conexión. Conectate y probá de nuevo.",
    "download.error.network": "No pudimos comunicarnos con {provider}. Revisá tu conexión y probá de nuevo.",
    "download.error.timeout": "{provider} tardó demasiado en responder. Probá de nuevo en un momento.",
    "download.error.malformed": "No pudimos leer las partidas que mandó {provider}. Probá de nuevo más tarde o con la otra plataforma.",
    "download.error.unknown": "Algo salió mal al traer las partidas. Probá de nuevo.",
    "download.error.consentUnavailable": "No pudimos mostrar la confirmación de privacidad, así que no descargamos nada. Recargá la página y probá de nuevo.",
    "download.retry": "Probar de nuevo",
    "download.cancel": "Cancelar",
    "download.elapsed": "Hace {seconds} s que estamos trabajando. Traer un año de partidas puede llevar hasta un minuto.",
    "download.elapsedLong": "Hace {seconds} s. Sigue en marcha: {provider} a veces tarda. Podés cancelar cuando quieras.",
    "download.cancelled": "Cancelaste la descarga. No guardamos nada.",
    "download.cancelledSearch": "Cancelaste la búsqueda.",
    "download.lastUser": "Usuario recordado en este navegador. Se borra con “Borrar datos guardados de partidas”.",
    "privacy.remoteFetchConfirm": "Vamos a pedirle a {provider} las partidas públicas de {user}. El pedido sale directo de tu navegador a ese sitio: esta app no tiene servidor propio. Guardamos esas partidas y tu usuario en este navegador hasta 7 días para no descargarlas de nuevo; podés borrarlas con “Borrar datos guardados de partidas”. Si entrenás con ellas, tu perfil también guarda los nombres de los jugadores y el enlace de cada partida; eso lo borrás desde Cuenta. En una computadora compartida, otra persona podría verlas. ¿Continuar?",
    "privacy.remoteFetchCancelled": "Consulta cancelada. No se enviaron datos a {provider}.",
    "privacy.remoteFetchTitle": "Consultar partidas públicas",
    "privacy.remoteFetchAccept": "Aceptar",
    "privacy.remoteFetchCancel": "Cancelar",
    "privacy.remoteFetchUsernameLabel": "Volvé a escribir el usuario para confirmar",
    "privacy.remoteFetchUsernameMismatch": "El usuario no coincide. Escribilo exactamente igual para confirmar.",
    "provider.usingCachedBase": "Usamos la base guardada de {provider} para {user}: {games} {games?partida|partidas}.",
    "provider.throttleWait": "Esperá {seconds} {seconds?segundo|segundos} antes de descargar de nuevo, así no sobrecargamos el servicio.",
    "provider.throttleHourly": "Ya se descargaron partidas {max} veces en la última hora. Probá de nuevo en {minutes?1 minuto|unos {minutes} minutos}.",
    "provider.usingStaleCachedBase": "No pudimos actualizar la base. Usamos la última guardada de {provider} para {user}: {games} {games?partida|partidas}.",
    "time.classical": "Clásico",
    "time.rapid": "Rápido",
    "time.daily": "Diario",
    "time.blitz": "Blitz",
    "time.bullet": "Bullet",
    "evaluation.timeoutZeroPts": "Tiempo agotado: 0 pts.",
    "evaluation.noMoveMadeZeroPts": "No hiciste jugada: 0 pts.",
    "evaluation.bestPrefix": "Mejor: {san}",
    "evaluation.gamePrefix": "Partida: {san}",
    "game.searchingNext": "Buscando próxima posición…",
    "game.positionFound": "Posición encontrada",
    "game.handoff.genericTitle": "Cambio de turno",
    "game.handoff.genericSubtitle": "Tocá para revelar",
    "game.handoff.title": "Pasale el dispositivo a {player}",
    "game.handoff.subtitle": "Tocá para ver la posición y empezar tu reloj. La jugada de {other} queda oculta.",
    "game.ready.title": "{player}, preparate",
    "game.ready.subtitle": "Pasale el dispositivo a {player}, que empieza esta vez. {other} espera sin mirar. El reloj arranca cuando toques la pantalla.",
    "play.ready.eyebrow": "Posición {current} de {total}",
    "game.positionMeta": "{players} · Resultado {result} · Jugada {move} · Año {year}",
    "game.turnWhite": "Juegan las blancas",
    "game.turnBlack": "Juegan las negras",
    "game.duelHint": "Competitivo local: ambos jugadores reciben exactamente las mismas posiciones y tiempo.",
    "game.soloHint": "Entrenamiento individual con puntaje total acumulado.",
    "game.studyMode": "Solo",
    "game.localDuel": "Duelo ({a} vs {b})",
    "game.summaryMode": "Modo",
    "game.summaryPlatform": "Plataforma",
    "game.summaryUser": "Usuario",
    "game.summaryPositions": "Posiciones",
    "game.summaryRoundTime": "Tiempo de ronda",
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
    "game.sessionHintEngineer": "Objetivo de sesión: {target} posiciones. Puntaje: {system}. Detectadas por ahora: {detected}. Analizadas: {analyzed}/{total}.",
    "overlay.evaluatingBoth": "Evaluando jugadas de ambos jugadores…",
    "overlay.evaluatingYours": "Evaluando tu jugada…",
    "overlay.difficultyWait": "Dificultad {label} · suele tardar unos segundos",
    "overlay.progressLabel": "{pct}% · {elapsed} s",
    "overlay.searchingNext": "Buscando próxima posición…",
    "analysis.metrics.zero": "Totales: 0 | Analizadas: 0 | Detectadas: 0",
    "analysis.metrics.engineer": "Posiciones totales: {total} | Posiciones analizadas: {done} | Posiciones con un error mayor al umbral: {detected}",
    "analysis.progressLabel": "{pct}% ({done}/{total}){extra}",
    "analysis.extra.detectedRepeated": "Posición detectada (repetida)",
    "analysis.extra.evaluatingCandidate": "Evaluando {ordinal}/{total}",
    "analysis.extra.detected": "Posición detectada",
    "analysis.extra.searchingError": "Buscando un error",
    "analysis.extra.finished": "Búsqueda finalizada",
    "analysis.extra.cancelled": "Búsqueda cancelada",
    "analysis.status.reused": "Posición detectada ({count}). Se reutiliza una partida por falta de alternativas.",
    "analysis.status.candidate": "Analizando candidata {ordinal}/{total}. Detectadas: {detected}.",
    "analysis.status.ready": "Posición detectada ({count}). Podés jugar.",
    "analysis.status.continuity": "Posición detectada ({count}). Se priorizó seguir con la sesión.",
    "analysis.status.noFresh": "Posición detectada ({count}). No quedaban partidas nuevas con errores para entrenar.",
    "analysis.status.noMore": "No quedan más posiciones con errores para entrenar.",
    "analysis.status.prepareBase": "Preparando las partidas de {provider}…",
    "analysis.status.prepareEngine": "Preparando el motor de análisis…",
    "analysis.status.localEngineNotice": "El motor fuerte todavía no está listo: por ahora se usa el de respaldo, que analiza menos a fondo.",
    "analysis.status.shuffle": "Barajando {games} partidas y buscando la primera posición para {player}…",
    "analysis.status.firstReady": "Primera posición detectada. Ya podés jugar.",
    "analysis.status.failed": "Algo salió mal al analizar tus partidas. Probá de nuevo.",
    "analysis.status.roundError": "No pudimos evaluar la jugada. Intentá de nuevo; si se repite, recargá la página.",
    "provider.readyToDownload": "Listo. Tocá “Siguiente”: las partidas se descargan recién cuando empieza la sesión.",
    "provider.baseReady": "Base lista para {username}.{warning}",
    "provider.sourceLoaded": "Fuente: {provider} ({username}) | {games} {games?partida cargada|partidas cargadas}.{warning}",
    "provider.modeChangedRedownload": "Cambiaste el modo. Las partidas se descargarán de nuevo al empezar.",
    "provider.enterLichessContinue": "Ingresá un usuario de Lichess para continuar.",
    "provider.enterChesscomContinue": "Ingresá un usuario de Chess.com para continuar.",
    "provider.protocolLichess": "Se descargan partidas públicas del último año. Primero {preferred}; si no llegan a {minSlowGames}, se completa con Blitz y, si todavía faltan, con Bullet (no es lo ideal) hasta {maxGames}.",
    "provider.protocolChesscom": "Se descargan partidas públicas del último año desde los archivos mensuales. Primero {preferred}; si no llegan a {minSlowGames}, se completa con Blitz y, si todavía faltan, con Bullet (no es lo ideal) hasta {maxGames}.",
    "provider.downloadingFor": "Descargando para {user}. {protocol}",
    "provider.searchingUpTo": "Buscando hasta {max} {max?partida|partidas} de {user}: primero {preferred} (últimos 12 meses)…",
    "provider.completingBlitz": "Descargamos {count} {count?partida|partidas} de ritmo {preferred}. Completando con Blitz ({remaining?falta|faltan} {remaining})…",
    "provider.bulletContextStillShort": "{user} no tiene suficientes partidas en {preferred}; tampoco alcanza con Blitz",
    "provider.bulletContextNoBlitz": "{user} no tiene suficientes partidas en {preferred} ni Blitz",
    "provider.bulletAttempt": "Advertencia: {context}. Intentando completar con Bullet ({remaining?falta|faltan} {remaining})…",
    "provider.bulletCompleted": "Advertencia: {context}. Completamos con Bullet, pero no es ideal.",
    "provider.readyBullet": "{warning} Listo: {total} {total?partida|partidas} de {user}: {slow} de ritmo {preferred} + {blitz} de Blitz + {bullet} de Bullet (como complemento).",
    "provider.readyBlitz": "Listo: {total} {total?partida|partidas} de {user}: {slow} de ritmo {preferred} + {blitz} de Blitz (como complemento).",
    "provider.readyPreferred": "Listo: {total} {total?partida|partidas} de {user} de ritmo {preferred}.",
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
    "buttons.revealBest": "Best move",
    "buttons.revealGame": "Move of the game",
    "buttons.revealPlayedBy": "{name} played",
    "buttons.revealYourGame": "Your game",
    "buttons.exploreBoard": "Explore board",
    "buttons.resetAnalysis": "Back to the position",
    "buttons.nextPosition": "Next position",
    "buttons.backToMenu": "Back to start",
    "buttons.skipMove": "Skip (0 pts)",
    "play.title": "Training",
    "play.exit": "Exit",
    "play.exit.aria": "Leave the session",
    "play.dots.aria": "Session progress",
    "play.score.label": "Points",
    "play.score.aria": "Session score",
    "play.duel.aria": "Duel score",
    "play.sound.aria": "Sound",
    "play.sound.on": "Sound on",
    "play.sound.off": "Sound off",
    "play.board.region": "Board and actions",
    "play.panel.aria": "Coach",
    "play.scroll.aria": "Coach notes",
    "play.dock.round": "Round actions",
    "play.skip.aria": "Skip this position for 0 points",
    "play.position": "Position {current} of {total}",
    "play.finish": "See the summary",
    "play.summary.back": "Back to the summary",
    "play.turn.duel": "{player} plays {side}",
    "play.side.white": "White",
    "play.side.black": "Black",
    "play.handoff.eyebrow": "{name} has played",
    "play.handoff.cta": "Tap to start",
    "play.expand": "Show the full analysis",
    "play.collapse": "Back to the board",
    "play.key.next": "Next",
    "play.key.explore": "Explore",
    "play.key.best": "Best",
    "play.key.master": "Master",
    "buttons.cancelSearch": "Cancel search",
    "confirm.restartTitle": "Go back to the start?",
    "confirm.restartToSetup": "What you have answered so far ({answered}) stays saved in your progress and your notebook, but you will not see this session's summary. Go back to the start anyway?",
    "confirm.restartToSetup.unsaved": "Your browser is not saving your progress, so what you have answered so far ({answered}) may be lost if you go back to the start, and you will not see this session's summary either. Go back to the start anyway?",
    "confirm.restartToSetup.none": "You have not answered any position yet, so nothing is lost. Go back to the start?",
    "confirm.restartAccept": "Back to start",
    "confirm.restartCancel": "Keep playing",
    "wizard.title": "Guided setup",
    "wizard.heading": "Build your session in 3 steps",
    "wizard.stepIndicator": "Step {step} of {total}",
    "wizard.step1.question": "How do you want to play?",
    "wizard.step1.ariaLabel": "Game mode",
    "wizard.step1.solo": "Play solo",
    "wizard.step1.duel": "Play against someone",
    "wizard.step1.duelHint": "You take turns on this same device",
    "wizard.step1.duelExplainer": "You will share this device: each of you plays your turn and you compare scores at the end.",
    "wizard.step1.player1Label": "Player 1 name",
    "wizard.step1.player2Label": "Player 2 name",
    "wizard.step2.question": "Where should we get your games from?",
    "wizard.step2.help": "We will download public games from the last year to find positions.",
    "wizard.step2.howItWorks": "How does it work?",
    "wizard.step2.howItWorksBody": "We look through your recent slow games (classical and rapid). If there are not enough, we add blitz games. We only download as many as we need to build the positions you asked for.",
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
    "wizard.step3.analysisPrompt": "Tap “Start session”. We download your games and look for your mistakes: it can take up to a minute.",
    "wizard.step3.clockNote": "This time applies to this session only. Your usual clock is changed in Settings.",
    "wizard.step3.noLimit": "No limit",
    "wizard.step3.noLimitHint": "You think without a clock in this session.",
    "wizard.step3.timerShort": "Under 30 seconds there is hardly time to think.",
    "wizard.validation.chooseMode": "Choose whether you want to play solo or against someone.",
    "wizard.validation.fillDuelNames": "Fill in both duel names.",
    "wizard.validation.duelNameMax": "Duel names can be up to 20 characters long.",
    "wizard.validation.choosePlatform": "Choose Lichess or Chess.com.",
    "wizard.validation.enterUsername": "Enter your username to continue.",
    "wizard.validation.invalidUsername": "A {provider} username has {min} to {max} characters: letters, numbers, _ or -.",
    "wizard.validation.chooseCount": "Choose a number between 1 and 200 positions.",
    "wizard.validation.ready": "Configuration is ready to start the session.",
    "wizard.status.currentStep": "Configure the current step to continue.",
    "wizard.status.answerQuestions": "Answer the questions to prepare your session.",
    "wizard.status.nextSession": "Set up your next session step by step.",
    "wizard.status.modeSourceOptions": "Configure mode, source, and analysis options.",
    "compat.gameFormat.solo": "Study mode (1 player)",
    "compat.gameFormat.duel": "Duel mode (2 players)",
    "players.default1": "Player 1",
    "players.default2": "Player 2",
    "players.targetLabel": "User to analyze",
    "players.targetHint": "We will use this user to choose positions.",
    "players.enterUserContinue": "Enter the user to continue.",
    "players.notDetected": "Not detected",
    "players.genericUser": "user",
    "labels.clockTitle": "Clock",
    "labels.clockMilestone": "{seconds} seconds remaining.",
    "labels.clockTimeUp": "Time is up.",
    "result.title": "Result",
    "result.boardToolsLabel": "Board tools",
    "scoring.system.simple.label": "Points (0 to 10)",
    "scoring.system.simple.description": "The closer your move is to the engine's best, the more points: up to 10 per position.",
    // The quality words ("quality.*") live only in js/scoring.js (see the Spanish dictionary above).
    "common.notAvailable": "Not available",
    "common.searching": "Thinking…",
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
    "piece.def.whitePawn": "the white pawn",
    "piece.def.whiteKnight": "the white knight",
    "piece.def.whiteBishop": "the white bishop",
    "piece.def.whiteRook": "the white rook",
    "piece.def.whiteQueen": "the white queen",
    "piece.def.whiteKing": "the white king",
    "piece.def.blackPawn": "the black pawn",
    "piece.def.blackKnight": "the black knight",
    "piece.def.blackBishop": "the black bishop",
    "piece.def.blackRook": "the black rook",
    "piece.def.blackQueen": "the black queen",
    "piece.def.blackKing": "the black king",
    "promotion.chooseTitle": "Choose the promotion piece",
    "common.sourceError": "We could not get the games. Try again in a little while.",
    "network.responseTooLarge": "The response from {provider} is too large and we rejected it for safety. Try again later.",
    "download.error.notFound": "We could not find {user} on {provider}. Check how the username is spelled or try the other platform.",
    "download.error.noGames": "{user} has no public games from the last 12 months on {provider}. Try another user or the other platform.",
    "download.error.rateLimited": "{provider} asked us to slow down. We will try again automatically in {seconds} {seconds?second|seconds}.",
    "download.error.rateLimitedNow": "{provider} asked us to slow down. Try again in a little while.",
    "download.error.server": "{provider} is not answering properly right now (error {status}). Try again in a few minutes.",
    "download.error.offline": "You seem to be offline. Connect and try again.",
    "download.error.network": "We could not reach {provider}. Check your connection and try again.",
    "download.error.timeout": "{provider} took too long to answer. Try again in a moment.",
    "download.error.malformed": "We could not read the games {provider} sent. Try again later or try the other platform.",
    "download.error.unknown": "Something went wrong while getting the games. Try again.",
    "download.error.consentUnavailable": "We could not show the privacy confirmation, so nothing was downloaded. Reload the page and try again.",
    "download.retry": "Try again",
    "download.cancel": "Cancel",
    "download.elapsed": "We have been working for {seconds} s. Getting a year of games can take up to a minute.",
    "download.elapsedLong": "{seconds} s so far. It is still running: {provider} is sometimes slow. You can cancel at any time.",
    "download.cancelled": "You canceled the download. Nothing was saved.",
    "download.cancelledSearch": "You canceled the search.",
    "download.lastUser": "Username remembered in this browser. It is removed with “Clear saved game data”.",
    "privacy.remoteFetchConfirm": "We are going to ask {provider} for the public games of {user}. The request goes straight from your browser to that site: this app has no server of its own. We keep those games and your username in this browser for up to 7 days so we do not download them again; you can delete them with “Clear saved game data”. If you train with them, your profile also keeps the players' names and the link to each game; you can delete that from Account. On a shared computer, someone else could see them. Continue?",
    "privacy.remoteFetchCancelled": "Request canceled. No data was sent to {provider}.",
    "privacy.remoteFetchTitle": "Fetch public games",
    "privacy.remoteFetchAccept": "Accept",
    "privacy.remoteFetchCancel": "Cancel",
    "privacy.remoteFetchUsernameLabel": "Retype the username to confirm",
    "privacy.remoteFetchUsernameMismatch": "The username does not match. Type it exactly to confirm.",
    "provider.usingCachedBase": "Using the saved {provider} base for {user}: {games} {games?game|games}.",
    "provider.throttleWait": "Please wait {seconds} {seconds?second|seconds} before downloading again, so we do not overload the service.",
    "provider.throttleHourly": "Games were already downloaded {max} times in the last hour. Try again in about {minutes} {minutes?minute|minutes}.",
    "provider.usingStaleCachedBase": "Could not refresh the base. Using the last saved {provider} base for {user}: {games} {games?game|games}.",
    "time.classical": "Classical",
    "time.rapid": "Rapid",
    "time.daily": "Daily",
    "time.blitz": "Blitz",
    "time.bullet": "Bullet",
    "evaluation.timeoutZeroPts": "Time ran out: 0 pts.",
    "evaluation.noMoveMadeZeroPts": "You did not play a move: 0 pts.",
    "evaluation.bestPrefix": "Best: {san}",
    "evaluation.gamePrefix": "Game: {san}",
    "game.searchingNext": "Searching for the next position…",
    "game.positionFound": "Position found",
    "game.handoff.genericTitle": "Turn change",
    "game.handoff.genericSubtitle": "Tap to reveal",
    "game.handoff.title": "Pass the device to {player}",
    "game.handoff.subtitle": "Tap to see the position and start your clock. {other}'s move stays hidden.",
    "game.ready.title": "{player}, get ready",
    "game.ready.subtitle": "Pass the device to {player}, who goes first this time. {other} waits without looking. The clock starts when you tap the screen.",
    "play.ready.eyebrow": "Position {current} of {total}",
    "game.positionMeta": "{players} · Result {result} · Move {move} · Year {year}",
    "game.turnWhite": "White to move",
    "game.turnBlack": "Black to move",
    "game.duelHint": "Competitive local mode: both players get exactly the same positions and time.",
    "game.soloHint": "Individual training with total accumulated score.",
    "game.studyMode": "Solo",
    "game.localDuel": "Duel ({a} vs {b})",
    "game.summaryMode": "Mode",
    "game.summaryPlatform": "Platform",
    "game.summaryUser": "User",
    "game.summaryPositions": "Positions",
    "game.summaryRoundTime": "Round time",
    "game.result.positionSolved": "Position solved!",
    "game.comparison.tie": "Comparison: tie.",
    "game.comparison.advantage": "Comparison: edge for {player}.",
    "game.finalScoreSolo": "Final score: {score}",
    "game.finalDraw": "Final result: draw.",
    "game.finalWinner": "Winner: {player}.",
    "game.finalMatchScore": "Final score: {p1} {s1} - {s2} {p2}. {winner}",
    "game.sessionDone": "Session finished!",
    "game.noMorePositions": "No more positions were found.",
    "game.searchCancelled": "Search canceled. You can look for the next position whenever you want.",
    "game.sessionHintCitizen": "Session target: {target} positions. Found: {detected}.",
    "game.sessionHintEngineer": "Session target: {target} positions. Scoring: {system}. Found so far: {detected}. Analyzed: {analyzed}/{total}.",
    "overlay.evaluatingBoth": "Evaluating both players' moves…",
    "overlay.evaluatingYours": "Evaluating your move…",
    "overlay.difficultyWait": "Difficulty {label} · usually takes a few seconds",
    "overlay.progressLabel": "{pct}% · {elapsed} s",
    "overlay.searchingNext": "Searching for the next position…",
    "analysis.metrics.zero": "Totals: 0 | Analyzed: 0 | Found: 0",
    "analysis.metrics.engineer": "Total positions: {total} | Analyzed positions: {done} | Positions with a mistake above the threshold: {detected}",
    "analysis.progressLabel": "{pct}% ({done}/{total}){extra}",
    "analysis.extra.detectedRepeated": "Position found (repeated)",
    "analysis.extra.evaluatingCandidate": "Evaluating {ordinal}/{total}",
    "analysis.extra.detected": "Position found",
    "analysis.extra.searchingError": "Looking for a mistake",
    "analysis.extra.finished": "Search finished",
    "analysis.extra.cancelled": "Search canceled",
    "analysis.status.reused": "Position found ({count}). Reusing a game because there are no alternatives.",
    "analysis.status.candidate": "Analyzing candidate {ordinal}/{total}. Found: {detected}.",
    "analysis.status.ready": "Position found ({count}). You can play now.",
    "analysis.status.continuity": "Position found ({count}). We kept the session going.",
    "analysis.status.noFresh": "Position found ({count}). There were no more fresh games with mistakes to train.",
    "analysis.status.noMore": "There are no more positions with mistakes to train.",
    "analysis.status.prepareBase": "Preparing the games from {provider}…",
    "analysis.status.prepareEngine": "Getting the analysis engine ready…",
    "analysis.status.localEngineNotice": "The strong engine is not ready yet: the backup one is being used for now, and it looks less deeply.",
    "analysis.status.shuffle": "Shuffling {games} games and looking for the first position for {player}…",
    "analysis.status.firstReady": "First position found. You can start playing now.",
    "analysis.status.failed": "Something went wrong while analyzing your games. Try again.",
    "analysis.status.roundError": "We could not evaluate the move. Try again; if it keeps happening, reload the page.",
    "provider.readyToDownload": "Looks good. Tap “Next”: games are only downloaded when the session starts.",
    "provider.baseReady": "Base ready for {username}.{warning}",
    "provider.sourceLoaded": "Source: {provider} ({username}) | {games} {games?game|games} loaded.{warning}",
    "provider.modeChangedRedownload": "You changed the mode. The games will be downloaded again when you start.",
    "provider.enterLichessContinue": "Enter a Lichess username to continue.",
    "provider.enterChesscomContinue": "Enter a Chess.com username to continue.",
    "provider.protocolLichess": "Public games from the last year are downloaded. First {preferred}; if there are fewer than {minSlowGames}, Blitz is added and, if that is still not enough, Bullet (not ideal) up to {maxGames}.",
    "provider.protocolChesscom": "Public games from the last year are downloaded from the monthly archives. First {preferred}; if there are fewer than {minSlowGames}, Blitz is added and, if that is still not enough, Bullet (not ideal) up to {maxGames}.",
    "provider.downloadingFor": "Downloading for {user}. {protocol}",
    "provider.searchingUpTo": "Looking for up to {max} {max?game|games} by {user}: first {preferred} (last 12 months)…",
    "provider.completingBlitz": "Downloaded {count} {count?game|games} ({preferred}). Filling up with Blitz ({remaining} to go)…",
    "provider.bulletContextStillShort": "{user} does not have enough games in {preferred}; Blitz is still not enough",
    "provider.bulletContextNoBlitz": "{user} does not have enough games in {preferred} or Blitz",
    "provider.bulletAttempt": "Warning: {context}. Trying to fill up with Bullet ({remaining} to go)…",
    "provider.bulletCompleted": "Warning: {context}. We filled with Bullet, but it is not ideal.",
    "provider.readyBullet": "{warning} Ready: {total} {total?game|games} from {user}: {slow} {preferred} + {blitz} Blitz + {bullet} Bullet (as a top-up).",
    "provider.readyBlitz": "Ready: {total} {total?game|games} from {user}: {slow} {preferred} + {blitz} Blitz (as a top-up).",
    "provider.readyPreferred": "Ready: {total} {total?game|games} from {user} ({preferred}).",
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
    // The router sets document.title from the shared dictionary, and the two legacy screens live in app.js's own one.
    "core.title.play": "Entrenamiento",
    "core.title.setup": "Configuración guiada",
    "core.hint.next.1": "Pista: la pieza (-{pct}%)",
    "core.hint.next.2": "Pista: la casilla (-{pct}%)",
    "core.hint.next.3": "Mostrar la jugada (0 pts)",
    "core.hint.done": "Jugada revelada",
    "core.hint.said.1": "Pista: mové {pieceDef} de {square}. Cuesta el {pct}% de los puntos.",
    "core.hint.said.2": "Pista: mové {pieceDef} de {from} a {to}. Cuesta el {pct}% de los puntos.",
    "core.hint.confirm": "Tocá de nuevo para ver la jugada: esta posición vale 0 puntos.",
    "core.hint.confirmLabel": "Tocá de nuevo: 0 pts",
    "core.skip.confirm": "Tocá de nuevo para saltear esta posición: vale 0 puntos.",
    "core.skip.confirmLabel": "Tocá de nuevo para saltear",
    "core.move.confirm": "Confirmar jugada",
    "core.move.confirmSan": "Confirmar {san}",
    "core.move.pending": "Elegiste {san}. Confirmala o elegí otra casilla.",
    "core.clock.resumed": "El reloj sigue: te quedan {seconds} segundos.",
    "core.clock.resumed.one": "El reloj sigue: te queda 1 segundo.",
    "core.firstRun.note": "Tocá una pieza y después su casilla. No se puntúa nada hasta que muevas. Esta primera sesión no tiene reloj.",
    "core.unsaved.blocked": "Esta sesión no se guardó: el navegador no deja guardar datos en este sitio (¿una pestaña privada?). Tu progreso se pierde al cerrar la pestaña.",
    "core.unsaved.quota": "Es posible que esta sesión no se haya guardado: el almacenamiento del navegador está lleno. Descargá una copia desde Cuenta y liberá espacio para seguir guardando.",
    "core.resume.title": "Sesión interrumpida",
    "core.resume.body": "Dejaste a medias “{title}”: respondiste {answered} de {total} posiciones. {saved} ¿Seguís con {left}?",
    "core.resume.left": "las {remaining} que faltan",
    "core.resume.left.one": "la que falta",
    "core.resume.saved": "Eso ya está guardado en tu progreso.",
    "core.resume.unsaved.blocked": "Pero no se guardó: este navegador no deja guardar datos en este sitio (¿una pestaña privada?), así que lo que respondiste solo se conserva en esta pestaña mientras siga abierta.",
    "core.resume.unsaved.quota": "Pero es posible que no se haya guardado: el almacenamiento del navegador está lleno. Descargá una copia desde Cuenta y liberá espacio.",
    "core.resume.continue": "Seguir",
    "core.resume.discard": "Ahora no",
    "core.resume.note": "Tu última sesión se interrumpió. Respondiste {answered} de {total}. {saved}",
    "core.resume.failed": "No pudimos retomar la sesión interrumpida. Podés empezar una nueva desde el inicio.",
    "core.start.failed": "No pudimos empezar la sesión. Probá de nuevo; si se repite, volvé al inicio y elegí otra opción.",
    "core.engine.unsupported": "Este navegador no puede usar el motor fuerte: analizamos con uno más simple, que mira menos a fondo.",
    "core.engine.offline": "Sin conexión: por ahora analizamos con el motor de respaldo, que mira menos a fondo.",
    "core.engine.downloading": "Descargando el motor de análisis: {pct}%",
    "core.engine.slow": "El motor fuerte está tardando en llegar: seguimos con el de respaldo y la descarga sigue en segundo plano.",
    "core.sound.on": "Sonido activado (queda guardado)",
    "core.sound.off": "Sonido desactivado (queda guardado)",
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
    "core.toast.achievements": "Logros desbloqueados: {names}",
    "core.toast.achievementsMany": "{n} logros desbloqueados",
    "core.session.own": "Tus partidas: {user}",
    "core.wizard.heading.2": "Armemos tu sesión en 2 pasos",
    "core.session.default.own": "Tus partidas",
    "core.session.default.classic": "Partidas clásicas",
    "core.session.default.review": "Repaso de errores",
    "core.session.default.daily": "Desafío del día",
  },
  en: {
    "core.title.play": "Training",
    "core.title.setup": "Guided setup",
    "core.hint.next.1": "Hint: the piece (-{pct}%)",
    "core.hint.next.2": "Hint: the square (-{pct}%)",
    "core.hint.next.3": "Show the move (0 pts)",
    "core.hint.done": "Move revealed",
    "core.hint.said.1": "Hint: move {pieceDef} on {square}. It costs {pct}% of the points.",
    "core.hint.said.2": "Hint: move {pieceDef} from {from} to {to}. It costs {pct}% of the points.",
    "core.hint.confirm": "Tap again to see the move: this position is worth 0 points.",
    "core.hint.confirmLabel": "Tap again: 0 pts",
    "core.skip.confirm": "Tap again to skip this position: it is worth 0 points.",
    "core.skip.confirmLabel": "Tap again to skip",
    "core.move.confirm": "Confirm move",
    "core.move.confirmSan": "Confirm {san}",
    "core.move.pending": "You chose {san}. Confirm it or choose another square.",
    "core.clock.resumed": "The clock is running again: {seconds} seconds left.",
    "core.clock.resumed.one": "The clock is running again: 1 second left.",
    "core.firstRun.note": "Tap a piece, then its square. Nothing is scored until you move. This first session has no clock.",
    "core.unsaved.blocked": "This session was not saved: your browser does not let this site store data (a private tab?). Your progress is lost when you close the tab.",
    "core.unsaved.quota": "This session may not have been saved: browser storage is full. Download a copy from Account and free some space to keep saving.",
    "core.resume.title": "Interrupted session",
    "core.resume.body": "You left “{title}” halfway: you answered {answered} of {total} positions. {saved} Do you want to continue with {left}?",
    "core.resume.left": "the {remaining} that are left",
    "core.resume.left.one": "the one that is left",
    "core.resume.saved": "That is already saved in your progress.",
    "core.resume.unsaved.blocked": "But it was not saved: this browser does not let this site store data (a private tab?), so what you answered is only kept in this tab while it stays open.",
    "core.resume.unsaved.quota": "But it may not have been saved: browser storage is full. Download a copy from Account and free some space.",
    "core.resume.continue": "Continue",
    "core.resume.discard": "Not now",
    "core.resume.note": "Your last session was interrupted. You answered {answered} of {total}. {saved}",
    "core.resume.failed": "We could not pick the interrupted session back up. You can start a new one from the start.",
    "core.start.failed": "We could not start the session. Try again; if it keeps happening, go back to the start and pick another option.",
    "core.engine.unsupported": "This browser cannot run the strong engine: we analyze with a simpler one, which looks less deeply.",
    "core.engine.offline": "You are offline: for now we analyze with the backup engine, which looks less deeply.",
    "core.engine.downloading": "Downloading the analysis engine: {pct}%",
    "core.engine.slow": "The strong engine is slow to arrive: we continue with the backup one and the download keeps going in the background.",
    "core.sound.on": "Sound on (saved)",
    "core.sound.off": "Sound off (saved)",
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
    "core.toast.achievements": "Achievements unlocked: {names}",
    "core.toast.achievementsMany": "{n} achievements unlocked",
    "core.session.own": "Your games: {user}",
    "core.wizard.heading.2": "Build your session in 2 steps",
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
  // Same rule as Ludus.i18n (js/ludus.js): the first Spanish or English entry of the
  // browser's list wins, and a browser that asks for neither (French, German,
  // Portuguese...) gets English: only a Spanish-speaking browser gets Spanish.
  for (const entry of browserLanguages) {
    const code = String(entry || "").toLowerCase();
    if (code === "es" || code.startsWith("es-") || code.startsWith("es_")) return "es";
    if (code === "en" || code.startsWith("en-") || code.startsWith("en_")) return "en";
  }
  return "en";
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

// polish-play (PL-6): a move (the stored English SAN) as the person reads it, which follows the notation setting (Ludus.chess.localizeSan),
// or, with `spoken`, as a screen reader says it in words (Ludus.chess.spokenSan). Without js/chess.js the stored text is shown.
function sanForPerson(san, spoken) {
  if (typeof san !== "string" || !san) return san;
  const chess = ludusModule("chess");
  try {
    const convert = chess ? (spoken ? chess.spokenSan : chess.localizeSan) : null;
    return typeof convert === "function" ? convert(san, STATE.language) : san;
  } catch (error) {
    return san;
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

// Returns the toast's handle (something to dismiss it with), or null when none was shown.
function showToast(message, options = {}) {
  const ui = ludusModule("ui");
  try {
    if (ui && typeof ui.toast === "function" && message) return ui.toast(message, options) || null;
  } catch (error) {
    // A toast is a courtesy, never a failure.
  }
  return null;
}


function normalizeTurnTimeSeconds(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_TURN_TIME_SECONDS;
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : fallback;
  return clamp(Math.round(safeValue), MIN_TURN_TIME_SECONDS, MAX_TURN_TIME_SECONDS);
}

// The usual turn time is a setting ("clock.seconds" in Ludus.Settings, which also migrated the
// legacy "ludus.setup.v1" key once); the wizard starts from it and only reads it (what a wizard
// chooses is for its own session). Without Settings (a broken load) the default keeps it usable.
function loadSetupPreference() {
  return { turnTimeSeconds: normalizeTurnTimeSeconds(settingsGet("clock.seconds", DEFAULT_TURN_TIME_SECONDS)) };
}

// When enabled, a downloaded PGN base is kept only in STATE for the current
// session and never written to IndexedDB, so it does not outlive the tab.
// The toggle lives in Settings > Privacy (js/ui/settings.js) through Ludus.game.savedDownloads.
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

// "{name}" is replaced by the parameter; "{name?one|other}" picks a plural form by the
// numeric value of that parameter (exactly 1 is "one"), so a count never reads "1 partidas" or
// "game(s)" and the parameters stay plain numbers (a message kept for a language switch
// is drawn again in the other language from the same numbers).
function interpolate(text, params = {}) {
  return String(text || "")
    // A form may carry plain {name} tokens ("{n?1 minuto|unos {n} minutos}"): the second pass below fills them in.
    .replace(/\{(\w+)\?((?:[^|{}]|\{\w+\})*)\|((?:[^{}]|\{\w+\})*)\}/g, (_, key, one, other) => (Number(params[key]) === 1 ? one : other))
    .replace(/\{(\w+)\}/g, (_, key) => {
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

// Neutral like the profile's own default ("Participante"): "Jugador" was the masculine generic (CNT-035). The English default
// ("Player 1") comes from the dictionary; these are what the state holds before a language is applied.
const DUEL_DEFAULT_PLAYERS = ["Participante 1", "Participante 2"];
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
  // A move chosen and waiting for "Confirm move" (board.confirmMove), and when a hint was last asked for.
  pendingMove: null,
  lastHintAt: 0,
  userMove: null,
  score: 0,
  // The strong engine (Ludus.Engine over a Worker) once it is up; until then, or
  // after it fails, the shallow local search answers (see analyzePosition).
  engine: { mode: "local", instance: null, ready: false },
  // Where the strong engine stands: idle | loading | ready | failed | unsupported (this browser cannot run it);
  // whether its file is in the browser's cache, how far the download got, and how many times it has died this page.
  engineStatus: "idle",
  engineFilesReady: false,
  engineDownload: { loaded: 0, total: 0, ratio: 0, at: 0, state: "idle" },
  engineFailures: 0,
  // analyzePosition(): finished results, the requests still running, and the
  // counter that cancels everything started before it (new session, leaving).
  analysis: { cache: new Map(), inflight: new Map(), generation: 0 },
  boardPerspective: "w",
  keyboardFocusSquare: null,
  revealed: { best: null, game: null, user: null, userAlt: null },
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
  // Consent given in this page, per "provider|username" (see consentKey).
  remoteConsent: {},
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
    // The clock of the session the wizard is building ("timed" | "untimed"): starts from the setting, changes only this session.
    clockMode: settingsGet("clock.mode", "timed") === "untimed" ? "untimed" : "timed",
    sourceError: null,
  },
  // The round clock. intervalId is the handle of the pending tick (null when no clock is
  // counting down: untimed, stopped, or paused while the page is hidden); the time the page
  // spends hidden is paused, not spent (pausedMs is what a round has been paused in total).
  timer: {
    intervalId: null,
    running: false,
    paused: false,
    deadlineMs: 0,
    durationMs: 0,
    lastAnnouncedSeconds: null,
    pausedAt: 0,
    remainingAtPause: 0,
    pausedMs: 0,
    roundHiddenAt: 0,
  },
  ui: {
    phase: "playing",
    // What the layout shows (data-phase of #game-layout): thinking | evaluating | handoff | result | summary.
    gamePhase: "thinking",
    lastShownScore: 0,
    summaryModel: null,
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
    // The engine line being stepped ({ line, ply }), the round reopened from the summary
    // ({ index, summary }) and which of the two moves the dock has drawn on the board.
    pv: null,
    review: null,
    shown: { best: false, game: false },
  },
  duel: {
    players: [...DUEL_DEFAULT_PLAYERS],
    scores: [0, 0],
    hits: [0, 0],
    // Who is playing now (0 or 1: the identity of the player, whose name, score and profile they are) and who plays
    // first in this position. The players take turns going first (PF-2): the second one to move has watched the
    // position while the first one's clock ran, and that advantage must not always be the same person's.
    currentPlayer: 0,
    firstPlayer: 0,
    // 0 or 1: a rematch flips it, so with an odd number of positions the same person does not go first once more every time.
    startOffset: 0,
    roundResults: [null, null],
    handoffReady: false,
    // The cover of a new duel position is up and the first player's clock has not started yet.
    readyWait: false,
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
    // The field takes what a profile's name may have (the markup says the same number before the script runs).
    inputEl.setAttribute("maxlength", String(playerNameMax()));
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

// The name the wizard will use: what is typed, without an "@" and as a profile address would give it (normalizeRemoteUsername).
function getConfiguredRemoteUsername() {
  return normalizeRemoteUsername(onlineUserInputEl ? onlineUserInputEl.value : "");
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

// How many letters a duel player's name keeps: as many as a profile's name may have (Profile.constants.NAME_MAX), so the name of
// a profile that plays is never cut in silence (RC-2). 24 is the same number, for a page without the profile module.
function playerNameMax() {
  const profile = ludusModule("Profile");
  const max = profile && profile.constants ? Number(profile.constants.NAME_MAX) : NaN;
  return Number.isFinite(max) && max >= 1 ? Math.floor(max) : 24;
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
  if (STATE.session && STATE.session.kind === "own") return t("buttons.revealYourGame");
  return t("buttons.revealPlayedBy", { name: gameMoveAuthorName() });
}

function currentUiPlayerIndex() {
  if (!isDuelMode()) return 0;
  return STATE.duel.currentPlayer === 1 ? 1 : 0;
}

// The players of a duel take turns going first (PF-2): position 1 starts the first player, position 2 the second one, and
// so on. Whoever goes second has watched the position while the other's clock ran, so the advantage is shared.
function duelFirstPlayerFor(index) {
  const offset = STATE.duel.startOffset === 1 ? 1 : 0;
  return (Math.abs(Math.round(Number(index) || 0)) + offset) % 2 === 0 ? 0 : 1;
}

// The player who moves second in the position on screen.
function duelSecondPlayer() {
  return STATE.duel.firstPlayer === 1 ? 0 : 1;
}

function initialsFromName(value, fallback = "P") {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return fallback;
  const bits = cleaned.split(" ").filter(Boolean);
  const letters = bits.slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  return letters || fallback;
}

function setUiPhase(phase, blockBoardInput = false) {
  STATE.ui.phase = String(phase || "playing");
  STATE.ui.blockBoardInput = Boolean(blockBoardInput);
  syncGamePhase();
}

function showHandoffOverlay(title, subtitle, extra = {}) {
  if (!handoffOverlayEl) return;
  STATE.ui.handoffState = {
    title: title || t("game.handoff.genericTitle"),
    subtitle: subtitle || t("game.handoff.genericSubtitle"),
    avatar: extra.avatar || "",
    eyebrow: extra.eyebrow || "",
  };
  STATE.ui.handoffReturnFocusEl = document.activeElement || null;
  if (handoffOverlayTitleEl) handoffOverlayTitleEl.textContent = STATE.ui.handoffState.title;
  if (handoffOverlaySubtitleEl) handoffOverlaySubtitleEl.textContent = STATE.ui.handoffState.subtitle;
  if (handoffOverlayAvatarEl) handoffOverlayAvatarEl.textContent = STATE.ui.handoffState.avatar;
  if (handoffOverlayEyebrowEl) handoffOverlayEyebrowEl.textContent = STATE.ui.handoffState.eyebrow;
  handoffOverlayEl.classList.remove("hidden");
  syncGamePhase();
  requestAnimationFrame(() => {
    handoffOverlayEl.focus();
  });
}

function hideHandoffOverlay() {
  if (!handoffOverlayEl) return;
  STATE.ui.handoffState = null;
  handoffOverlayEl.classList.add("hidden");
  syncGamePhase();
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
  // A wait of one to four seconds does not need four announcements: the title of the overlay is
  // announced once when it opens (showPositionSearchOverlay), and the progress bar is a
  // progressbar (aria-valuenow) for anyone who goes to look at it.
  const state = STATE.ui.positionSearchState;
  if (state) state.announcedProgressStep = Math.min(4, Math.floor(pct / POSITION_SEARCH_PROGRESS_MILESTONE_STEP));
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
  const wasShowing = positionSearchOverlayEl && !positionSearchOverlayEl.classList.contains("hidden");
  positionSearchOverlayEl.classList.remove("hidden");
  // The overlay itself is not a live region (every progress update would read its whole card out
  // again): its title is said once, when it opens.
  if (!wasShowing) announcePlay(STATE.ui.positionSearchState.title || t("game.searchingNext"));
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
  STATE.resultView.shown = { best: false, game: false };
  renderBoard();
  syncRevealButtons();
}

function captureResultSnapshot(fen) {
  STATE.resultView.snapshotFen = String(fen || "");
  STATE.resultView.snapshotRevealed = snapshotRevealedState(STATE.revealed);
}

// The dock under the board switches between the round's actions (hint, skip) and,
// once the answer is in, the tools that act on the board. This keeps both in step
// with the result and with the exploration mode.
function updateResultAnalysisControls() {
  const visible = Boolean(STATE.resultView.visible);
  const analysisMode = Boolean(STATE.resultView.analysisMode);
  if (resultOverlayEl) resultOverlayEl.classList.toggle("analysis-mode", analysisMode);
  if (resultAnalysisBtn) {
    resultAnalysisBtn.disabled = !visible || analysisMode;
    resultAnalysisBtn.classList.toggle("hidden", analysisMode);
    resultAnalysisBtn.setAttribute("aria-pressed", analysisMode ? "true" : "false");
  }
  if (resultAnalysisLabelEl) resultAnalysisLabelEl.textContent = t("buttons.exploreBoard");
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

// Back to the position of the result. The stepper of the engine lines is redrawn
// collapsed, and the panel keeps its scroll.
function resetResultAnalysisBoard() {
  if (!STATE.resultView.visible || !STATE.resultView.snapshotFen) return;
  if (STATE.resultView.analysisMode) setUiPhase("result_analysis", false);
  STATE.resultView.pv = null;
  applyResultSnapshotToBoard();
  updateResultAnalysisControls();
  renderResultViewContext();
}

// Coach panel -> board: shows the position after `ply` moves of an engine line (0 =
// the position of the round). Stepping is exploration: the board then also takes the
// person's own moves from that point on (the same mode as "Explore board").
function stepEngineLine(lineIndex, ply) {
  const context = STATE.resultView.context;
  const line = context && Array.isArray(context.lines) ? context.lines[lineIndex] : null;
  const fen = STATE.resultView.snapshotFen;
  if (!line || !fen || !Array.isArray(line.pvUci)) return;
  const plies = clamp(Math.round(Number(ply) || 0), 0, line.pvUci.length);
  const board = new Chess(fen);
  let last = null;
  for (let i = 0; i < plies; i += 1) {
    const move = uciToMove(line.pvUci[i], board);
    if (!move) break;
    board.makeMove(move);
    last = move;
  }
  STATE.resultView.pv = { line: lineIndex, ply: plies };
  STATE.resultView.analysisMode = true;
  setUiPhase("result_analysis", false);
  STATE.board = board;
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.revealed = plies > 0 && last
    ? { best: snapshotMove(last), game: null, user: null, userAlt: null }
    : snapshotRevealedState(STATE.resultView.snapshotRevealed);
  renderBoard();
  updateResultAnalysisControls();
}

// ---------- The play screen: phase, header, coach panel ----------
// #game-layout carries three attributes that css/coach.css reads: data-view (play |
// summary), data-phase (thinking | evaluating | handoff | result | summary) and data-mode
// (solo | duel). They are derived from the state in one place, so the layout cannot end
// up in a phase that no function asked for.

function currentGamePhase() {
  const context = STATE.resultView.context;
  if (STATE.resultView.visible) return context && context.kind === "session_summary" ? "summary" : "result";
  if (STATE.ui.handoffState) return "handoff";
  if (STATE.isResolvingRound) return "evaluating";
  return "thinking";
}

function syncGamePhase() {
  const phase = currentGamePhase();
  STATE.ui.gamePhase = phase;
  if (!gameLayoutEl || !gameLayoutEl.dataset) return;
  gameLayoutEl.dataset.phase = phase;
  gameLayoutEl.dataset.view = phase === "summary" ? "summary" : "play";
  gameLayoutEl.dataset.mode = isDuelMode() ? "duel" : "solo";
  // The sheet only stays open over the board while a result is being read.
  if (phase !== "result" && gameLayoutEl.dataset.expanded) setCoachExpanded(false);
}

// Phones: the coach panel is a sheet under the board; its handle opens it over the board
// (to read the whole analysis) and closes it again.
function setCoachExpanded(expanded) {
  if (!gameLayoutEl || !gameLayoutEl.dataset) return;
  if (expanded) gameLayoutEl.dataset.expanded = "true";
  else delete gameLayoutEl.dataset.expanded;
  if (coachExpandBtn) coachExpandBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (coachExpandLabelEl) coachExpandLabelEl.textContent = t(expanded ? "play.collapse" : "play.expand");
  // The board comes back at its size: the arrows are drawn again on it.
  renderBoardArrows();
}

// Tells a screen reader something without moving the focus (a polite live region).
function announcePlay(text) {
  if (!playAnnounceEl || !text) return;
  playAnnounceEl.textContent = "";
  // A change of text is what is read; clearing first makes a repeated sentence count.
  setTimeout(() => {
    playAnnounceEl.textContent = text;
  }, 30);
}

// The result of a round on screen: the live region (read out loud), then the panel.
function setResultLive(title, points) {
  if (resultOverlayTitleEl) resultOverlayTitleEl.textContent = title || t("result.title");
  if (resultOverlayPointsEl) resultOverlayPointsEl.textContent = points || "";
}

// "You earned 7.4 / 10", or why there is nothing to earn.
function roundSummaryText(answer) {
  if (!answer.uci) {
    if (answer.hintsUsed >= 3) return t("core.hint.resultRevealed");
    return answer.noMoveReason === "timeout" ? t("evaluation.timeoutZeroPts") : t("evaluation.noMoveMadeZeroPts");
  }
  return t("core.result.earned", { points: formatPoints(answer.assessment.points), max: answer.assessment.maxPoints });
}

// What the coach panel says when Ludus.Coach is not there (a module that failed to
// load must not leave the person without a result): the verdict and the notes, as text.
function renderResultFallback(context) {
  const answer = context.answers[context.answers.length - 1];
  const scoring = ludusModule("Scoring");
  const insightsApi = ludusModule("Insights");
  const notes = [];
  const assessment = answer.assessment;
  if (answer.uci && scoring) notes.push(scoring.reasonLabel(assessment.reason, STATE.language, assessment));
  if (answer.hintsUsed >= 1 && answer.hintsUsed < 3 && assessment.hintPenalty > 0) {
    notes.push(t("scoring.note.hint_penalty", { percent: Math.round((assessment.hintCost || 0) * 100) }));
  }
  if (answer.provisional) notes.push(t("core.result.provisional"));
  try {
    const messages = answer.insights && Array.isArray(answer.insights.messages) ? answer.insights.messages : [];
    if (insightsApi && messages.length) insightsApi.renderMessages(messages.slice(0, 3), STATE.language).forEach((text) => notes.push(text));
  } catch (error) {
    // Insights are decoration.
  }
  if (context.engine && context.engine.source === "local") notes.push(engineFallbackNotice());
  if (roundResultEl) roundResultEl.textContent = notes.filter(Boolean).join(" ");
  if (resultLiveEl) resultLiveEl.classList.remove("sr-only");
}

// The dock's two "show on the board" buttons for the result on screen: the move of the game
// is only offered when the position has one (a review card has none).
function prepareRevealButtons(hasGameMove) {
  if (revealBestBtn) revealBestBtn.classList.remove("hidden");
  if (revealGameBtn) revealGameBtn.classList.toggle("hidden", !hasGameMove);
  syncRevealButtons();
}

function renderSoloResultPanels(context) {
  const answer = context.answers[0];
  const coach = ludusModule("Coach");
  setResultLive(qualityLabel(answer.uci ? answer.assessment.qualityCode : "no_move"), roundSummaryText(answer));
  if (roundResultEl) roundResultEl.textContent = "";
  let drawn = false;
  if (coach && typeof coach.renderRound === "function" && roundResultEl) {
    try {
      coach.renderRound(roundResultEl, context, coachApi());
      drawn = true;
    } catch (error) {
      console.error("[Ludus] the coach panel failed to draw the result", error);
    }
  }
  if (resultLiveEl) resultLiveEl.classList.toggle("sr-only", drawn);
  if (!drawn) renderResultFallback(context);
  prepareRevealButtons(Boolean(context.master));
}

function renderDuelResultPanels(context) {
  const [first, second] = context.answers;
  const coach = ludusModule("Coach");
  const points = (answer) => answer.assessment.points;
  let winnerText = t("game.comparison.tie");
  if (points(first) > points(second)) winnerText = t("game.comparison.advantage", { player: first.name });
  if (points(second) > points(first)) winnerText = t("game.comparison.advantage", { player: second.name });
  setResultLive(t("game.result.positionSolved"), `R${context.round}: ${first.name} ${formatPoints(points(first))} · ${second.name} ${formatPoints(points(second))}. ${winnerText}`);
  if (roundResultEl) roundResultEl.textContent = "";
  let drawn = false;
  if (coach && typeof coach.renderDuel === "function" && roundResultEl) {
    try {
      coach.renderDuel(roundResultEl, context, coachApi());
      drawn = true;
    } catch (error) {
      console.error("[Ludus] the coach panel failed to draw the duel result", error);
    }
  }
  if (resultLiveEl) resultLiveEl.classList.toggle("sr-only", drawn);
  if (!drawn) renderResultFallback(context);
  prepareRevealButtons(Boolean(context.master));
}

// What the coach needs from the game besides the context: the language, the stepper
// state, and the way back to the board and to the sessions.
function coachApi() {
  let compact = false;
  let short = false;
  let sideways = false;
  let narrowSide = false;
  try {
    compact = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 719px) and (orientation: portrait)").matches;
    short = compact && window.matchMedia("(max-height: 760px)").matches;
    sideways = typeof window.matchMedia === "function" && window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
    // Board and panel side by side on a screen under 1280px: the panel is 340 to 390px wide, too narrow for the full gauge.
    narrowSide = typeof window.matchMedia === "function" && window.matchMedia("(orientation: landscape) and (min-width: 560px) and (max-width: 1279px)").matches;
  } catch (error) {
    compact = false;
    short = false;
    sideways = false;
    narrowSide = false;
  }
  return {
    // Under a board the size of a phone (upright or on its side) the gauge is smaller so the verdict fits the sheet.
    gaugeSize: compact ? (short ? 72 : 84) : sideways ? 84 : narrowSide ? 92 : 116,
    lang: STATE.language,
    pv: STATE.resultView.pv || null,
    onStep: stepEngineLine,
    onOpenRound: openSummaryRound,
    matchText: isDuelMode() ? duelMatchScoreText() : "",
  };
}

// The result on screen is drawn from STATE.resultView.context alone, so it can be
// drawn again (a language change) without recomputing anything.
function renderResultViewContext() {
  const context = STATE.resultView.context;
  if (!context) return;
  const scrollTop = coachScrollEl ? coachScrollEl.scrollTop : 0;
  // The panel holds one of two things: the analysis of a round, or the closing summary (which
  // also comes back after one of its positions was reopened).
  const summary = context.kind === "session_summary";
  if (resultOverlayInnerEl) resultOverlayInnerEl.classList.toggle("hidden", summary);
  if (sessionSummaryResultEl) sessionSummaryResultEl.classList.toggle("hidden", !summary);
  if (context.kind === "round_solo") renderSoloResultPanels(context);
  else if (context.kind === "round_duel") renderDuelResultPanels(context);
  else if (context.kind === "session_summary") renderSessionSummaryPanel(context);
  if (coachScrollEl && scrollTop) coachScrollEl.scrollTop = scrollTop;
  updateNextButton();
}

// Shows the result panel and takes the reader to it. Every path that opens the
// result goes through here, so none of them can forget that last step.
function revealResultOverlay() {
  STATE.resultView.visible = true;
  if (resultOverlayEl) resultOverlayEl.classList.remove("hidden");
  // The skeleton of the evaluating state (or the card of the position) is done with: leaving
  // it behind would keep an aria-busy region in the tree and a second .co-hero in the panel.
  if (coachThinkingEl) coachThinkingEl.textContent = "";
  syncGamePhase();
  // The clock stops with the result (and goes away with the summary).
  updateRoundTimerUi();
  bringResultIntoView();
}

function showResultOverlay() {
  STATE.resultView.analysisMode = false;
  STATE.resultView.pv = null;
  STATE.resultView.shown = { best: false, game: false };
  syncRevealButtons();
  revealResultOverlay();
  updateResultAnalysisControls();
  renderBoardArrows();
}

// Which part of the result takes the focus: the verdict of the round, or the
// closing summary once the session is over.
function resultFocusTarget() {
  const inner = roundResultEl && typeof roundResultEl.querySelector === "function" ? roundResultEl.querySelector("[data-focus]") : null;
  const summary = sessionSummaryResultEl && typeof sessionSummaryResultEl.querySelector === "function" ? sessionSummaryResultEl.querySelector("[data-focus]") : null;
  const summaryShown = sessionSummaryResultEl && !sessionSummaryResultEl.classList.contains("hidden");
  return (summaryShown ? summary : inner) || resultOverlayTitleEl || resultOverlayEl;
}

// The panel is a scroll region of its own (the page never scrolls on this screen), so
// "bring it into view" means: start it at the top and move the focus onto the verdict.
// The board has just stopped accepting moves, so a focus ring left parked there would
// strand anyone using a keyboard or a screen reader.
function bringResultIntoView() {
  const reveal = () => {
    if (!STATE.resultView.visible) return;
    if (coachScrollEl) coachScrollEl.scrollTop = 0;
    const target = resultFocusTarget();
    if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
  };
  // Deferred rather than run inline so it works on what the browser has laid out. A
  // timer and not an animation frame: animation frames do not run in a hidden tab.
  setTimeout(reveal, 0);
}

function hideResultOverlay() {
  if (!resultOverlayEl) return;
  STATE.resultView.visible = false;
  STATE.resultView.analysisMode = false;
  STATE.resultView.snapshotFen = "";
  STATE.resultView.snapshotRevealed = { best: null, game: null, user: null, userAlt: null };
  STATE.resultView.context = null;
  STATE.resultView.pv = null;
  STATE.resultView.review = null;
  STATE.resultView.shown = { best: false, game: false };
  syncRevealButtons();
  resultOverlayEl.classList.add("hidden");
  if (roundResultEl) roundResultEl.textContent = "";
  updateResultAnalysisControls();
  renderBoardArrows();
  syncGamePhase();
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
      firstPlayer: STATE.duel.firstPlayer,
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
    STATE.duel.firstPlayer = snapshot.duel.firstPlayer;
    STATE.duel.handoffReady = snapshot.duel.handoffReady;
  }
  STATE.resultView.analysisMode = false;
  setUiPhase("result", true);
  renderResultViewContext();
  revealResultOverlay();
  announcePlay(t("game.searchCancelled"));
  if (nextBtn) nextBtn.disabled = false;
  if (skipBtn) skipBtn.disabled = true;
  updateResultAnalysisControls();
  renderPlayHeader();
  renderBoardArrows();
}

function soloSessionTarget() {
  return Math.max(1, STATE.targetPositions || STATE.positions.length || 1);
}

function duelMatchScoreText() {
  const played = Math.max(0, STATE.sessionPlayed);
  const line = `${duelPlayerName(0)} ${formatPoints(STATE.duel.scores[0] || 0)} - ${formatPoints(STATE.duel.scores[1] || 0)} ${duelPlayerName(1)}`;
  return played > 0 ? `${line} ${t("core.score.duelMax", { max: played * POINTS_PER_POSITION })}` : line;
}

// Which side moves, in words, and the king that says it: the white king when White is to
// move. In a duel it also says whose turn it is.
function updateRoundTurn(playerIndex = currentUiPlayerIndex()) {
  const turn = STATE.board ? STATE.board.turn : "";
  if (roundTurnKingEl && (turn === "w" || turn === "b")) roundTurnKingEl.setAttribute("src", PIECE_IMAGES[turn === "b" ? "k" : "K"]);
  if (!roundTurnEl) return;
  if (turn !== "w" && turn !== "b") {
    roundTurnEl.textContent = "";
    return;
  }
  if (isDuelMode()) {
    const player = duelPlayerName(playerIndex === 1 ? 1 : 0);
    const sentence = t("play.turn.duel", { player, side: t(turn === "b" ? "play.side.black" : "play.side.white") });
    // polish-play (PL-3): a very long name is shortened inside the sentence, never the side to move (Ludus.Coach.renderTurn).
    const coach = ludusModule("Coach");
    if (coach && typeof coach.renderTurn === "function") coach.renderTurn(roundTurnEl, { text: sentence, name: player });
    else roundTurnEl.textContent = sentence;
    return;
  }
  roundTurnEl.textContent = t(turn === "b" ? "game.turnBlack" : "game.turnWhite");
}

// The dots of the header: one per position, coloured by how the answer went. Built from
// the answers of this session (STATE.session.rounds), never from the page.
function dotRounds() {
  const rounds = STATE.session && Array.isArray(STATE.session.rounds) ? STATE.session.rounds : [];
  return rounds.map((round) => roundView(round));
}

// The position the header talks about: the one on the board, which is the reopened one while
// the summary shows an earlier position again.
function displayedIndex() {
  const review = STATE.resultView.review;
  return review && Number.isInteger(review.index) ? review.index : STATE.index;
}

function renderPlayHeader() {
  const duel = isDuelMode();
  const total = soloSessionTarget();
  const played = Math.max(0, STATE.sessionPlayed);
  const phase = currentGamePhase();
  if (gameLayoutEl && gameLayoutEl.dataset) gameLayoutEl.dataset.mode = duel ? "duel" : "solo";
  if (roundStatusEl) {
    roundStatusEl.textContent = phase === "summary"
      ? t("game.sessionDone")
      : t("play.position", { current: Math.min(displayedIndex() + 1, total), total });
  }
  if (playScoreEl) playScoreEl.classList.toggle("hidden", duel);
  if (duelScoreEl) duelScoreEl.classList.toggle("hidden", !duel);
  if (duel) {
    const active = phase === "summary" ? -1 : currentUiPlayerIndex();
    [0, 1].forEach((index) => {
      const name = duelPlayerName(index);
      if (duelNameEls[index]) {
        duelNameEls[index].textContent = name;
        duelNameEls[index].title = name;
      }
      if (duelAvatarEls[index]) duelAvatarEls[index].textContent = initialsFromName(name, index === 0 ? "P1" : "P2");
      if (duelPointsEls[index]) duelPointsEls[index].textContent = formatPoints(STATE.duel.scores[index] || 0);
      if (duelSideEls[index]) {
        duelSideEls[index].classList.toggle("is-active", index === active);
        if (index === active) duelSideEls[index].setAttribute("aria-current", "true");
        else duelSideEls[index].removeAttribute("aria-current");
      }
    });
  } else {
    if (playScoreValueEl) playScoreValueEl.textContent = formatPoints(STATE.score || 0);
    if (playScoreMaxEl) playScoreMaxEl.textContent = played > 0 ? `/ ${formatPoints(played * POINTS_PER_POSITION)}` : "";
    if (playScoreEl && (STATE.score || 0) > (STATE.ui.lastShownScore || 0)) {
      // A small bump when the points grow (css/coach.css; no motion under reduced motion).
      // The animation restarts on the next frame: reading offsetWidth to force it made every answer pay a synchronous layout.
      playScoreEl.classList.remove("is-bump");
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => playScoreEl.classList.add("is-bump"));
      else playScoreEl.classList.add("is-bump");
    }
    STATE.ui.lastShownScore = STATE.score || 0;
  }
  const coach = ludusModule("Coach");
  if (coach && sessionDotsEl && typeof coach.dotsModel === "function") {
    try {
      // The dots are a function of the session, the number of positions, the round in play, the answers so far and
      // the language: drawn again only when one of those changed (a 200-position session rebuilt 200 nodes per call).
      const current = phase === "thinking" || phase === "evaluating" || phase === "handoff" ? STATE.index : -1;
      const roundCount = STATE.session && Array.isArray(STATE.session.rounds) ? STATE.session.rounds.length : 0;
      const dotsKey = [STATE.session ? STATE.session.id : "", total, current, roundCount, STATE.language].join("|");
      if (dotsKey !== STATE.ui.dotsKey) {
        STATE.ui.dotsKey = dotsKey;
        coach.renderDots(sessionDotsEl, coach.dotsModel({ total, current, rounds: dotRounds(), lang: STATE.language }));
      }
    } catch (error) {
      console.error("[Ludus] the progress dots failed to draw", error);
    }
  }
  updateRoundTurn();
  syncGamePhase();
}

// The position card of the panel while the person thinks. `playerIndex` says whose turn it
// is in a duel (the handoff shows the second player's card before the first move of theirs).
function renderThinkingPanel(playerIndex = currentUiPlayerIndex()) {
  const coach = ludusModule("Coach");
  if (!coachThinkingEl) return;
  const position = STATE.positions[STATE.index];
  if (!coach || typeof coach.renderThinking !== "function" || !position) {
    coachThinkingEl.textContent = "";
    return;
  }
  try {
    const model = coach.positionModel({ position, session: STATE.session ? { kind: STATE.session.kind } : null, lang: STATE.language });
    if (STATE.session && STATE.session.kind !== "own" && !model.moverName) model.moverName = positionMoverName(position);
    if (STATE.session && STATE.session.kind === "own") model.moverName = "";
    coach.renderThinking(coachThinkingEl, model, {
      duel: isDuelMode() ? { name: duelPlayerName(playerIndex), initials: initialsFromName(duelPlayerName(playerIndex), "J") } : null,
      hintCosts: STATE.hintsEnabled ? [hintCostPercent(1), hintCostPercent(2)] : null,
      backupEngine: isUsingFallbackEngine(),
    });
    prependFirstRunNote();
  } catch (error) {
    console.error("[Ludus] the position card failed to draw", error);
    coachThinkingEl.textContent = "";
  }
}

// The first position of the first session says how to play, at the top of the panel (on a phone
// the rest of it is under the board): the clock does not start running out before it is read.
function prependFirstRunNote() {
  if (!coachThinkingEl || !STATE.session || !STATE.session.firstRun || STATE.index !== 0) return;
  const util = ludusModule("util");
  if (!util || typeof util.h !== "function" || typeof coachThinkingEl.insertBefore !== "function") return;
  const note = util.h("p", { class: "t-small co-first-run", role: "note" }, t("core.firstRun.note"));
  coachThinkingEl.insertBefore(note, coachThinkingEl.firstChild || null);
}

// The next button says what comes after this result, and the legend says what the
// keys do (desktop only, css/coach.css).
function updateNextButton() {
  if (nextBtnLabelEl) {
    const last = STATE.index >= Math.max(1, STATE.targetPositions) - 1;
    const reviewing = Boolean(STATE.resultView.review);
    nextBtnLabelEl.textContent = reviewing ? t("play.summary.back") : last ? t("play.finish") : t("buttons.nextPosition");
  }
  renderKeyLegend();
}

function shortcutsEnabled() {
  return Boolean(settingsGet("a11y.shortcuts", true));
}

// The keys are also told to assistive technology (the legend under the next button is decorative).
function syncShortcutAttributes() {
  const on = shortcutsEnabled();
  [[hintBtn, "H"], [nextBtn, "N"], [resultAnalysisBtn, "E"], [revealBestBtn, "B"], [revealGameBtn, "M"]].forEach(([el, key]) => {
    if (!el) return;
    if (on) el.setAttribute("aria-keyshortcuts", key);
    else el.removeAttribute("aria-keyshortcuts");
  });
}

function renderKeyLegend() {
  syncShortcutAttributes();
  if (!legendEl) return;
  const util = ludusModule("util");
  if (!util || typeof util.h !== "function") return;
  legendEl.textContent = "";
  if (!shortcutsEnabled()) return;
  const entry = (key, label) => util.h("span", { class: "co-legend-entry" }, util.h("kbd", { class: "kbd" }, key), label);
  const reviewing = Boolean(STATE.resultView.review);
  legendEl.appendChild(entry("N", t("play.key.next")));
  if (!reviewing || STATE.resultView.snapshotFen) {
    legendEl.appendChild(entry("E", t("play.key.explore")));
    legendEl.appendChild(entry("B", t("play.key.best")));
    if (STATE.resultView.context && STATE.resultView.context.master) legendEl.appendChild(entry("M", t("play.key.master")));
  }
}

// The sound switch of the header mirrors Settings (sound.enabled), which the settings
// screen can also change.
function syncSoundButton() {
  if (!soundBtn) return;
  const on = Boolean(settingsGet("sound.enabled", true));
  soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
  soundBtn.setAttribute("title", t(on ? "core.sound.on" : "core.sound.off"));
}

function formatClock(remainingMs) {
  const clamped = Math.max(0, Math.round(remainingMs));
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resetDuelState() {
  STATE.duel.scores = [0, 0];
  STATE.duel.hits = [0, 0];
  STATE.duel.firstPlayer = duelFirstPlayerFor(0);
  STATE.duel.currentPlayer = STATE.duel.firstPlayer;
  STATE.duel.roundResults = [null, null];
  STATE.duel.handoffReady = false;
  STATE.duel.readyWait = false;
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
  if (safe !== "duel") {
    resetDuelState();
  }
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();
  setUiPhase("playing", false);
  renderPlayHeader();
}

// The clock the wizard offers is the clock of the session it is building, not a global setting:
// choosing 180 s (or "no limit") here changes nothing else; the usual clock is changed in Settings.
// The chip with 0 seconds is "no limit".
function updateWizardTimerChipSelection(seconds = STATE.setupWizard.turnTimeSeconds) {
  let selectedChip = null;
  const untimed = wizardClockIsUntimed();
  wizardTimerChipEls.forEach((chipEl) => {
    const chipSeconds = Number(chipEl.getAttribute("data-seconds")) || 0;
    const selected = untimed ? chipSeconds === 0 : chipSeconds === seconds && chipSeconds > 0;
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
  return seconds;
}

function setWizardClockMode(mode) {
  STATE.setupWizard.clockMode = mode === "untimed" ? "untimed" : "timed";
  updateWizardTimerChipSelection();
}

function readDuelPlayersFromInputs() {
  STATE.duel.players = [
    sanitizePlayerName(duelPlayerAEl ? duelPlayerAEl.value : "", defaultDuelPlayerName(0)),
    sanitizePlayerName(duelPlayerBEl ? duelPlayerBEl.value : "", defaultDuelPlayerName(1)),
  ];
  if (duelPlayerAEl) duelPlayerAEl.value = STATE.duel.players[0];
  if (duelPlayerBEl) duelPlayerBEl.value = STATE.duel.players[1];
  renderPlayHeader();
}

function stopRoundTimer() {
  const timer = STATE.timer;
  if (timer.intervalId) {
    clearTimeout(timer.intervalId);
    timer.intervalId = null;
  }
  timer.running = false;
  timer.paused = false;
}

const CLOCK_ANNOUNCE_MILESTONES_SEC = [60, 30, 10, 0];

// The clock's visible text changes once a second, but announcing that would drown out
// board/turn/result announcements. Only these milestones reach the live region, and each
// one only once.
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

// One clock for both modes: the one in the play header. In a duel it shows the time of
// the player whose turn it is, because only one plays at a time. It keeps its place once
// the answer is in (dimmed, at the time it stopped) so the header does not move.
const CLOCK_RING_LENGTH = 94.25;

// What the clock last wrote to the page: a tick that changes nothing writes nothing (the
// digits change once a second, the ring a pixel at a time, the classes a few times a round),
// so a round costs a handful of style recalculations per minute instead of ten per second.
const clockPaint = {};

function resetClockPaint() {
  Object.keys(clockPaint).forEach((key) => {
    delete clockPaint[key];
  });
}

function paintClock(field, value, write) {
  if (clockPaint[field] === value) return;
  clockPaint[field] = value;
  write(value);
}

function updateRoundTimerUi(remainingMs = clockRemainingMs()) {
  if (!soloClockRailEl || !soloClockValueEl) return;

  const context = STATE.resultView.context;
  const inSummary = Boolean(STATE.resultView.visible && context && context.kind === "session_summary");
  const showClock = document.body.classList.contains("playing-mode") && !inSummary;
  paintClock("shown", showClock, (value) => soloClockRailEl.classList.toggle("hidden", !value));
  if (!showClock) return;
  const stopped = Boolean(STATE.resultView.visible);
  paintClock("stopped", stopped, (value) => soloClockRailEl.classList.toggle("is-stopped", value));
  if (stopped) return;

  const untimed = isUntimedSession();
  paintClock("untimed", untimed, (value) => soloClockRailEl.classList.toggle("is-untimed", value));
  paintClock("label", untimed ? t("core.clock.untimedAria") : t("labels.clockTitle"), (value) => soloClockRailEl.setAttribute("aria-label", value));
  if (untimed) {
    paintClock("text", "∞", (value) => {
      soloClockValueEl.textContent = value;
    });
    paintClock("title", t("core.clock.untimedAria"), (value) => soloClockValueEl.setAttribute("title", value));
    paintClock("offset", "0", (value) => {
      if (soloClockArcEl) soloClockArcEl.setAttribute("stroke-dashoffset", value);
    });
    paintClock("urgency", "", () => soloClockRailEl.classList.remove("urgency-mid", "urgency-high"));
    return;
  }
  paintClock("title", "", () => soloClockValueEl.removeAttribute("title"));

  const duration = Math.max(1, STATE.timer.durationMs || Math.round(STATE.turnTimeSeconds * 1000));
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = clamp(safeRemaining / duration, 0, 1);

  paintClock("text", formatClock(safeRemaining), (value) => {
    soloClockValueEl.textContent = value;
  });
  paintClock("offset", String(Math.round(CLOCK_RING_LENGTH * (1 - ratio) * 100) / 100), (value) => {
    if (soloClockArcEl) soloClockArcEl.setAttribute("stroke-dashoffset", value);
  });
  announceClockMilestone(Math.ceil(safeRemaining / 1000));
  const urgency = ratio <= 0.2 ? "high" : ratio <= 0.45 ? "mid" : "";
  paintClock("urgency", urgency, (value) => {
    soloClockRailEl.classList.remove("urgency-mid", "urgency-high");
    if (value) soloClockRailEl.classList.add("urgency-" + value);
  });
}

function pageIsHidden() {
  try {
    return document.visibilityState === "hidden" || document.hidden === true;
  } catch (error) {
    return false;
  }
}

// Milliseconds left on the round clock (frozen while it is paused).
function clockRemainingMs() {
  const timer = STATE.timer;
  return timer.paused ? timer.remainingAtPause : timer.deadlineMs - Date.now();
}

// True once the clock of the round on screen has run out, whether or not a tick has noticed
// yet (a hidden tab, a busy page, a throttled timer): an answer that arrives after the
// deadline is a timeout, whatever the next tick would have said.
function roundClockExpired() {
  const timer = STATE.timer;
  return Boolean(timer.running && !timer.paused && Date.now() >= timer.deadlineMs);
}

// One tick per displayed second: the timer is set for the moment the digits change, so a
// 90-second round wakes up 90 times instead of 900.
function scheduleClockTick() {
  const timer = STATE.timer;
  if (timer.intervalId) {
    clearTimeout(timer.intervalId);
    timer.intervalId = null;
  }
  if (!timer.running || timer.paused) return;
  const remaining = timer.deadlineMs - Date.now();
  const untilNextSecond = remaining <= 0 ? 0 : remaining - Math.floor((remaining - 1) / 1000) * 1000;
  timer.intervalId = setTimeout(onClockTick, untilNextSecond + CLOCK_TICK_MARGIN_MS);
}

function onClockTick() {
  const timer = STATE.timer;
  timer.intervalId = null;
  if (!timer.running || timer.paused) return;
  const remainingMs = timer.deadlineMs - Date.now();
  if (remainingMs <= 0) {
    updateRoundTimerUi(0);
    stopRoundTimer();
    if (!STATE.roundSubmitted && !STATE.isResolvingRound) {
      void submitNoMove("timeout");
    }
    return;
  }
  updateRoundTimerUi(remainingMs);
  scheduleClockTick();
}

// A phone locked, a call, a pulled-down notification or another app in front: the time the
// page is hidden is not time the person had to think, so the clock stops and goes on from the
// same second when the page comes back (a round must never be scored 0 for a locked screen).
function pauseRoundTimer() {
  const timer = STATE.timer;
  if (timer.roundHiddenAt) return;
  timer.roundHiddenAt = Date.now();
  if (!timer.running || timer.paused) return;
  timer.paused = true;
  timer.pausedAt = Date.now();
  timer.remainingAtPause = Math.max(0, timer.deadlineMs - timer.pausedAt);
  if (timer.intervalId) {
    clearTimeout(timer.intervalId);
    timer.intervalId = null;
  }
}

function resumeRoundTimer() {
  const timer = STATE.timer;
  if (!timer.roundHiddenAt) return;
  const now = Date.now();
  timer.pausedMs += Math.max(0, now - timer.roundHiddenAt);
  timer.roundHiddenAt = 0;
  if (!timer.running || !timer.paused) return;
  timer.paused = false;
  timer.deadlineMs = now + timer.remainingAtPause;
  updateRoundTimerUi(timer.remainingAtPause);
  scheduleClockTick();
  const secondsLeft = Math.ceil(timer.remainingAtPause / 1000);
  announcePlay(t(secondsLeft === 1 ? "core.clock.resumed.one" : "core.clock.resumed", { seconds: secondsLeft }));
}

function onPageVisibilityChange() {
  if (pageIsHidden()) pauseRoundTimer();
  else resumeRoundTimer();
}

function startRoundTimer() {
  stopRoundTimer();
  const timer = STATE.timer;
  STATE.roundStartedAt = Date.now();
  timer.pausedMs = 0;
  timer.roundHiddenAt = 0;
  resetClockPaint();
  if (isUntimedSession()) {
    // Nothing counts down and nothing times out; the round is over when the
    // person answers, skips or takes the hint that shows the move.
    timer.durationMs = 0;
    timer.deadlineMs = 0;
    timer.lastAnnouncedSeconds = null;
    if (soloClockAnnounceEl) soloClockAnnounceEl.textContent = "";
    updateRoundTimerUi();
    if (pageIsHidden()) pauseRoundTimer();
    return;
  }
  const durationMs = Math.round(normalizeTurnTimeSeconds(STATE.turnTimeSeconds) * 1000);
  timer.durationMs = durationMs;
  timer.deadlineMs = Date.now() + durationMs;
  timer.lastAnnouncedSeconds = null;
  timer.running = true;
  timer.paused = false;
  timer.remainingAtPause = durationMs;
  if (soloClockAnnounceEl) soloClockAnnounceEl.textContent = "";
  updateRoundTimerUi(durationMs);
  if (pageIsHidden()) pauseRoundTimer();
  else scheduleClockTick();
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

// Usernames: Lichess allows 2 to 30 characters, Chess.com 3 to 25 (letters, numbers, _ and -).
const REMOTE_USERNAME_RULES = {
  lichess: { min: 2, max: 30 },
  chesscom: { min: 3, max: 25 },
};

function remoteUsernameRule(platform) {
  return REMOTE_USERNAME_RULES[platform] || REMOTE_USERNAME_RULES.lichess;
}

function remoteUsernameIsValid(name, platform) {
  const rule = remoteUsernameRule(platform);
  return name.length >= rule.min && name.length <= rule.max && /^[A-Za-z0-9_-]+$/.test(name);
}

function usernameRuleText(platform) {
  const rule = remoteUsernameRule(platform);
  return t("wizard.validation.invalidUsername", { provider: providerLabel(platform), min: rule.min, max: rule.max });
}

// What a person types or pastes for "username": the name, "@name" (as it is written in chat and on
// profiles) or the address of the profile (lichess.org/@/name, chess.com/member/name) all mean the same.
function normalizeRemoteUsername(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  const profile = text.match(/(?:lichess\.org\/@\/|chess\.com\/member\/)([A-Za-z0-9_-]+)/i);
  if (profile) text = profile[1];
  return text.replace(/^@+/, "").trim();
}

function sanitizeWizardUsername(value) {
  return normalizeRemoteUsername(value);
}

function collectWizardConfig() {
  const mode = normalizeGameFormat(STATE.setupWizard.mode);
  const playerA = String(duelPlayerAEl ? duelPlayerAEl.value : STATE.setupWizard.duelNames[0] || "").trim().replace(/\s+/g, " ").slice(0, playerNameMax());
  const playerB = String(duelPlayerBEl ? duelPlayerBEl.value : STATE.setupWizard.duelNames[1] || "").trim().replace(/\s+/g, " ").slice(0, playerNameMax());
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
    clockMode: STATE.setupWizard.clockMode === "untimed" ? "untimed" : "timed",
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

// The remedies a failure offers (index.html #wizard-source-cta): "retry" goes through the same download
// again, "user" lets the person type another username, "platform" switches Lichess <-> Chess.com.
// A validation problem of a field (an empty or impossible username) offers none: the field is the remedy.
function setWizardSourceActions(actions) {
  const wanted = Array.isArray(actions) ? actions : [];
  const show = (btn, key) => {
    if (btn) btn.classList.toggle("hidden", !wanted.includes(key));
  };
  show(wizardRetryDownloadBtn, "retry");
  show(wizardRetryUserBtn, "user");
  show(wizardSwitchPlatformBtn, "platform");
  if (wizardSourceCtaEl) wizardSourceCtaEl.classList.toggle("hidden", wanted.length === 0);
}

let wizardCountdownTimer = null;

function stopWizardCountdown() {
  if (wizardCountdownTimer) {
    clearInterval(wizardCountdownTimer);
    wizardCountdownTimer = null;
  }
  if (wizardSourceErrorEl) wizardSourceErrorEl.setAttribute("aria-live", "polite");
}

function clearWizardSourceError() {
  stopWizardCountdown();
  STATE.setupWizard.sourceError = null;
  if (wizardSourceErrorEl) {
    wizardSourceErrorEl.textContent = "";
    wizardSourceErrorEl.classList.add("hidden");
  }
  if (wizardSourceCtaEl) wizardSourceCtaEl.classList.add("hidden");
  clearFieldInvalid(onlineUserInputEl, "wizard-source-error");
  clearFieldInvalid(wizardPlatformGroupEl, "wizard-source-error");
  refreshOnlineStatus();
}

// field identifies which step-2 control the error is actually about
// ("platform" or "username"), so only that control gets flagged invalid:
// network/throttle errors (called without a field) just show the text.
// options.actions: the remedy buttons that go with it (none by default for a field, see setWizardSourceActions;
// both "another user / other platform" otherwise). options.seconds > 0 makes it a countdown: the text
// counts down and, at zero, the download starts again by itself (a wait the person does not have to watch).
function showWizardSourceError(key = "common.sourceError", params = {}, field = null, options = {}) {
  stopWizardCountdown();
  const hasTranslation = Object.prototype.hasOwnProperty.call(TRANSLATIONS[preferredLocale()] || {}, key)
    || Object.prototype.hasOwnProperty.call(TRANSLATIONS.es || {}, key);
  const text = hasTranslation ? t(key, params) : String(key || "").trim();
  const actions = Array.isArray(options.actions) ? options.actions : (field ? [] : ["user", "platform"]);
  const seconds = Math.max(0, Math.round(Number(options.seconds) || 0));
  STATE.setupWizard.sourceError = hasTranslation ? { key, params: { ...params }, field, actions, seconds } : { raw: text };
  if (wizardSourceErrorEl) {
    wizardSourceErrorEl.textContent = text;
    wizardSourceErrorEl.classList.remove("hidden");
  }
  // The message is the alert; the status line under the field goes quiet instead of saying it twice.
  if (onlineStatusEl) onlineStatusEl.textContent = "";
  setWizardSourceActions(actions);
  if (field === "username") setFieldInvalid(onlineUserInputEl, "wizard-source-error");
  else clearFieldInvalid(onlineUserInputEl, "wizard-source-error");
  if (field === "platform") setFieldInvalid(wizardPlatformGroupEl, "wizard-source-error");
  else clearFieldInvalid(wizardPlatformGroupEl, "wizard-source-error");
  if (seconds > 0) startWizardCountdown();
}

// Counts the seconds of a wait down in the alert, says it once (not every second) to a screen reader, and
// starts the download again at zero if the person is still where they were.
function startWizardCountdown() {
  const error = STATE.setupWizard.sourceError;
  if (!error || !error.seconds || !wizardSourceErrorEl) return;
  if (wizardSourceErrorEl) wizardSourceErrorEl.setAttribute("aria-live", "off");
  announcePlay(wizardSourceErrorEl.textContent);
  wizardCountdownTimer = setInterval(() => {
    const current = STATE.setupWizard.sourceError;
    if (!current || !current.seconds) {
      stopWizardCountdown();
      return;
    }
    current.seconds -= 1;
    if (current.params && "seconds" in current.params) current.params.seconds = Math.max(1, current.seconds);
    if (current.seconds <= 0) {
      stopWizardCountdown();
      retryWizardDownload();
      return;
    }
    wizardSourceErrorEl.textContent = t(current.key, current.params);
  }, 1000);
}

// "Try again": the same user, the same platform, the same choices, from the step that starts the download.
function retryWizardDownload() {
  if (STATE.ui.setupAnalyzing || !wizardStep3El) return;
  clearWizardSourceError();
  goToWizardStep(3);
  void startSessionPipeline();
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

// "No limit" is a choice of the wizard too (it starts from the setting, and only for this session).
function wizardClockIsUntimed() {
  return STATE.setupWizard.clockMode === "untimed";
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
  // With "no limit" chosen the custom seconds have nothing to say; below 30 s the wizard warns
  // that there is hardly time to think (it still allows it: some people train speed on purpose).
  const untimedNow = wizardClockIsUntimed();
  const customLabelEl = turnTimeSecondsEl && typeof turnTimeSecondsEl.parentNode?.querySelector === "function"
    ? turnTimeSecondsEl.parentNode.querySelector('label[for="turn-time-seconds"]')
    : null;
  [turnTimeSecondsEl, customLabelEl].forEach((el) => {
    if (el) el.classList.toggle("hidden", untimedNow);
  });
  const clockNoteEl = document.getElementById("wizard-clock-note");
  if (clockNoteEl) {
    clockNoteEl.textContent = untimedNow
      ? t("wizard.step3.noLimitHint")
      : `${t("wizard.step3.clockNote")}${config.turnTimeSeconds < 30 ? ` ${t("wizard.step3.timerShort")}` : ""}`;
  }

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
    if (!remoteUsernameIsValid(config.username, config.platform)) {
      return { valid: false, reason: usernameRuleText(config.platform), field: "username" };
    }
  }

  if (safeStep >= 3) {
    if (!Number.isInteger(config.sessionSize) || config.sessionSize < 1 || config.sessionSize > 200) {
      return { valid: false, reason: t("wizard.validation.chooseCount"), field: "count" };
    }
  }

  return { valid: true, reason: t("wizard.validation.ready") };
}

// The steps of the wizard are entries of the browser's history (Ludus.router sub-states): Back goes to the step
// before, then home, like any multi-step form; Forward goes on. options.fromHistory: the browser already moved.
function syncWizardHistory(previousStep, step) {
  const router = ludusModule("router");
  if (!router || typeof router.pushSub !== "function" || router.current() !== "setup") return;
  const sub = step === wizardFirstStep() ? null : { step };
  if (step > previousStep) router.pushSub(sub);
  else if (step === previousStep - 1 && router.subDepth() > 0 && router.popSub()) return;
  else if (step < previousStep) router.replaceSub(sub);
}

// Back or Forward landed on a step of the wizard. A search that was running goes with the step it belonged to.
function wizardStepFromHistory(sub) {
  if (STATE.ui.setupAnalyzing || STATE.analysisInProgress) cancelSetupWork();
  goToWizardStep(sub && Number(sub.step) ? Number(sub.step) : wizardFirstStep(), { fromHistory: true });
}

function goToWizardStep(step, options = {}) {
  const previousStep = Number(STATE.setupWizard.step) || wizardFirstStep();
  STATE.setupWizard.step = clamp(Number(step) || wizardFirstStep(), wizardFirstStep(), 3);
  if (!options.fromHistory) syncWizardHistory(previousStep, STATE.setupWizard.step);
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
  // A new wizard starts from the person's usual clock (Settings); what it changes stays in its session.
  // (the very first session starts without a clock, see isFirstRun()).
  STATE.setupWizard.clockMode = settingsGet("clock.mode", "timed") === "untimed" || isFirstRun() ? "untimed" : "timed";
  setWizardTurnTimeSeconds(settingsGet("clock.seconds", DEFAULT_TURN_TIME_SECONDS));
  STATE.setupWizard.sourceError = null;
  clearWizardStepError();
  clearWizardSourceError();
  syncWizardToLegacyInputs();
  if (analysisStatusEl && statusMessage) analysisStatusEl.textContent = statusMessage;
  goToWizardStep(wizardFirstStep());
}

// After a failure of the download or the search: back to the step where the remedy is (another user,
// the other platform, or simply "try again"), with what happened said once, in the alert. options is
// showWizardSourceError's (actions, seconds).
function sendWizardBackToSourceStep(key = "common.sourceError", params = {}, options = {}) {
  showWizardSourceError(key, params, null, options);
  STATE.ui.setupAnalyzing = false;
  setWizardFormControlsDisabled(false);
  if (analyzeBtn) analyzeBtn.disabled = false;
  goToWizardStep(2);
  // The focus goes to the username (where the remedy usually is) without scrolling, and the alert with its
  // buttons is brought to the middle of the screen: on a phone the tab bar would otherwise cover them.
  if (onlineUserInputEl && typeof onlineUserInputEl.focus === "function") onlineUserInputEl.focus({ preventScroll: true });
  const target = wizardSourceCtaEl && !wizardSourceCtaEl.classList.contains("hidden") ? wizardSourceCtaEl : wizardSourceErrorEl;
  if (target && typeof target.scrollIntoView === "function") {
    try {
      target.scrollIntoView({ block: "center", behavior: "auto" });
    } catch (error) {
      // Scrolling is a courtesy.
    }
  }
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
  wizardRetryDownloadBtn,
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
  // While the wizard works (downloading games, looking for mistakes) it can be cancelled from where the
  // progress is, and says how long it has been at it.
  if (analysisCancelBtn) analysisCancelBtn.classList.toggle("hidden", !disabled);
  if (disabled) startWizardBusyTicker();
  else stopWizardBusyTicker();
}

// Elapsed seconds under the progress bar once the wait stops being short, with what to expect: a year of
// games is a few megabytes and the provider may be slow. Not a live region (it would chatter every second).
let wizardBusyTimer = null;
let wizardBusyStartedAt = 0;

function renderWizardBusyText() {
  if (!analysisElapsedEl) return;
  const seconds = Math.max(0, Math.round((Date.now() - wizardBusyStartedAt) / 1000));
  if (seconds < 8) {
    analysisElapsedEl.textContent = "";
    return;
  }
  analysisElapsedEl.textContent = seconds < 25
    ? t("download.elapsed", { seconds })
    : t("download.elapsedLong", { seconds, provider: providerLabel(STATE.sourceMode) });
}

function startWizardBusyTicker() {
  stopWizardBusyTicker();
  wizardBusyStartedAt = Date.now();
  renderWizardBusyText();
  wizardBusyTimer = setInterval(renderWizardBusyText, 1000);
}

function stopWizardBusyTicker() {
  if (wizardBusyTimer) {
    clearInterval(wizardBusyTimer);
    wizardBusyTimer = null;
  }
  if (analysisElapsedEl) analysisElapsedEl.textContent = "";
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

// The line under the username field says what is true of it NOW: empty, impossible for this platform,
// a base that is already there, or fine. (An error in the alert silences it: see showWizardSourceError.)
function refreshOnlineStatus() {
  if (!onlineStatusEl || STATE.ui.setupAnalyzing || STATE.setupWizard.sourceError) return;
  const config = collectWizardConfig();
  const remote = hasAnyPgnSource(true) ? STATE.remotePgnSources[0] : null;
  if (!config.username) {
    onlineStatusEl.textContent = t("wizard.step2.enterUsername");
  } else if (remote?.username) {
    const warning = remoteWarningText(remote);
    onlineStatusEl.textContent = t("provider.baseReady", { username: remote.username, warning: warning ? ` ${warning}` : "" });
  } else if (!remoteUsernameIsValid(config.username, config.platform)) {
    onlineStatusEl.textContent = usernameRuleText(config.platform);
  } else {
    onlineStatusEl.textContent = t("provider.readyToDownload");
  }
}

function updatePgnSelectionUi() {
  const config = collectWizardConfig();
  const hasRemote = hasAnyPgnSource(true);
  const remote = hasRemote ? STATE.remotePgnSources[0] : null;

  refreshOnlineStatus();

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
let wizardOpenedInThisPage = false;

function openSetupFromLanding({ format = null, statusMessage = "", skipModeStep = false } = {}) {
  if (setupPanelEl) setupPanelEl.style.display = "";
  wizardOpenedInThisPage = true;
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
  prefillLastUsername();
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
  const nameA = sanitizePlayerName(names[0], "").slice(0, playerNameMax());
  const nameB = sanitizePlayerName(names[1], "").slice(0, playerNameMax());
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

// What went wrong with a download, in terms the screen can act on (see remoteErrorView):
// code is one of notFound | noGames | rateLimited | server | offline | network | timeout |
// malformed | tooLarge | cancelled | consentCancelled | consentUnavailable | userMissing.
// Nothing a person reads is ever taken from an exception's own message.
class RemoteFetchError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.name = "RemoteFetchError";
    this.code = code;
    this.params = params;
  }
}

// The pause a 429 asks for: its Retry-After (seconds, or a date) when the browser can read it,
// else the minute Lichess asks clients to wait.
function retryAfterMs(response) {
  const raw = response?.headers?.get ? response.headers.get("Retry-After") : "";
  if (!raw) return RATE_LIMIT_PAUSE_MS;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return clamp(numeric * 1000, 1000, 10 * 60000);
  const dateMs = Date.parse(raw);
  return Number.isFinite(dateMs) ? clamp(dateMs - Date.now(), 1000, 10 * 60000) : RATE_LIMIT_PAUSE_MS;
}

// GET with a timeout per attempt. A network failure or a 5xx is tried again (a short, growing pause);
// a 429 never is: the provider asked for a pause and what to do is the caller's decision. The answer
// of the server, whatever its status, comes back as a response; everything that stops one coming
// back is a RemoteFetchError ("cancelled" when the signal was aborted, else timeout / offline / network).
async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = clamp(Number(options.timeoutMs) || REMOTE_FETCH_TIMEOUT_MS, 1000, 60000);
  const retries = clamp(Number(options.retries) || 0, 0, 4);
  const { timeoutMs: _timeoutMs, retries: _retries, signal: externalSignal, ...fetchOptions } = options;
  let lastTimedOut = false;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (externalSignal?.aborted) break;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timedOut = false;
    const timeout = controller
      ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
      : null;
    // Bridges an external cancellation (session ended, download budget hit, the person pressed
    // "cancel") into this attempt's own controller so the in-flight request actually stops.
    const onExternalAbort = () => controller && controller.abort();
    if (externalSignal && controller) externalSignal.addEventListener("abort", onExternalAbort);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller ? controller.signal : externalSignal,
      });
      if (timeout) clearTimeout(timeout);
      if (response.status >= 500 && attempt < retries) {
        await sleepMs(500 * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      lastTimedOut = timedOut;
      if (externalSignal?.aborted) break;
      if (attempt < retries) {
        await sleepMs(500 * (attempt + 1));
        continue;
      }
    } finally {
      if (externalSignal && controller) externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (externalSignal?.aborted) throw new RemoteFetchError("cancelled");
  if (lastTimedOut) throw new RemoteFetchError("timeout");
  throw new RemoteFetchError(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network");
}

// The error a response that is not ok stands for: the user is not there (404), the provider asks for a
// pause (429, with how long), or it is having trouble (anything else: its status goes with it).
function remoteStatusError(response) {
  if (response.status === 404) return new RemoteFetchError("notFound");
  if (response.status === 429) return new RemoteFetchError("rateLimited", { retryAfterMs: retryAfterMs(response) });
  return new RemoteFetchError("server", { status: response.status });
}

// Whatever stops a body from being read: cancelled, the connection dropping, or the wrong kind of body.
function remoteBodyError(error, signal) {
  if (error instanceof RemoteFetchError) return error;
  if (signal?.aborted) return new RemoteFetchError("cancelled");
  if (error && error.name === "AbortError") return new RemoteFetchError("timeout");
  return new RemoteFetchError(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network");
}

// Rejects an oversized remote response before it is fully materialized in
// memory. Content-Length is checked first when the server sends one;
// otherwise the body is read incrementally via its stream reader so a
// response that lies about (or omits) its length is still capped by bytes
// actually received. See REMOTE_RESPONSE_MAX_BYTES for the size rationale.
async function readResponseTextWithLimit(response, maxBytes = REMOTE_RESPONSE_MAX_BYTES, signal) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RemoteFetchError("tooLarge");
  }
  try {
    const hasStreamingBody = response.body && typeof response.body.getReader === "function"
      && typeof TextDecoder === "function";
    if (!hasStreamingBody) {
      // Environment without a streaming body reader (older browser, or the
      // stubbed test harness): the Content-Length check above still applies
      // when the header is present; this is only reached without it.
      const text = await response.text();
      if (text.length > maxBytes) {
        throw new RemoteFetchError("tooLarge");
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
        throw new RemoteFetchError("tooLarge");
      }
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } catch (error) {
    throw remoteBodyError(error, signal);
  }
}

// A body that is not the JSON the provider documents (an HTML error page, a cut-off answer) is
// "the games could not be read", never the parser's own complaint.
async function readResponseJsonWithLimit(response, maxBytes = REMOTE_RESPONSE_MAX_BYTES, signal) {
  const text = await readResponseTextWithLimit(response, maxBytes, signal);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new RemoteFetchError("malformed");
  }
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

// What makes two downloads interchangeable: the same provider and the same kind of games. NOT how
// many games a session asked for (changing 10 positions to 5 must not go back to the network): the
// entry remembers how many it asked for (source.requestedMax) and serves any session that needs
// no more than that, or any when the person simply has fewer games than were asked for.
function cacheSignature(settings) {
  return JSON.stringify(settings, Object.keys(settings || {}).sort());
}

function cachedBaseCovers(entry, minRequested) {
  const source = entry && entry.source;
  if (!source) return false;
  if (!Number.isFinite(minRequested)) return true;
  const requested = Number(source.requestedMax);
  if (!Number.isFinite(requested)) return false;
  return requested >= minRequested || Number(source.games) < requested;
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
      if (!cachedBaseCovers(entry, options.minRequested)) {
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
// APIs. It only counts downloads that actually reached the network and worked: anything
// answered from the local cache is free, and so is a request the provider refused (a wrong
// username is not a reason to wait twenty seconds before correcting it). Stored in
// localStorage so a page reload does not hand out a fresh allowance.
const REMOTE_FETCH_THROTTLE_KEY = "ludus.remoteFetchThrottle.v1";
// A 429 is a different thing: the provider itself asked for a pause, so nothing is sent to it until that is over.
const REMOTE_FETCH_COOLDOWN_KEY = "ludus.remoteFetchCooldown.v1";
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

// The pause a provider asked for, remembered per provider until it is over.
function readRemoteCooldown(provider) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(REMOTE_FETCH_COOLDOWN_KEY) || "{}");
    const until = stored && Number(stored[provider]);
    return Number.isFinite(until) && until > Date.now() ? until : 0;
  } catch (error) {
    return 0;
  }
}

function recordRemoteCooldown(provider, pauseMs) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(REMOTE_FETCH_COOLDOWN_KEY) || "{}");
    const next = stored && typeof stored === "object" ? stored : {};
    next[provider] = Date.now() + clamp(Number(pauseMs) || RATE_LIMIT_PAUSE_MS, 1000, 10 * 60000);
    window.localStorage.setItem(REMOTE_FETCH_COOLDOWN_KEY, JSON.stringify(next));
  } catch (error) {
    // Only costs a second 429 if the person tries again at once.
  }
}

// Returns null when a network download is allowed right now, or an object with
// the translation key and params explaining how long the caller has to wait
// (seconds is what a countdown can show and then retry by itself).
function remoteFetchThrottleBlock(provider) {
  const now = Date.now();
  const cooldownUntil = provider ? readRemoteCooldown(provider) : 0;
  if (cooldownUntil) {
    const seconds = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
    return { key: "download.error.rateLimited", params: { provider: providerLabel(provider), seconds }, seconds };
  }
  const recent = readRemoteFetchLog().filter((at) => now - at < REMOTE_FETCH_WINDOW_MS && at <= now);
  writeRemoteFetchLog(recent);

  const lastAt = recent.length ? Math.max(...recent) : 0;
  if (lastAt && now - lastAt < REMOTE_FETCH_MIN_GAP_MS) {
    const seconds = Math.max(1, Math.ceil((REMOTE_FETCH_MIN_GAP_MS - (now - lastAt)) / 1000));
    return { key: "provider.throttleWait", params: { seconds }, seconds };
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

function consentDialogAvailable() {
  return Boolean(consentOverlayEl && consentOverlayAcceptBtn && consentOverlayCancelBtn);
}

// A question with a yes and a no. It fails CLOSED: without the dialog's markup nobody agreed to
// anything, so the answer is no (a download must never start on a consent nobody gave). Only a
// question with nothing irreversible behind it (options.allowWithoutDialog, leaving a session) goes on.
function showConfirmModal(options = {}) {
  if (!consentDialogAvailable()) {
    return Promise.resolve(options.allowWithoutDialog === true);
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

// The consent is for one provider AND one username: having agreed to ask Lichess for one person's games
// says nothing about another person's (the dialog names the user, and so does what is sent).
function consentKey(provider, username) {
  return `${provider}|${normalizeName(username)}`;
}

function confirmRemoteFetchConsent(provider, username) {
  const key = consentKey(provider, username);
  if (STATE.remoteConsent[key]) return Promise.resolve(true);
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
    if (accepted) STATE.remoteConsent[key] = true;
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

// The game phase of a position: one classifier for the whole app (Insights.gamePhase, which looks at the
// pieces left, the queens and the move number). The rule below is only what stands in for it when Ludus.Insights
// is not there (a module that failed to load must not stop a round).
function getGamePhase(board) {
  const insightsApi = ludusModule("Insights");
  try {
    if (insightsApi && typeof insightsApi.gamePhase === "function") {
      const phase = insightsApi.gamePhase(board);
      if (phase === "opening" || phase === "middlegame" || phase === "endgame") return phase;
    }
  } catch (error) {
    // fall through to the stand-in
  }
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

// What a mistake is, for the positions of the person's own games: the loss of WIN CHANCE (percentage points of
// Scoring.winPercent) of the move they played against the best one, the very measure a round is scored with. A
// centipawn loss is not comparable across positions (150 cp is a blunder in a level position and nothing when the
// game is already won or lost), and a mistake detected in one unit and scored in another was replayed for 9.4 of 10.
// The sensitivity setting is still written in centipawns of a level position ("80 cp"): that is converted here.
function lossPctForCp(cp) {
  const scoring = ludusModule("Scoring");
  const value = clamp(Number(cp) || 0, 0, 2000);
  if (scoring && typeof scoring.winPercent === "function") return Math.max(0, scoring.winPercent(value) - scoring.winPercent(0));
  return 50 * (2 / (1 + Math.exp(-0.00368208 * Math.min(value, 1000))) - 1);
}

// Win-chance points the played move gives up against the best move (both mover-point-of-view scores, mates included).
function winLossPct(bestMoverScore, playedMoverScore) {
  const scoring = ludusModule("Scoring");
  if (!scoring || typeof scoring.winPercent !== "function" || !Number.isFinite(bestMoverScore) || !Number.isFinite(playedMoverScore)) return NaN;
  return Math.max(0, scoring.winPercent(bestMoverScore) - scoring.winPercent(playedMoverScore));
}

// The threshold of a position: the base one, a little looser in an opening and tighter in an endgame (where
// every tempo counts), in centipawns as before and in win-chance points (what the detection compares with).
function adaptiveThreshold(baseThresholdCp, board) {
  const phase = getGamePhase(board);
  const base = clamp(Number(baseThresholdCp) || 150, 50, 800);
  const threshold = phase === "opening" ? Math.round(base * 1.1) : phase === "endgame" ? Math.round(base * 0.75) : base;
  return { phase, threshold, thresholdPct: lossPctForCp(threshold) };
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
  // The ceiling of the search of one move that is not among the lines (an answer, or the move of the game): its target
  // is the depth of the best line (evaluateRoundAnswers), this is only how long it may take to get there. Never below
  // the best line's time, so the move is never given a smaller budget; the whole round still fits the hard cap.
  const referenceTasks = hasReferenceLines(position) ? 0 : 1;
  const moveTasks = Math.max(1, answerCount) + 1;
  const moveMovetimeMs = clamp(
    Math.min(movetimeMs * ROUND_EVAL_MOVE_TIME_FACTOR, ROUND_EVAL_MAX_SEARCH_MS, Math.floor((ROUND_EVAL_HARD_CAP_MS - referenceTasks * movetimeMs) / moveTasks)),
    movetimeMs,
    ROUND_EVAL_MAX_SEARCH_MS,
  );
  return {
    level,
    label,
    multiplier: Math.round(multiplier * 100) / 100,
    movetimeMs,
    moveMovetimeMs,
    multiPv: budget.multiPv,
    maxTasks,
    totalBudgetMs: referenceTasks * movetimeMs + moveTasks * moveMovetimeMs,
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

// The lines for the result panel: SAN-converted, with their evaluation, and the same
// moves in UCI so that the coach can step through a line on the board.
function buildLinesView(fen, lines, marks = {}) {
  const userUcis = Array.isArray(marks.userUcis) ? marks.userUcis : [];
  return (lines || []).slice(0, 5).map((line, index) => {
    const uci = lineFirstUci(line);
    const pv = Array.isArray(line.pv) && line.pv.length ? line.pv : [uci];
    const sanList = pvToSan(fen, pv, 8);
    return {
      rank: index + 1,
      uci,
      san: sanList[0] || line.san || uci,
      score: lineMoverScore(line),
      evalText: formatScoreText(lineMoverScore(line)),
      pvSan: sanList,
      pvUci: pv.slice(0, sanList.length),
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
// those lines is searched on its own (searchmoves) to the same depth as the best
// line and with at least its time (PF-1), so both scores are comparable; the move
// of the game is scored the same way so its evaluation can be shown.
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
      movetimeMs: plan.movetimeMs,
      ...options,
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
  // The depth the strong engine searched the best line to (0: unknown, or not the strong engine's number).
  let referenceDepth = 0;
  if (hasReferenceLines(position)) {
    lines = referenceLinesOf(position);
    origin = position.reference.origin === "runtime" ? "runtime" : "precomputed";
    depth = Number(position.reference.depth) || 0;
    referenceDepth = depth;
  } else {
    const root = await task({ multiPv: plan.multiPv });
    if (root.aborted) return null;
    lines = compactEngineLines(root.lines);
    origin = "runtime";
    depth = root.depth;
    if (root.source === "stockfish") referenceDepth = depth;
  }
  if (!lines.length) throw new Error("no-analysis");
  const referenceBest = lineMoverScore(lines[0]);

  // The budget of the search of a move that is not among the lines (PF-1): the best line's. The best line has a depth
  // (the position's own reference, or what the root search reached), so the move is searched to that same depth, with
  // a time ceiling that is never shorter than the best line's. A depth is no budget when the best line is a mate (the
  // engine stops at the first mate it finds, at any depth) or is only a few plies deep: then it is the best line's
  // time, as before. The MultiPV search shares its time among the lines and a single move does not, so the same time
  // reached different depths (the learner's move 3 plies deeper or 3 shallower than the line it is compared with).
  const referenceKind = scoring.decodeScore(referenceBest);
  const matchDepth = referenceDepth >= ROUND_EVAL_MIN_MATCH_DEPTH && referenceDepth <= 40 && referenceKind && referenceKind.kind === "cp"
    ? Math.round(referenceDepth)
    : 0;
  const moveBudget = () => (matchDepth ? { depth: matchDepth, movetimeMs: plan.moveMovetimeMs || plan.movetimeMs } : {});

  // 2. The score of a move that is not among the lines.
  const scoreOutsideLines = async (uci) => {
    const one = await task({ searchMoves: [uci], multiPv: 1, ...moveBudget() });
    if (one.aborted) return { aborted: true };
    const line = one.lines[0] || null;
    let score = lineMoverScore(line);
    if (Number.isFinite(score) && origin === "precomputed" && one.source === "local") {
      // The reference was made by the strong engine and this by the 3-ply
      // fallback, whose numbers are not comparable. Carry over only the
      // difference between the best move and this one, both measured by the fallback
      // (with the same budget: the fallback searches both to its own fixed depth).
      const bestOne = await task({ searchMoves: [lines[0].uci], multiPv: 1, ...moveBudget() });
      if (bestOne.aborted) return { aborted: true };
      const bestLocal = lineMoverScore(bestOne.lines[0]);
      score = Number.isFinite(bestLocal) ? referenceBest - Math.max(0, bestLocal - score) : score;
      // A move that is not among the reference lines cannot be better than the
      // weakest of them (they are the engine's top moves, best first, like
      // Scoring's own estimate for an unmeasured move). The 3-ply fallback does not
      // see deep tactics: it can rank a blunder above the master's mating line, the
      // measured difference is then negative, max(0, ...) turns it into "no loss" and
      // the blunder was worth 10. The cap keeps such a move where the reference puts it.
      const weakestReference = lineMoverScore(lines[lines.length - 1]);
      if (Number.isFinite(weakestReference)) score = Math.min(score, weakestReference);
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
      // `lines` lets "sacrifice" (and so "brilliant") follow the engine's line for the move.
      const features = uci && insightsApi ? insightsApi.moveFeatures(fen, uci, { lines }) : null;
      isSacrifice = Boolean(features && features.sacrifice);
      // A classic's sacrifice that the engine's best defence declines (17...Be6!! offers the queen, the engine answers by
      // taking a knight instead) is no sacrifice along the engine's line, but it is the master's brilliancy: the data
      // (scripts/build-classics.js) already knows it from the game's own continuation.
      if (!isSacrifice && uci && uci === position.gameMoveUci && position.classic && position.classic.kind === "sacrifice") isSacrifice = true;
    } catch (error) {
      isSacrifice = false;
    }
    const input = { lines, userUci: uci, masterUci, settings, reason, hintsUsed };
    let assessment = scoring.assess(input, { isSacrifice });
    // The engine's line after a move that is not among the lines: what the coach checks its claims about material against.
    let userPv;
    if (assessment.needsEvaluation && uci && !assessment.error) {
      const outside = await scoreOutsideLines(uci);
      if (outside.aborted) return null;
      if (outside.line && Array.isArray(outside.line.pv)) userPv = outside.line.pv;
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
          userPv,
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


// ---------- Local fallback evaluator ----------
// The 3-ply search that answers when the strong engine is not there. It used to be a plain minimax over cloned
// boards in ONE synchronous task: 1.2-1.4 s of frozen page per analysis on a phone (3 s at 4x CPU) and 4 s to score
// a round. Now it is alpha-beta with captures searched first (most of the tree is cut: the same answers, a tenth
// of the nodes) and it gives the page back to the browser every few milliseconds, so the screen keeps moving.

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

// Search order: the most valuable victim taken by the least valuable piece first (MVV-LVA), promotions next,
// then the moves as they were generated (stable, so equal moves keep their order).
function moveOrderKey(board, move) {
  let key = 0;
  if (move.capture || move.enPassant) {
    const victim = move.enPassant ? 100 : Math.abs(pieceValues[board.board[move.to]] || 0);
    const attacker = Math.abs(pieceValues[board.board[move.from]] || 0);
    key = 10000 + victim * 10 - attacker / 10;
  }
  if (move.promotion) key += 9000;
  return key;
}

function orderedMoves(board) {
  const moves = board.generateMoves();
  return moves
    .map((move, index) => ({ move, index, key: moveOrderKey(board, move) }))
    .sort((a, b) => (b.key - a.key) || (a.index - b.index))
    .map((entry) => entry.move);
}

// The value of a position for White after searching `depth` plies with alpha-beta (the exact minimax value when the
// window is the whole line, a bound when the caller narrows it).
function evaluatePosition(board, depth, alpha = -Infinity, beta = Infinity) {
  if (depth <= 0) return evaluateMaterial(board);
  const moves = orderedMoves(board);
  if (moves.length === 0) return board.inCheck(board.turn) ? (board.turn === "w" ? -99999 : 99999) : 0;
  let best = board.turn === "w" ? -Infinity : Infinity;
  for (const move of moves) {
    const clone = board.clone();
    clone.makeMove(move);
    const score = evaluatePosition(clone, depth - 1, alpha, beta);
    if (board.turn === "w") {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

// Gives the page back to the browser when a slice of work has lasted long enough to be felt (12 ms): the clock, the
// board and the overlay keep moving while the backup engine thinks.
function createLocalSlicer() {
  const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  let sliceStart = now();
  return async function maybeYield() {
    if (now() - sliceStart < LOCAL_SLICE_MS) return;
    await yieldToUi();
    sliceStart = now();
  };
}

// The best move for the side to move and its score for White, in root order (the first of equal moves wins, as
// it always did): each later move is searched with the best score so far as the window, so most are refuted at once.
async function searchBestMove(board, depth, maybeYield) {
  const white = board.turn === "w";
  let bestScore = white ? -Infinity : Infinity;
  let bestMove = null;
  for (const move of board.generateMoves()) {
    const clone = board.clone();
    clone.makeMove(move);
    const score = evaluatePosition(clone, depth - 1, white ? bestScore : -Infinity, white ? Infinity : bestScore);
    if (white ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (maybeYield) await maybeYield();
  }
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
const timingOverrides = { minEvalVisibleMs: null, engineRetryBaseMs: null, engineStallMs: null };
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

// Why the strong engine is not the one answering, for the words that say so: "unsupported" (this browser cannot
// run it), "offline" (it cannot be fetched now), "failed" (it died or never started), "loading" (on its way).
function engineFallbackReason() {
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return "";
  if (STATE.engineStatus === "unsupported") return "unsupported";
  if (engineLoad) return "loading";
  if (typeof navigator !== "undefined" && navigator.onLine === false && !STATE.engineFilesReady) return "offline";
  return STATE.engineStatus === "failed" ? "failed" : "loading";
}

// The sentence that goes with the backup engine, for the reason it is in use.
function engineFallbackNotice() {
  const reason = engineFallbackReason();
  if (reason === "unsupported") return t("core.engine.unsupported");
  if (reason === "offline") return t("core.engine.offline");
  return t("analysis.status.localEngineNotice");
}

// The browser can run the engine's WebAssembly (it needs SIMD: Chrome 91, Firefox 89, Safari 16.4 and later)?
// A test or an end-to-end run that hands the engine another transport skips the question: a fake needs no wasm.
function engineSupported() {
  if (typeof engineTransportFactory === "function") return true;
  const engineApi = ludusModule("Engine");
  try {
    if (engineApi && typeof engineApi.supported === "function") return engineApi.supported();
  } catch (error) {
    return false;
  }
  return true;
}

// Brings the engine's files into the browser's cache while showing how far it got, so the Worker that starts
// afterwards finds them at once. The download has NO wall-clock limit (a cold 7 MB file takes a minute on a slow
// connection and used to be abandoned at 30 s, three times in a row): it is given up only when no byte has
// arrived for ENGINE_DOWNLOAD_STALL_MS. Resolves to true when the file is complete (or there is nothing to fetch).
async function downloadEngineFiles() {
  if (STATE.engineFilesReady || typeof engineTransportFactory === "function" || typeof fetch !== "function" || typeof AbortController !== "function") return true;
  const controller = new AbortController();
  let stallTimer = null;
  const armStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), timingOverrides.engineStallMs !== null ? timingOverrides.engineStallMs : ENGINE_DOWNLOAD_STALL_MS);
  };
  STATE.engineDownload = { loaded: 0, total: 0, ratio: 0, at: Date.now(), state: "downloading" };
  try {
    armStall();
    const response = await fetch(ENGINE_FILE_URL, { signal: controller.signal });
    if (!response.ok) throw new Error("engine file " + response.status);
    const total = Number(response.headers && response.headers.get ? response.headers.get("content-length") : 0) || 0;
    const reader = response.body && typeof response.body.getReader === "function" ? response.body.getReader() : null;
    if (!reader) {
      await response.arrayBuffer();
    } else {
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        armStall();
        STATE.engineDownload = { loaded, total, ratio: total ? clamp(loaded / total, 0, 1) : null, at: Date.now(), state: "downloading" };
      }
    }
    STATE.engineFilesReady = true;
    STATE.engineDownload = { ...STATE.engineDownload, ratio: 1, state: "done" };
    return true;
  } catch (error) {
    STATE.engineDownload = { ...STATE.engineDownload, state: controller.signal.aborted ? "stalled" : "failed" };
    return false;
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }
}

// One attempt at starting the strong engine. The worker requests the engine
// file itself (the page has already brought it into the cache, see downloadEngineFiles).
async function setupStockfish() {
  resetEngineToLocal();
  const epoch = engineEpoch;
  const engineApi = ludusModule("Engine");
  if (!engineApi || typeof engineApi.create !== "function") return false;
  if (!engineSupported()) {
    STATE.engineStatus = "unsupported";
    return false;
  }
  let instance = null;
  try {
    if (!(await downloadEngineFiles())) {
      if (epoch === engineEpoch) STATE.engineStatus = "failed";
      return false;
    }
    if (epoch !== engineEpoch) return false;
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
      if (epoch === engineEpoch) STATE.engineStatus = "failed";
      return false;
    }
    STATE.engine = { mode: "stockfish", instance, ready: true };
    STATE.engineStatus = "ready";
    return true;
  } catch (error) {
    if (instance) {
      try {
        instance.terminate();
      } catch (terminateError) {
        // ignore
      }
    }
    if (epoch === engineEpoch) {
      resetEngineToLocal();
      STATE.engineStatus = "failed";
    }
    return false;
  }
}

let engineLoad = null;

// Loads the strong engine once however many places ask for it, retrying a few
// times with a growing pause. A first attempt failing on a weak connection is
// ordinary for a download this size and used to condemn the whole page load to
// the shallow local engine. A browser that cannot run it is told so once and not asked again.
function ensureStockfishLoading() {
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return Promise.resolve(true);
  if (STATE.engineStatus === "unsupported") return Promise.resolve(false);
  if (!engineLoad) {
    STATE.engineStatus = "loading";
    engineLoad = (async () => {
      for (let attempt = 0; attempt < ENGINE_LOAD_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          const baseMs = timingOverrides.engineRetryBaseMs !== null ? timingOverrides.engineRetryBaseMs : ENGINE_RETRY_BASE_MS;
          await sleepMs(baseMs * attempt);
        }
        if (await setupStockfish()) return true;
        if (STATE.engineStatus === "unsupported") {
          // Said once, in the words of this browser's limit (the panel says "backup engine" from now on).
          showToast(t("core.engine.unsupported"), { kind: "info", duration: 9000 });
          return false;
        }
      }
      return false;
    })().finally(() => {
      engineLoad = null;
    });
  }
  return engineLoad;
}

// The strong engine died in the middle of a session (a silent worker, a crash): it is tried again from the next
// round, a couple of times, instead of leaving the rest of the session on the shallow engine for good.
function reviveEngineIfNeeded() {
  if (STATE.engineFailures < 1 || STATE.engineFailures > ENGINE_REVIVALS || engineLoad) return;
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return;
  if (!engineSupported()) return;
  void ensureStockfishLoading().then((ready) => {
    if (ready && STATE.ui.gamePhase === "thinking") renderThinkingPanel();
  });
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
    // A shallow look (the screening of the mistake search) is neither read from nor written to the cache.
    noCache: Boolean(opts.noCache),
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
  const maybeYield = createLocalSlicer();
  const board = new Chess(request.fen);
  const depth = localFallbackDepth(request.depth || LOCAL_FALLBACK_MAX_DEPTH);
  if (request.searchMoves.length) {
    const lines = [];
    for (const uci of request.searchMoves) {
      const move = uciToMove(uci, board);
      if (!move) continue;
      const clone = board.clone();
      clone.makeMove(move);
      lines.push({ move, whiteScore: evaluatePosition(clone, depth - 1) });
      await maybeYield();
    }
    const scored = lines
      .map((entry) => localAnalysisLine(board, entry.move, entry.whiteScore, depth))
      .sort((a, b) => lineMoverScore(b) - lineMoverScore(a));
    return { lines: scored.slice(0, 1), depth, aborted: false };
  }
  const best = await searchBestMove(board, depth, maybeYield);
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
      // A search that stops at a depth OR a time (the learner's move, PF-1) is as far along as the closer of the two.
      const byTime = request.movetimeMs > 0 ? elapsed / request.movetimeMs : 0;
      const byDepth = depthSeen / Math.max(1, request.depth || 18);
      report(clamp(request.depth > 0 && request.movetimeMs > 0 ? Math.max(byTime, byDepth) : request.movetimeMs > 0 ? byTime : byDepth, 0, 0.98));
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
    const cached = request.noCache ? null : readAnalysisCache(key);
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
            STATE.engineFailures += 1;
            resetEngineToLocal();
            STATE.engineStatus = "failed";
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
    if (!request.noCache && !result.aborted && !result.timedOut && result.lines.length) {
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

function updateNextSearchStatus(ctx) {
  if (!roundStatusEl || !ctx) return;
  // Clear the text content since the central overlay already shows the "Searching" UI.
  roundStatusEl.textContent = "";
}

// A cheap search may miss a tactic or see one that is not there (a 250 ms search of the same position gave
// the best move's score +16 to +46 cp on different runs when the real best was +185). So it only SCREENS: a
// candidate whose loss is at least this share of the threshold is looked at properly (verifyMistakeCandidate).
const MISTAKE_SCREEN_FACTOR = 0.6;

// The second look at a candidate that passed the screening: the analysis of the position with the budget a
// round is scored with (MultiPV, the same time), the played move scored by that analysis (or by a search of
// its own when it is outside the lines), and the loss of win chance measured again. A candidate that does
// not confirm is dropped, and a confirmed one carries the analysis as its reference: the round is then scored against
// exactly what flagged the position (no second opinion that could disagree), and the hint agrees with it.
// Resolves to null when it does not confirm or the work was cancelled.
async function verifyMistakeCandidate(before, fen, playedUci, thresholdPct) {
  const plan = getRoundEvaluationPlan(before, { fen }, 1);
  const root = await analyzePosition(fen, { multiPv: plan.multiPv, movetimeMs: plan.movetimeMs });
  if (root.aborted || !root.lines.length) return null;
  const lines = compactEngineLines(root.lines);
  if (!lines.length) return null;
  // The engine's own best move is the one the person played: nothing to learn here.
  if (lines[0].uci === playedUci) return null;
  const inLines = lines.find((line) => line.uci === playedUci);
  let playedMover;
  if (inLines) {
    playedMover = inLines.score;
  } else {
    const one = await analyzePosition(fen, { searchMoves: [playedUci], multiPv: 1, movetimeMs: plan.movetimeMs });
    if (one.aborted || !one.lines[0]) return null;
    playedMover = lineMoverScore(one.lines[0]);
  }
  const lossPct = winLossPct(lines[0].score, playedMover);
  if (!(lossPct >= thresholdPct)) return null;
  return { lines, depth: root.depth, source: root.source, bestMover: lines[0].score, playedMover, lossPct };
}

// Candidate mistake search (own games): cheap single-line searches screen the candidates (the best move first
// and then only the move that was played, searchmoves, each on a short adaptive budget; MultiPV would make every
// candidate slower for nothing here), and the few that pass are confirmed by verifyMistakeCandidate. The searches of
// the screening are never cached: a shallow answer must not be reused as if it were a deep one.
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

      const bestResult = await analyzePosition(beforeFen, { multiPv: 1, movetimeMs: budgetMs, noCache: true });
      const bestLine = bestResult.lines[0];
      if (!bestLine) return null;
      const bestUci = lineFirstUci(bestLine);
      // The person played the engine's move: nothing to learn here, and one search saved.
      if (!bestUci || bestUci === playedUci) return null;
      const playedResult = await analyzePosition(beforeFen, { searchMoves: [playedUci], multiPv: 1, movetimeMs: budgetMs, noCache: true });
      const playedLine = playedResult.lines[0];
      if (!playedLine) return null;

      let bestMover = lineMoverScore(bestLine);
      let playedMover = lineMoverScore(playedLine);
      let finalBestUci = bestUci;
      let lossPct = winLossPct(bestMover, playedMover);
      // Both searches came from the strong engine: a candidate that may be a mistake gets the second, proper look.
      // (The fallback engine cannot do better than it already did.)
      let verified = null;
      if (bestResult.source === "stockfish" && playedResult.source === "stockfish") {
        if (!(lossPct >= adaptive.thresholdPct * MISTAKE_SCREEN_FACTOR)) return null;
        verified = await verifyMistakeCandidate(before, beforeFen, playedUci, adaptive.thresholdPct);
        if (!verified) return null;
        finalBestUci = verified.lines[0].uci;
        bestMover = verified.bestMover;
        playedMover = verified.playedMover;
        lossPct = verified.lossPct;
      } else if (!(lossPct >= adaptive.thresholdPct)) {
        return null;
      }
      const scored = computeLossAgainstBest(bestMover, playedMover);

      const bestMove = uciToMove(finalBestUci, before);
      const position = {
        id: `own:${Ludus.util.hashString(beforeFen)}`,
        source: "own",
        fen: beforeFen,
        meta: buildMeta(tags, moveNumber, moverColor),
        gameIdx: candidate.gameIdx,
        gameMoveUci: playedUci,
        gameMoveSan: moveToSan(before, move),
        gameEvalText: formatScoreText(playedMover),
        bestMoveUci: finalBestUci,
        bestMoveSan: bestMove ? moveToSan(before, bestMove) : finalBestUci,
        bestEvalText: formatScoreText(bestMover),
        lossCp: scored.diff || 0,
        lossPct: Math.round(lossPct * 10) / 10,
        thresholdUsed: adaptive.threshold,
        phase: adaptive.phase,
        gameIndex: candidate.gameIdx + 1,
      };
      // The analysis that confirmed the mistake is the round's reference (see verifyMistakeCandidate).
      if (verified) {
        position.reference = {
          origin: "runtime",
          depth: verified.depth,
          lines: verified.lines.map((line) => ({ uci: line.uci, score: line.score, pv: line.pv })),
        };
      }
      return position;
    }

    chess.makeMove(move);
  }
  return null;
}

// Reports how the search ended, not only what it found. Cancelling and running
// out of candidates both used to come back as nothing, so cancelling ended the
// session as if there were no positions left.
async function findNextMistake(ctx, options = {}) {
  const mistake = await searchNextMistake(ctx, options);
  if (mistake) return { status: "found", mistake };
  return { status: STATE.ui.searchCancelRequested ? "cancelled" : "exhausted", mistake: null };
}

async function searchNextMistake(ctx, options = {}) {
  if (!ctx || STATE.analysisInProgress) return null;
  STATE.analysisInProgress = true;
  STATE.ui.searchCancelRequested = false;
  const searchStartedAt = Date.now();
  let evaluatedInThisSearch = 0;
  // The search for the position AFTER the first one runs over the board (the status text lives in its overlay).
  const isNextSearch = Boolean(options && options.next);
  try {
    if (!Array.isArray(ctx.repeatMistakes)) ctx.repeatMistakes = [];
    if (ctx.cursor >= ctx.candidates.length && ctx.repeatMistakes.length > 0) {
      const fallback = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(fallback.gameIdx)) usedGames.add(fallback.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detectedRepeated"));
      analysisStatusEl.textContent = t("analysis.status.reused", { count: ctx.detected });
      if (isNextSearch) updateNextSearchStatus(ctx);
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
        ordinal,
        total: ctx.total,
        detected: ctx.detected,
      });
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.evaluatingCandidate", { ordinal, total: ctx.total }));
      if (isNextSearch) updateNextSearchStatus(ctx);
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
          analysisStatusEl.textContent = t("analysis.status.ready", { count: ctx.detected });
          if (isNextSearch) updateNextSearchStatus(ctx);
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
        analysisStatusEl.textContent = t("analysis.status.continuity", { count: ctx.detected });
        if (isNextSearch) updateNextSearchStatus(ctx);
        return fallback;
      }

      if (ctx.analyzed % 2 === 0) {
        updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.searchingError"));
        if (isNextSearch) updateNextSearchStatus(ctx);
        await yieldToUi();
      }
    }

    if (!STATE.ui.searchCancelRequested && ctx.repeatMistakes.length > 0) {
      const deferredRepeat = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(deferredRepeat.gameIdx)) usedGames.add(deferredRepeat.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detectedRepeated"));
      analysisStatusEl.textContent = t("analysis.status.noFresh", { count: ctx.detected });
      if (isNextSearch) updateNextSearchStatus(ctx);
      return deferredRepeat;
    }

    if (STATE.ui.searchCancelRequested) {
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.cancelled"));
      if (isNextSearch) updateNextSearchStatus(ctx);
      return null;
    }

    updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.finished"));
    analysisStatusEl.textContent = t("analysis.status.noMore");
    if (isNextSearch) updateNextSearchStatus(ctx);
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

// "la torre blanca" / "the white rook": the piece with its article, for a sentence that says
// what to move ("mové la torre blanca": a bare name would need the article's gender in every language).
function pieceDefiniteName(piece) {
  const keyByPiece = {
    P: "piece.def.whitePawn",
    N: "piece.def.whiteKnight",
    B: "piece.def.whiteBishop",
    R: "piece.def.whiteRook",
    Q: "piece.def.whiteQueen",
    K: "piece.def.whiteKing",
    p: "piece.def.blackPawn",
    n: "piece.def.blackKnight",
    b: "piece.def.blackBishop",
    r: "piece.def.blackRook",
    q: "piece.def.blackQueen",
    k: "piece.def.blackKing",
  };
  return keyByPiece[piece] ? t(keyByPiece[piece]) : pieceAriaName(piece);
}

function boardSquareAriaLabel(squareName, piece, stateParts = []) {
  const state = stateParts.filter(Boolean).join("");
  return t("board.squareLabel", {
    square: squareName,
    piece: piece ? pieceAriaName(piece) : t("board.empty"),
    state,
  });
}

// The board itself (the 64 squares, the pieces, highlights, arrows, pointer and keyboard input, drag and
// drop, the slide animation) lives in js/ui/board.js (Ludus.Board). What follows only tells it what is on the
// board and what a square means, and turns its input into the moves the game core already knows how to play.
let boardView = null;
let boardViewFailed = false;
// The last move MADE on the board (in analysis, or the answer being scored). It belongs to one Chess object:
// as soon as STATE.board is replaced by another position the highlight is gone by itself.
let lastBoardMove = null;

function ensureBoardView() {
  if (boardView) return boardView;
  const Board = ludusModule("Board");
  if (boardViewFailed || !boardEl || !Board || typeof Board.create !== "function") return null;
  try {
    boardView = Board.create({
      el: boardEl,
      arrowsEl: boardArrowsEl,
      wrapEl: boardEl.parentNode || null,
      orientation: STATE.boardPerspective,
      onSquare: (square) => onSquareClick(square),
      onMove: (from, to) => dropPieceOnBoard(from, to),
      onCancel: () => cancelBoardSelection(),
      onFocusSquare: (square) => {
        STATE.keyboardFocusSquare = square;
      },
      describe: describeBoardSquare,
    });
  } catch (error) {
    boardViewFailed = true;
    console.error("[Ludus] the board failed to start", error);
  }
  return boardView;
}

function buildBoard() {
  const view = ensureBoardView();
  if (view) view.build(STATE.boardPerspective);
}

// What a screen reader says for a square: the piece, then everything that is true of the square. Colour is never
// the only carrier: every highlight has words here.
function describeBoardSquare(info) {
  if (!STATE.board) return info.square;
  const parts = [];
  if (info.selected) parts.push(t("board.selected"));
  if (info.capture) parts.push(t("board.captureTarget"));
  else if (info.legal) parts.push(t("board.legalTarget"));
  if (info.check) parts.push(t("bd.state.check"));
  if (info.last) parts.push(t("bd.state.last"));
  if (info.hintFrom) parts.push(t("core.hint.square.from"));
  if (info.hintTo) parts.push(t("core.hint.square.to"));
  ["best", "user", "userAlt", "game"].forEach((kind) => {
    const mark = info.marks && info.marks[kind];
    if (mark && mark.from) parts.push(t(`bd.state.${kind}.from`));
    if (mark && mark.to) parts.push(t(`bd.state.${kind}.to`));
  });
  if (info.disabled) parts.push(t("board.disabled"));
  return boardSquareAriaLabel(info.square, info.piece, parts);
}

function boardSquareName(index) {
  return Number.isFinite(index) ? Chess.indexToSquare(index) : null;
}

function boardMoveSquares(move) {
  if (!move || !Number.isFinite(move.from) || !Number.isFinite(move.to)) return null;
  return { from: Chess.indexToSquare(move.from), to: Chess.indexToSquare(move.to) };
}

function noteBoardMove(move) {
  lastBoardMove = move && STATE.board ? { board: STATE.board, from: move.from, to: move.to } : null;
}

function currentLastMove() {
  return lastBoardMove && lastBoardMove.board === STATE.board ? lastBoardMove : null;
}

// In analysis the arrows and marks describe the ORIGINAL position; once the person has moved a piece they would
// point at the wrong squares, so they step aside until the board is reset.
function boardDivergedFromResult() {
  return Boolean(STATE.resultView && STATE.resultView.analysisMode && currentLastMove());
}

function kingSquareInCheck(board) {
  try {
    if (!board || !board.inCheck(board.turn)) return null;
    const index = board.board.indexOf(board.turn === "b" ? "k" : "K");
    return index >= 0 ? Chess.indexToSquare(index) : null;
  } catch (error) {
    return null;
  }
}

// The arrows of the result (best, game, yours, the other player's) and the hint's own. The hint's arrow appears
// with its second level; level three shows the best move like the result does.
function boardArrowList() {
  const list = [];
  if (!STATE.board || boardDivergedFromResult()) return list;
  const add = (kind, move) => {
    const squares = boardMoveSquares(move);
    if (squares) list.push({ kind, from: squares.from, to: squares.to });
  };
  const resultShown = Boolean(STATE.resultView && STATE.resultView.visible);
  if (resultShown || hintRevealsMove()) {
    const revealed = STATE.revealed || {};
    add("best", revealed.best);
    add("game", revealed.game);
    add("user", revealed.user);
    add("userAlt", revealed.userAlt);
  }
  const hint = visibleHintMove();
  if (hint && hint.showTo && !hintRevealsMove()) add("hint", hint);
  // The move chosen and waiting for its confirmation is drawn as an arrow (board.confirmMove).
  if (STATE.pendingMove && !resultShown) add("user", STATE.pendingMove);
  return list;
}

function boardModel() {
  const board = STATE.board;
  const revealed = STATE.revealed || {};
  const diverged = boardDivergedFromResult();
  const last = currentLastMove();
  const lastSquares = last ? boardMoveSquares(last) : null;
  const marks = {};
  if (!diverged) {
    ["best", "game", "user", "userAlt"].forEach((kind) => {
      const squares = boardMoveSquares(revealed[kind]);
      // The move just made is already washed as the last move: no second highlight on the same two squares.
      if (squares && !(kind === "user" && lastSquares && lastSquares.from === squares.from && lastSquares.to === squares.to)) marks[kind] = squares;
    });
  }
  const hint = visibleHintMove();
  return {
    pieces: board ? board.board : null,
    turn: board ? board.turn : "w",
    interactive: boardInputAcceptsMoves(),
    selected: STATE.selection,
    targets: (STATE.legalMoves || []).map((move) => ({ square: boardSquareName(move.to), capture: Boolean(move.capture || move.enPassant) })),
    lastMove: lastSquares,
    check: kingSquareInCheck(board),
    hint: hint ? { from: boardSquareName(hint.from), to: hint.showTo ? boardSquareName(hint.to) : null } : null,
    marks,
    arrows: boardArrowList(),
    focus: STATE.keyboardFocusSquare || STATE.selection || null,
    label: t("board.ariaLabel"),
    lang: STATE.language,
  };
}

function renderBoardArrows() {
  const view = ensureBoardView();
  if (view && typeof view.setArrows === "function") view.setArrows(boardArrowList());
}

function renderBoard() {
  if (!boardEl) return;
  const view = ensureBoardView();
  if (view) view.render(boardModel());
}

// A piece dragged and dropped on a legal square: the same two clicks a person could have made, in one gesture.
function dropPieceOnBoard(from, to) {
  if (STATE.selection !== from) {
    onSquareClick(from);
    if (STATE.selection !== from) return;
  }
  onSquareClick(to);
}

// Escape (or dropping a piece outside the board): put the piece back, nothing is played.
function cancelBoardSelection() {
  STATE.selection = null;
  STATE.legalMoves = [];
  clearPendingMove();
  renderBoard();
}

// The sound and the vibration of a move the person made, both guarded and both governed by the settings.
function moveFeedback(move, forcedKind) {
  let kind = forcedKind || "move";
  if (!forcedKind) {
    try {
      const Board = ludusModule("Board");
      const givesCheck = Boolean(STATE.board && STATE.board.inCheck(STATE.board.turn));
      if (Board && typeof Board.feedbackKind === "function") kind = Board.feedbackKind(move, givesCheck);
      else if (givesCheck) kind = "check";
      else if (move && (move.capture || move.enPassant)) kind = "capture";
    } catch (error) {
      kind = "move";
    }
  }
  playSound(kind);
  const audio = ludusModule("Audio");
  try {
    if (audio && typeof audio.haptic === "function") audio.haptic(kind);
  } catch (error) {
    // The vibration is decoration.
  }
}

// A move made on the analysis board (no scoring): it is played, remembered as the last move and felt like any other.
function playAnalysisMove(move) {
  STATE.board.makeMove(move);
  noteBoardMove(move);
  STATE.selection = null;
  STATE.legalMoves = [];
  renderBoard();
  moveFeedback(move);
}

function snapshotMove(move) {
  if (!move || !Number.isFinite(move.from) || !Number.isFinite(move.to)) return null;
  const copy = { from: move.from, to: move.to };
  if (move.promotion) copy.promotion = move.promotion;
  return copy;
}

function startRound(options = {}) {
  const position = STATE.positions[STATE.index];
  if (!position) return;

  const preserveDuelRoundResults = Boolean(options.preserveDuelRoundResults);
  if (isDuelMode() && !preserveDuelRoundResults) {
    STATE.duel.roundResults = [null, null];
    // The first turn of a position: whose it is alternates from position to position (PF-2).
    STATE.duel.firstPlayer = duelFirstPlayerFor(STATE.index);
    STATE.duel.currentPlayer = STATE.duel.firstPlayer;
  }
  // Every position of a duel, the first one included, waits for the first player's tap before their clock starts (the
  // position stays covered until then, and says whose turn it is and that the device goes to them): the clock used to
  // start the moment anybody pressed "Next position", and a session started with the first player's clock running while
  // the device was still in the hands of whoever had pressed "Start".
  const duelReadyGate = isDuelMode() && !preserveDuelRoundResults;

  STATE.board = new Chess(position.fen);
  setBoardPerspective(STATE.board.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.roundSubmitted = false;
  STATE.isResolvingRound = false;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  STATE.duel.handoffReady = false;
  STATE.duel.readyWait = false;
  resetHintState();
  // An engine that died during the session gets another chance from this round.
  reviveEngineIfNeeded();
  // A picker, a move waiting for its confirmation or an armed button from the round before never survive into this one.
  closePromotionPicker({ skipFocusReturn: true });
  STATE.pendingMove = null;
  updateConfirmButton();
  disarmConfirmations();
  setUiPhase("playing", false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();

  renderSessionTitle();
  renderPlayHeader();
  renderThinkingPanel();
  stopRoundTimer();
  if (!duelReadyGate) startRoundTimer();
  updateNextButton();
  nextBtn.disabled = true;
  skipBtn.disabled = false;

  renderBoard();
  updateHintButton();
  if (duelReadyGate) {
    beginDuelReadyGate();
  } else {
    focusBoardAfterRoundStart();
    announcePlay(`${t("play.position", { current: STATE.index + 1, total: soloSessionTarget() })}. ${roundTurnEl ? roundTurnEl.textContent : ""}`);
  }
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
        playAnalysisMove(move);
        return;
      }
      if (moveNeedsConfirmation()) {
        // A second tap on the square already chosen is the confirmation; another square changes the choice.
        if (STATE.pendingMove && STATE.pendingMove.to === move.to) confirmPendingMove();
        else stageMove(move);
        return;
      }
      submitUserMove(move);
      return;
    }
  }
  // Anything but a destination drops the move that was waiting for its confirmation.
  clearPendingMove();

  // Choosing the piece that is already chosen puts it back.
  if (STATE.selection === square) {
    STATE.selection = null;
    STATE.legalMoves = [];
    renderBoard();
    return;
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
  // The strip opens on the promotion file, from the edge the pawn is heading for.
  try {
    const Board = ludusModule("Board");
    const cell = Board && typeof Board.cellOf === "function" ? Board.cellOf(Chess.indexToSquare(matches[0].to), STATE.boardPerspective) : null;
    if (cell) {
      promotionPickerEl.dataset.edge = cell.row < 4 ? "top" : "bottom";
      if (promotionPickerEl.style && typeof promotionPickerEl.style.setProperty === "function") promotionPickerEl.style.setProperty("--bd-promo-col", String(cell.col));
    }
  } catch (error) {
    // The picker still works, centred by its default.
  }
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
  // A picker that outlived its round (it should have been closed with it) must never play its
  // stale move into another position.
  if (!pending.isAnalysisMode && (!STATE.board || STATE.roundSubmitted || STATE.isResolvingRound || nextBtn.disabled === false)) return;
  if (pending.isAnalysisMode) {
    playAnalysisMove(chosen);
    return;
  }
  if (moveNeedsConfirmation()) {
    stageMove(chosen);
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
  // While a move waits for its confirmation its button takes the hint's place in the dock.
  hintBtn.classList.toggle("hidden", !STATE.hintsEnabled || Boolean(STATE.pendingMove));
  const nextLevel = Math.min(3, (STATE.hintsUsed || 0) + 1);
  let label;
  if ((STATE.hintsUsed || 0) >= 3) label = t("core.hint.done");
  else if (nextLevel === 3 && armedConfirmations.reveal) label = t("core.hint.confirmLabel");
  else label = t(`core.hint.next.${nextLevel}`, { pct: hintCostPercent(nextLevel) });
  if (hintBtnLabelEl) hintBtnLabelEl.textContent = label;
  hintBtn.disabled = !hintAvailable();
}

// A hint is announced through a live region of its own (polite): only a hint, or the tap that
// arms a confirmation, writes to it, so it stays quiet otherwise and the clock's milestones
// cannot overwrite it.
function announceHint(text) {
  const target = hintAnnounceEl || soloClockAnnounceEl;
  if (!target) return;
  target.textContent = "";
  setTimeout(() => {
    target.textContent = text;
  }, 30);
}

// ---------- Guard rails against a slipping finger ----------
// A move is played the moment its destination is tapped, which is right for a keyboard or a
// mouse and costly on a phone. board.confirmMove ("off" | "touch" | "always") puts a "Confirm
// move" step between choosing a destination and scoring it, and the two destructive buttons
// (skip, and the last hint, which shows the move and ends the round for nothing) need a second
// tap within a few seconds.

let lastInputKind = "mouse";

function noteInputKind(kind) {
  lastInputKind = kind;
}

function moveNeedsConfirmation() {
  const mode = settingsGet("board.confirmMove", "off");
  if (mode === "always") return true;
  return mode === "touch" && lastInputKind === "touch";
}

const armedConfirmations = { skip: 0, reveal: 0 };

function refreshArmedLabels() {
  if (skipBtn) {
    const armed = Boolean(armedConfirmations.skip);
    const label = skipBtnLabelEl || (typeof skipBtn.querySelector === "function" ? skipBtn.querySelector(".btn-label") : null);
    if (label) label.textContent = t(armed ? "core.skip.confirmLabel" : "buttons.skipMove");
    skipBtn.setAttribute("aria-label", t(armed ? "core.skip.confirm" : "play.skip.aria"));
    skipBtn.classList.toggle("is-armed", armed);
  }
  updateHintButton();
}

function disarmConfirmations() {
  ["skip", "reveal"].forEach((kind) => {
    if (armedConfirmations[kind]) clearTimeout(armedConfirmations[kind]);
    armedConfirmations[kind] = 0;
  });
  refreshArmedLabels();
}

// First tap: arms the action and says so (true only on the second tap within the window).
function armConfirmation(kind, message) {
  if (armedConfirmations[kind]) {
    clearTimeout(armedConfirmations[kind]);
    armedConfirmations[kind] = 0;
    refreshArmedLabels();
    return true;
  }
  armedConfirmations[kind] = setTimeout(() => {
    armedConfirmations[kind] = 0;
    refreshArmedLabels();
  }, CONFIRM_TAP_WINDOW_MS);
  refreshArmedLabels();
  announceHint(message);
  return false;
}

// The move chosen and waiting for "Confirm move" (board.confirmMove).
function updateConfirmButton() {
  const pending = STATE.pendingMove;
  if (confirmMoveBtn) {
    confirmMoveBtn.classList.toggle("hidden", !pending);
    confirmMoveBtn.disabled = !pending;
    if (pending && confirmMoveLabelEl && STATE.board) {
      let san = "";
      try {
        san = moveToSan(STATE.board, pending);
      } catch (error) {
        san = "";
      }
      confirmMoveLabelEl.textContent = san ? t("core.move.confirmSan", { san: sanForPerson(san) }) : t("core.move.confirm");
    }
  }
  updateHintButton();
}

function clearPendingMove() {
  if (!STATE.pendingMove) return;
  STATE.pendingMove = null;
  updateConfirmButton();
}

function stageMove(move) {
  STATE.pendingMove = move;
  updateConfirmButton();
  renderBoard();
  let san = "";
  try {
    san = moveToSan(STATE.board, move);
  } catch (error) {
    san = "";
  }
  announceHint(t("core.move.pending", { san: sanForPerson(san, true) }));
  // A keyboard user chose the destination with Enter: the confirmation is the next Tab stop, and Enter is on it.
  if (lastInputKind === "keyboard" && confirmMoveBtn && typeof confirmMoveBtn.focus === "function") confirmMoveBtn.focus({ preventScroll: true });
}

function confirmPendingMove() {
  const move = STATE.pendingMove;
  if (!move) return;
  STATE.pendingMove = null;
  updateConfirmButton();
  if (!STATE.board || STATE.roundSubmitted || STATE.isResolvingRound) return;
  void submitUserMove(move);
}

// Ludus.game.hint(): asks for the next hint of the round on screen.
// -> { level, from?, to?, uci? } (squares as "e2"), or null when no hint can be given now.
// A press of the hint button or of H (options.fromUi) is protected against slips: a second press
// within a moment is the same press, and the level that shows the move needs a second, deliberate one.
function requestHint(options = {}) {
  if (!hintAvailable()) return null;
  if (options && options.fromUi) {
    const now = Date.now();
    if (now - (STATE.lastHintAt || 0) < HINT_TAP_GAP_MS) return null;
    if ((STATE.hintsUsed || 0) >= 2 && !armConfirmation("reveal", t("core.hint.confirm"))) return null;
    STATE.lastHintAt = now;
  }
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
  const pieceDef = pieceDefiniteName(hint.piece);
  const pct = hintCostPercent(hint.level);

  if (hint.level === 1) {
    announceHint(t("core.hint.said.1", { pieceDef, square: from, pct }));
  } else if (hint.level === 2) {
    announceHint(t("core.hint.said.2", { pieceDef, from, to, pct }));
  } else {
    announceHint(t("core.hint.said.3", { san: sanForPerson(hint.san, true) }));
    STATE.revealed = { ...STATE.revealed, best: { from: hint.from, to: hint.to, promotion: hint.promotion || undefined } };
  }
  clearPendingMove();
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
  // Also "lost" when the focus stayed on a control of the screen the session was started from (the
  // button that was pressed is hidden now): a session must not begin with the focus on the page body.
  // The cover of a duel (the ready cover, the handoff) held the focus and has just been hidden: the browser only moves
  // the focus off a hidden element at its next frame, so for now it is still "on" it (PF-2: Enter or Space on the cover
  // must leave the focus on the board, not on the page).
  const lost = !active || active === document.body || active === handoffOverlayEl
    || (coachPanelEl && typeof coachPanelEl.contains === "function" && coachPanelEl.contains(active))
    || (gameLayoutEl && typeof gameLayoutEl.contains === "function" && !gameLayoutEl.contains(active));
  if (!lost || !boardEl || typeof boardEl.querySelector !== "function") return;
  const target = boardEl.querySelector('.square[tabindex="0"]');
  if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
}


// The round flow: the answer is scored against the engine (evaluateRoundAnswers),
// the result is drawn, the round is announced on the bus ("round:completed", one
// record per player) and the person can move on.
async function resolveRound(move, options = {}) {
  if (STATE.roundSubmitted || STATE.isResolvingRound) return;
  const sessionToken = STATE.sessionToken;
  // An answer that arrives after the deadline is a timeout, even if the next tick of the clock
  // has not run yet (a hidden tab, a busy page): the clock is compared with the time of the answer.
  if (move && roundClockExpired()) {
    move = null;
    options = { ...options, noMoveReason: "timeout" };
  }
  stopRoundTimer();
  // Whatever was still being decided is over with the round: a promotion picker left open (the
  // clock ran out, the position was skipped) or a move waiting for its confirmation.
  closePromotionPicker({ skipFocusReturn: true });
  clearPendingMove();
  disarmConfirmations();
  STATE.roundSubmitted = true;
  STATE.isResolvingRound = true;
  syncGamePhase();
  const duelFirstTurn = isDuelMode() && STATE.duel.currentPlayer === STATE.duel.firstPlayer;
  try {
    const { position, base, noMove, noMoveReason, timeSpentMs, hintsUsed } =
      prepareRoundResolutionContext(move, options, duelFirstTurn);

    if (duelFirstTurn) {
      handleDuelFirstTurnHandoff(base, position, move, noMoveReason, { timeSpentMs, hintsUsed });
      return;
    }

    showEvaluatingMoveOnBoard(move, noMove, noMoveReason);
    renderEvaluatingPanel();
    // The move and the waiting skeleton are on screen: let the browser paint them before the rest
    // of the work (planning the search, the overlay) so the tap is answered at once on a slow phone.
    await paintBreak();
    if (!isCurrentSessionWork(sessionToken)) return;

    const answers = buildAnswersToEvaluate(move, noMoveReason, { timeSpentMs, hintsUsed });
    const plan = getRoundEvaluationPlan(base, position, answers.length);
    const evaluationVisibleStartedAt = beginRoundEvaluationOverlay(plan);

    await waitForEngineDuringRound();
    if (!isCurrentSessionWork(sessionToken)) return;

    const evaluation = await evaluateRoundAnswers(base, position, answers, plan, {
      onProgress: (payload = {}) => {
        const ratio = clamp(Number(payload.ratio) || 0, 0, 1);
        const elapsedTotalMs = Math.max(0, Number(payload.elapsedTotalMs) || 0);
        setPositionSearchProgress(ratio, t("overlay.progressLabel", {
          pct: Math.round(ratio * 100),
          elapsed: (elapsedTotalMs / 1000).toFixed(1),
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
    // What went wrong (a JavaScript message) is for the console; the person gets what happened and what to do (UX-006).
    console.warn("[Ludus] the round could not be evaluated", error);
    showToast(t("analysis.status.roundError"), { kind: "error" });
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
    renderThinkingPanel();
  } finally {
    STATE.isResolvingRound = false;
    syncGamePhase();
  }
}

// Resolves after the browser has had a chance to paint what was just drawn (next frame, then a
// task), or after a short wait when frames do not run (a hidden tab): work that follows it does
// not delay the feedback of the tap that started it.
function paintBreak() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    setTimeout(finish, 80);
    try {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(finish, 0));
    } catch (error) {
      finish();
    }
  });
}

// Someone answering before the strong engine has finished loading waits for it (the overlay is up, with its
// carousel and how far the download is), but only as long as it is coming: the wait ends when the engine is up,
// when no byte has arrived for as long as a session promised to wait (ENGINE_SESSION_WAIT_MS), or at a ceiling
// (ENGINE_WAIT_CEILING_MS). After that the fallback scores the round, and the download carries on.
// options.onProgress(download) says how far it is (STATE.engineDownload), and options.onGiveUp() that the wait ended without it.
async function waitForEngineToLoad(options = {}) {
  if (STATE.engine.mode === "stockfish" && STATE.engine.ready) return;
  if (!engineLoad) return;
  const startedAt = Date.now();
  let lastLoaded = -1;
  let everReceived = false;
  for (;;) {
    const loading = engineLoad;
    if (!loading) return;
    const outcome = await Promise.race([loading.then(() => "done", () => "done"), sleepMs(400).then(() => "tick")]);
    if (outcome === "done") return;
    const download = STATE.engineDownload;
    if (download.loaded !== lastLoaded) {
      lastLoaded = download.loaded;
      if (download.loaded > 0) everReceived = true;
    }
    if (typeof options.onProgress === "function") options.onProgress(download);
    const waited = Date.now() - startedAt;
    if (waited > ENGINE_WAIT_CEILING_MS || (!everReceived && waited > ENGINE_SESSION_WAIT_MS)) {
      if (typeof options.onGiveUp === "function") options.onGiveUp();
      return;
    }
  }
}

// The line under the title of the evaluating overlay.
function setPositionSearchMeta(text) {
  if (STATE.ui.positionSearchState) STATE.ui.positionSearchState.meta = String(text || "");
  if (positionSearchMetaEl) positionSearchMetaEl.textContent = String(text || "");
}

// A round being scored while the engine is still coming: the overlay says how far the download is, and, if the wait
// ends without it, that the round is scored by the backup engine (which is also how it will be told in the result).
function waitForEngineDuringRound() {
  const meta = STATE.ui.positionSearchState ? STATE.ui.positionSearchState.meta : "";
  return waitForEngineToLoad({
    onProgress: (download) => {
      if (download.state === "downloading" && Number.isFinite(download.ratio)) {
        setPositionSearchMeta(t("core.engine.downloading", { pct: Math.round(download.ratio * 100) }));
      }
    },
    onGiveUp: () => setPositionSearchMeta(t("core.engine.slow")),
  }).then(() => {
    if (STATE.ui.positionSearchState && STATE.ui.positionSearchState.meta !== meta && STATE.engine.ready) setPositionSearchMeta(meta);
  });
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
  // Time the page was hidden is not time spent thinking.
  const hiddenNowMs = STATE.timer.roundHiddenAt ? Math.max(0, Date.now() - STATE.timer.roundHiddenAt) : 0;
  const elapsedMs = STATE.roundStartedAt
    ? Math.max(0, Date.now() - STATE.roundStartedAt - (STATE.timer.pausedMs || 0) - hiddenNowMs)
    : 0;
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

function handleDuelFirstTurnHandoff(base, position, move, noMoveReason, extra = {}) {
  // Slot 0 is whoever went first in this position (STATE.duel.firstPlayer), not always the first player of the duel.
  STATE.duel.roundResults[0] = {
    pendingMove: move ? { ...move } : null,
    noMoveReason,
    userMove: snapshotMove(move),
    timeSpentMs: extra.timeSpentMs || 0,
    hintsUsed: extra.hintsUsed || 0,
  };
  if (move) moveFeedback(move, "move");
  STATE.board = new Chess(position.fen);
  setBoardPerspective(base.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  renderBoard();
  const handoff = handoffTexts();
  showHandoffOverlay(handoff.title, handoff.subtitle, handoff);
  STATE.duel.handoffReady = true;
  setUiPhase("handoff_ready", true);
  nextBtn.disabled = true;
  skipBtn.disabled = true;
  updateHintButton();
  renderPlayHeader();
  renderThinkingPanel(duelSecondPlayer());
  announcePlay(`${handoff.eyebrow}. ${handoff.title}.`);
}

// What the handoff card says to the player who has not moved yet. It never mentions the
// first player's move: only that they have played.
function handoffTexts() {
  const first = duelPlayerName(STATE.duel.firstPlayer);
  const second = duelPlayerName(duelSecondPlayer());
  return {
    title: t("game.handoff.title", { player: second }),
    subtitle: t("game.handoff.subtitle", { other: first }),
    eyebrow: t("play.handoff.eyebrow", { name: first }),
    avatar: initialsFromName(second, `P${duelSecondPlayer() + 1}`),
  };
}

// If the person made a move, it goes on the visible board right away (before the engine
// runs), with the sound it deserves.
function showEvaluatingMoveOnBoard(move, noMove, noMoveReason) {
  if (move) {
    STATE.board.makeMove(move);
    noteBoardMove(move);
    STATE.revealed = { ...STATE.revealed, user: move };
    renderBoard();
    moveFeedback(move);
  }
}

// The panel shows the silhouette of the result while the engine scores the answer, so
// nothing moves when the verdict arrives.
function renderEvaluatingPanel() {
  const coach = ludusModule("Coach");
  if (!coach || typeof coach.renderEvaluating !== "function" || !coachThinkingEl) return;
  try {
    coach.renderEvaluating(coachThinkingEl, { lang: STATE.language });
  } catch (error) {
    console.error("[Ludus] the evaluating panel failed to draw", error);
  }
}

// Builds the answers the engine needs to score for this round: one in solo
// mode, or both players' in duel mode (scored against the same reference, in
// one pass). Each carries what Ludus.Scoring needs besides the move: the hints
// used and how long the person took.
function buildAnswersToEvaluate(move, noMoveReason, extra = {}) {
  const current = { move, noMoveReason, hintsUsed: extra.hintsUsed || 0, timeSpentMs: extra.timeSpentMs || 0 };
  if (!isDuelMode()) return [{ ...current, playerIndex: 0 }];
  // The move waiting in slot 0 is the first mover's, the one just made is the second mover's (PF-2: which player is which
  // alternates). The list is in PLAYER order, not turn order, so every consumer (the cards, the scores, the summary's
  // per-player numbers, the profiles each round is recorded for) finds the same person in the same place every position.
  const pending = STATE.duel.roundResults[0];
  const firstMove = pending && pending.pendingMove ? { ...pending.pendingMove } : null;
  const firstAnswer = {
    move: firstMove,
    noMoveReason: firstMove ? "" : (pending?.noMoveReason || "no_move"),
    hintsUsed: pending?.hintsUsed || 0,
    timeSpentMs: pending?.timeSpentMs || 0,
    playerIndex: STATE.duel.firstPlayer,
  };
  const secondAnswer = { ...current, playerIndex: duelSecondPlayer() };
  return STATE.duel.firstPlayer === 0 ? [firstAnswer, secondAnswer] : [secondAnswer, firstAnswer];
}

// Shows the "searching" overlay with its progress bar before the engine work
// starts; a wait that turns out long gets the curiosity carousel.
function beginRoundEvaluationOverlay(plan) {
  const evaluationTitle = isDuelMode()
    ? t("overlay.evaluatingBoth")
    : t("overlay.evaluatingYours");
  // No number of seconds is promised: plan.totalBudgetMs is the time the searches are given, and what the person waits for also
  // holds a retry, the backup engine or the engine's start (RC-7). "A few seconds" is what it usually is.
  showPositionSearchOverlay(
    evaluationTitle,
    t("overlay.difficultyWait", { label: t(`difficulty.${plan.label}`) }),
    {
      showProgress: true,
      progressRatio: 0,
      progressLabel: t("overlay.progressLabel", {
        pct: 0,
        elapsed: "0.0",
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
    // The kind of a classic position (sacrifice, only move...): the coach names it once the answer is in.
    classicKind: position.classic && position.classic.kind ? String(position.classic.kind) : "",
    fen: position.fen,
    source: positionSourceOf(position),
    best: { uci: evaluation.bestUci, san: evaluation.bestSan, score: evaluation.bestScore, evalText: evaluation.bestEvalText },
    master: evaluation.master,
    // Who made the move of the game and what its notes say (a classic brings a note in both languages).
    masterName: evaluation.master && !(STATE.session && STATE.session.kind === "own") ? gameMoveAuthorName() : "",
    masterNote: position.classic && position.classic.note ? { es: position.classic.note.es || "", en: position.classic.note.en || "" } : null,
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
    // What each answer earned, from the profile (XP, notebook card, level, achievements): filled in
    // once the round is recorded (recordRoundOutcome), one entry per answer, null for a guest.
    rewards: [],
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

// A level up and the achievements of a round are one celebration, however many there are:
// the profile emits them while it records the round, all in the same tick, and they are
// merged into a single toast (css/coach.css keeps the toasts under the header, away from
// the button that goes on).
const celebration = { levelUp: false, levelTitle: "", names: [], timer: null, toast: null };

function levelTitleOf(profileId) {
  const profile = ludusModule("Profile");
  try {
    const stats = profile && typeof profile.stats === "function" ? profile.stats(profileId || undefined) : null;
    return stats && stats.level && stats.level.title ? stats.level.title : "";
  } catch (error) {
    return "";
  }
}

function queueCelebration({ levelUpFor, achievement } = {}) {
  if (levelUpFor !== undefined) {
    celebration.levelUp = true;
    celebration.levelTitle = levelTitleOf(levelUpFor);
  }
  if (achievement && achievement.name && !celebration.names.includes(achievement.name)) celebration.names.push(achievement.name);
  if (celebration.timer === null) celebration.timer = setTimeout(flushCelebration, 0);
}

// One celebration on screen at a time: they add up (a level up, then an achievement) and a
// stack of them would cover the header and the headline of the result.
function dismissCelebration() {
  const handle = celebration.toast;
  celebration.toast = null;
  try {
    if (handle && typeof handle.dismiss === "function") handle.dismiss();
  } catch (error) {
    // A toast is a courtesy, never a failure.
  }
}

// The closing summary lists what the session unlocked and the level it reached (a duel is
// nobody's progress and has no such card): a toast over it would only hide its headline.
function summaryListsRewards() {
  const context = STATE.resultView.context;
  return Boolean(STATE.session && STATE.session.completed && STATE.session.mode !== "duel" && context && context.kind === "session_summary");
}

// While the play screen is up, celebrations live in its panel: the result card of a round lists the XP, the level and the
// achievements that round earned (a duel, on the card of the player who earned them) and the closing summary lists the
// session's. A toast there only hid the verdict, the board and the score, so it is kept for the other screens.
function playScreenShowsRewards() {
  try {
    return document.body.classList.contains("playing-mode");
  } catch (error) {
    return false;
  }
}

function flushCelebration() {
  celebration.timer = null;
  const levelUp = celebration.levelUp;
  const title = celebration.levelTitle;
  const names = celebration.names.splice(0);
  celebration.levelUp = false;
  celebration.levelTitle = "";
  if (!levelUp && !names.length) return;
  const parts = [];
  if (levelUp) parts.push(t("core.toast.levelUp", { title }).trim());
  if (names.length === 1) parts.push(t("core.toast.achievement", { name: names[0] }));
  else if (names.length === 2) parts.push(t("core.toast.achievements", { names: names.join(", ") }));
  else if (names.length > 2) parts.push(t("core.toast.achievementsMany", { n: names.length }));
  dismissCelebration();
  if (playScreenShowsRewards()) {
    // Said to a screen reader too, once the verdict of the round has been read out.
    const spoken = parts.join(" ");
    setTimeout(() => {
      if (playScreenShowsRewards()) announcePlay(spoken);
    }, 2500);
  } else {
    celebration.toast = showToast(parts.join(" "), { kind: levelUp ? "levelup" : "achievement", duration: 6500 });
  }
  playSound("levelup", levelUp ? { delay: 0.3 } : undefined);
}

// What a session earned, added up round by round for the closing summary. Achievements
// arrive from the bus (a round and the end of the session can both unlock some).
function newSessionRewards() {
  // `players`: a duel is nobody's combined progress, but each profile player earns their own XP and achievements (the summary
  // shows them card by card, never added together).
  return { xp: 0, cards: 0, unlocked: [], level: null, levelUp: false, players: [{ xp: 0, unlocked: [] }, { xp: 0, unlocked: [] }] };
}

function noteDuelRewards(playerIndex, outcome) {
  const rewards = STATE.session && STATE.session.rewards;
  const mine = rewards && rewards.players ? rewards.players[playerIndex] : null;
  if (mine && outcome) mine.xp += Number(outcome.xpGained) || 0;
}

function noteRoundRewards(outcome) {
  const rewards = STATE.session && STATE.session.rewards;
  if (!rewards || !outcome) return;
  rewards.xp += Number(outcome.xpGained) || 0;
  if (outcome.card && outcome.card.created) rewards.cards += 1;
  if (outcome.level) rewards.level = outcome.level;
  if (outcome.levelUp) rewards.levelUp = true;
}

function noteAchievement(entry, profileId) {
  const rewards = STATE.session && STATE.session.rewards;
  if (!rewards || !entry || !entry.name) return;
  if (isDuelMode()) {
    // Goes to the card of the player whose profile unlocked it (a guest has no profile, so nothing unlocks for them).
    const ids = Array.isArray(STATE.session.profileIds) ? STATE.session.profileIds : [];
    const mine = profileId ? rewards.players[ids.findIndex((id) => id && id === profileId)] : null;
    if (mine && !mine.unlocked.some((known) => known.id === entry.id)) {
      mine.unlocked.push({ id: entry.id, name: entry.name, description: entry.description || "", glyph: entry.glyph || "" });
    }
    return;
  }
  if (!rewards.unlocked.some((known) => known.id === entry.id)) {
    rewards.unlocked.push({ id: entry.id, name: entry.name, description: entry.description || "", glyph: entry.glyph || "" });
  }
}

// Announces a round on the bus and gets the profile's answer for it. The profile records
// the round here, first (Profile.attach() ignores the duplicate that the bus event then
// is), because what it answers is what the coach shows: XP gained, the notebook card that
// was made or graded, the level and the achievements. A guest ("profileId: null") has none.
function emitRoundCompleted(record) {
  let outcome = null;
  const profile = ludusModule("Profile");
  if (record.profileId !== null && profile && typeof profile.recordRound === "function") {
    try {
      const result = profile.recordRound(record);
      if (result && result.ok && !result.duplicate) {
        outcome = {
          xpGained: result.xpGained || 0,
          level: result.level || null,
          levelUp: Boolean(result.levelUp),
          card: result.card || null,
          unlocked: Array.isArray(result.unlocked) ? result.unlocked : [],
        };
      }
    } catch (error) {
      console.error("[Ludus] the profile could not record the round", error);
    }
  }
  busEmit("round:completed", { round: record });
  if (outcome && outcome.levelUp) queueCelebration({ levelUpFor: record.profileId });
  return outcome;
}

// A daily challenge position: finishing the round completes the day.
function completeDailyChallenge(dailyKey, accuracy, profileId) {
  const profile = ludusModule("Profile");
  try {
    if (!profile || !profile.daily || typeof profile.daily.complete !== "function") return;
    const result = profile.daily.complete(dailyKey, accuracy, profileId || undefined);
    if (result && result.levelUp) queueCelebration({ levelUpFor: profileId });
  } catch (error) {
    console.error("[Ludus] the daily challenge could not be completed", error);
  }
}

// Records what each answer earned and announces it. Returns the profile's answer per
// answer (null when there is none), in the order of evaluation.answers.
function recordRoundOutcome(position, base, evaluation) {
  return evaluation.answers.map((answer) => {
    let record = null;
    try {
      record = buildRoundRecord(position, base, evaluation, answer);
    } catch (error) {
      console.error("[Ludus] the round record could not be built", error);
      return null;
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
    const outcome = emitRoundCompleted(record);
    if (!isDuelMode()) noteRoundRewards(outcome);
    else noteDuelRewards(answer.playerIndex, outcome);
    // The day is completed by a real answer: a skipped, timed-out or revealed position is not one
    // (it would hand out the streak, the XP and the achievement for nothing).
    if (position.dailyKey && !isDuelMode() && answer.uci && answer.hintsUsed < 3) completeDailyChallenge(position.dailyKey, record.accuracy, record.profileId);
    return outcome;
  });
}

// What the closing summary and the progress dots read about a finished round: the
// primary answer (in a duel, the better one) in the shape of Ludus.Coach.
function roundView(round) {
  const context = round.context;
  const answers = context.answers;
  const duel = context.kind === "round_duel";
  const primary = duel && answers[1].assessment.points > answers[0].assessment.points ? answers[1] : answers[0];
  const qualityOf = (answer) => (answer.uci ? answer.assessment.qualityCode : "no_move");
  return {
    index: round.index,
    fen: round.fen,
    side: round.side,
    quality: qualityOf(primary),
    points: primary.assessment.points,
    hit: primary.hit,
    noMove: !primary.uci,
    san: primary.san,
    bestSan: context.best.san,
    bestUci: context.best.uci,
    userUci: primary.uci || "",
    players: duel
      ? answers.map((answer) => ({ name: answer.name, san: answer.san, uci: answer.uci || "", points: answer.assessment.points, quality: qualityOf(answer), accuracy: answer.assessment.accuracy, hit: Boolean(answer.hit) }))
      : null,
    duel: duel ? answers.map((answer) => ({ name: answer.name, points: answer.assessment.points })) : undefined,
  };
}

// The answers of the session, kept in memory for the closing summary (it can reopen the
// analysis of any of them).
function rememberRound(position, context) {
  if (!STATE.session) return;
  let side = position.meta && position.meta.sideToMove;
  if (side !== "w" && side !== "b") side = new Chess(position.fen).turn;
  STATE.session.rounds.push({ index: STATE.index, fen: position.fen, side, context });
}

// Solo mode: records the answer, draws the result (board and coach panel), updates the
// score and leaves the UI ready for the next position.
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
  const context = buildRoundContext("round_solo", position, evaluation);
  context.rewards = recordRoundOutcome(position, base, evaluation);
  STATE.resultView.context = context;
  STATE.score = roundScore(STATE.score + assessment.points);
  STATE.sessionPlayed += 1;
  if (answer.hit) STATE.sessionHits += 1;
  rememberRound(position, context);
  setUiPhase("result", true);
  renderResultViewContext();
  showResultOverlay();
  nextBtn.disabled = false;
  skipBtn.disabled = true;
  renderPlayHeader();
  updateHintButton();
  playResultSound(answer);
  // The result is announced once, by #result-overlay-live (and the focus that lands on the verdict):
  // a second announcement of the same points here made a screen reader say it twice.
  afterRoundSettled();
}

// What follows a scored round, solo or duel: the first-run note has done its job, the session
// is recorded the moment its LAST position is answered (leaving by any road afterwards loses
// nothing: the summary is a view of a record that already exists), and the progress of the
// session is kept for a reload.
function afterRoundSettled() {
  if (STATE.session && STATE.session.firstRun) markFirstRunDone();
  if (sessionIsOnLastPosition()) {
    finishSession();
    clearSessionProgress();
  } else {
    saveSessionProgress();
  }
}

// True when the round on screen is the last one of the session (the same rule "next position"
// uses to go to the summary instead): the target is reached, or a fixed list has no more.
function sessionIsOnLastPosition() {
  if (STATE.index >= Math.max(1, STATE.targetPositions) - 1) return true;
  return !STATE.analysisContext && STATE.index >= STATE.positions.length - 1;
}

// Duel mode: builds both players' results, updates duel scores/hits, records both
// answers and draws the comparison, and leaves the UI ready for the next position.
function renderDuelRoundOutcome(base, position, evaluation) {
  // The answers are in player order (buildAnswersToEvaluate): scores, hits and cards are per player, whoever went first.
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
    // A player keeps their arrow in every position (the second player's is "user", the first's "userAlt"), like their card.
    user: second.move || null,
    userAlt: r1.userMove || null,
  };
  captureResultSnapshot(position.fen);
  renderBoard();
  hideHandoffOverlay();
  const context = buildRoundContext("round_duel", position, evaluation);
  context.rewards = recordRoundOutcome(position, base, evaluation);
  STATE.resultView.context = context;
  STATE.sessionPlayed += 1;
  rememberRound(position, context);
  STATE.duel.handoffReady = false;
  setUiPhase("result", true);
  renderResultViewContext();
  showResultOverlay();
  nextBtn.disabled = false;
  skipBtn.disabled = true;
  renderPlayHeader();
  updateHintButton();
  playResultSound(r1.points >= r2.points ? first : second);
  afterRoundSettled();
}

// The end of a session: builds its record, announces it ("session:completed") and
// shows the closing summary in place of the round.
function showSessionSummary({ noMorePositions = false } = {}) {
  const record = finishSession();
  STATE.resultView.review = null;
  // unsaved / unsavedReason: the browser refused to store what this session produced (Profile.storageStatus()); the
  // banner of the shell is hidden while playing, so the summary says it itself.
  const unsavedReason = sessionUnsavedReason();
  STATE.resultView.context = { kind: "session_summary", noMorePositions, session: record, unsaved: Boolean(unsavedReason), unsavedReason };
  if (summaryListsRewards()) dismissCelebration();
  skipBtn.disabled = true;
  stopRoundTimer();
  setUiPhase("result", true);
  updateHintButton();
  renderResultViewContext();
  revealResultOverlay();
  renderPlayHeader();
  updateRoundTimerUi(0);
  renderBoardArrows();
}

// "" when what this session produced was saved, else "blocked" (the browser lets this site store nothing) or
// "quota" (storage is full): Profile counts every write that failed and when the last one did.
function sessionUnsavedReason() {
  const profile = ludusModule("Profile");
  const session = STATE.session;
  if (!profile || !session || typeof profile.storageStatus !== "function") return "";
  try {
    const status = profile.storageStatus();
    if (!status || !(status.failures > 0) || !(status.lastFailureAt >= (session.startedAt || 0) - 1000)) return "";
    return status.available === false || status.reason === "blocked" ? "blocked" : "quota";
  } catch (error) {
    return "";
  }
}

// The line of the summary that says the progress was not saved (and the same words for the live region).
function unsavedNoteText(context) {
  const reason = context && context.unsavedReason;
  return reason ? t(reason === "blocked" ? "core.unsaved.blocked" : "core.unsaved.quota") : "";
}

function paintUnsavedNote(context) {
  if (!sessionSummaryResultEl || typeof sessionSummaryResultEl.insertBefore !== "function") return;
  const text = unsavedNoteText(context);
  if (!text) return;
  const util = ludusModule("util");
  if (!util || typeof util.h !== "function") return;
  const note = util.h("p", { class: "t-small co-unsaved", role: "status" }, text);
  sessionSummaryResultEl.insertBefore(note, sessionSummaryResultEl.firstChild || null);
}

// "Final score: 72.4 / 100 pts", or who won a duel: the text of the live region and of the
// summary when Ludus.Coach is not there.
function summaryFallbackText(record, context) {
  if (!record) return "";
  const noMore = context && context.noMorePositions ? ` ${t("game.noMorePositions")}` : "";
  if (record.mode === "duel" && record.duel) {
    const [p1, p2] = record.duel.names;
    const [s1, s2] = record.duel.scores;
    let winner = t("game.finalDraw");
    if (s1 > s2) winner = t("game.finalWinner", { player: p1 });
    if (s2 > s1) winner = t("game.finalWinner", { player: p2 });
    return t("game.finalMatchScore", { p1, p2, s1: formatPoints(s1), s2: formatPoints(s2), winner }) + noMore;
  }
  const score = t("core.score.of", { points: formatPoints(record.points), max: record.maxPoints });
  return t("game.finalScoreSolo", { score }) + noMore;
}

function sessionRewardsView() {
  const rewards = STATE.session && STATE.session.rewards;
  if (!rewards) return null;
  // A duel has no combined experience card: what each player earned, player by player.
  if (STATE.session.mode === "duel") return { players: rewards.players.map((mine) => ({ xp: mine.xp, unlocked: mine.unlocked.slice() })) };
  return { xp: rewards.xp, cards: rewards.cards, unlocked: rewards.unlocked.slice(), levelAfter: rewards.level, levelUp: rewards.levelUp };
}

function reviewCardCount(profileId) {
  const profile = ludusModule("Profile");
  try {
    const counts = profile && profile.notebook && typeof profile.notebook.counts === "function" ? profile.notebook.counts(undefined, profileId || undefined) : null;
    return counts && Number.isFinite(counts.due) ? counts.due : 0;
  } catch (error) {
    return 0;
  }
}

// A classic or an own-games session can be played again (a review or the daily challenge
// cannot: they are made from what the profile holds today).
function canReplaySession() {
  return Boolean(STATE.session && (STATE.session.kind === "classic" || STATE.session.kind === "own"));
}

// A duel: one "review" button per profile player that has cards to review (each profile has its own notebook; a guest has none).
// Undefined outside a duel, where the single button of the active profile is right.
function duelReviewPlayers() {
  const session = STATE.session;
  if (!session || session.mode !== "duel") return undefined;
  const ids = Array.isArray(session.profileIds) ? session.profileIds : [];
  return [0, 1]
    .filter((index) => ids[index] && reviewCardCount(ids[index]) > 0)
    .map((index) => ({ name: duelPlayerName(index), profileId: ids[index] }));
}

function summaryApi() {
  return {
    lang: STATE.language,
    canReplay: canReplaySession(),
    canReview: reviewCardCount() > 0,
    reviewPlayers: duelReviewPlayers(),
    onPlayAgain: replaySession,
    // A duel can also be played again on the same positions, on purpose (equal ground for the two players).
    canPlaySamePositions: canReplaySession() && STATE.session.mode === "duel" && STATE.session.kind !== "own",
    onPlaySamePositions: () => replaySession({ samePositions: true }),
    onReview: reviewMistakes,
    onShare: shareSummary,
  };
}

function renderSessionSummaryPanel(context) {
  const coach = ludusModule("Coach");
  const session = STATE.session;
  const record = context.session || (session && session.record) || null;
  let drawn = false;
  let model = null;
  if (coach && record && sessionSummaryResultEl && typeof coach.summaryModel === "function") {
    try {
      const rounds = session && Array.isArray(session.rounds) ? session.rounds.map(roundView) : [];
      model = coach.summaryModel({ record, rounds, rewards: sessionRewardsView(), mode: record.mode, lang: STATE.language, noMorePositions: context.noMorePositions });
      coach.renderSummary(sessionSummaryResultEl, model, coachApi());
      if (summaryActionsEl) coach.renderSummaryActions(summaryActionsEl, model, summaryApi());
      paintUnsavedNote(context);
      drawn = true;
    } catch (error) {
      console.error("[Ludus] the coach failed to draw the summary", error);
    }
  }
  STATE.ui.summaryModel = model;
  const unsavedNote = unsavedNoteText(context);
  const text = `${summaryFallbackText(record, context)}${unsavedNote ? ` ${unsavedNote}` : ""}`;
  setResultLive(t("game.sessionDone"), text);
  if (!drawn) {
    if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = record ? t("core.score.of", { points: formatPoints(record.points), max: record.maxPoints }) : "-";
    if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = text;
  }
  if (resultLiveEl) resultLiveEl.classList.toggle("sr-only", drawn);
  if (summaryActionsEl) summaryActionsEl.classList.remove("hidden");
  if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");
}

// The summary reopens the analysis of one of its positions: the board goes back to it,
// the panel shows its result, and "next" becomes "back to the summary".
function openSummaryRound(index) {
  const session = STATE.session;
  const round = session && Array.isArray(session.rounds) ? session.rounds[index] : null;
  if (!round || !STATE.resultView.context || STATE.resultView.context.kind !== "session_summary") return;
  const context = round.context;
  const summaryContext = STATE.resultView.context;
  const answers = context.answers;
  const duel = context.kind === "round_duel";
  STATE.resultView.review = { index, summary: summaryContext };
  STATE.resultView.context = context;
  STATE.board = new Chess(round.fen);
  setBoardPerspective(STATE.board.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.revealed = duel
    ? { best: null, game: null, user: answers[1].move || null, userAlt: answers[0].move || null }
    : { best: answers[0].hintsUsed >= 3 && context.best.uci ? uciMoveSnapshot(context.best.uci) : null, game: null, user: answers[0].move || null, userAlt: null };
  captureResultSnapshot(round.fen);
  STATE.resultView.analysisMode = false;
  STATE.resultView.pv = null;
  setUiPhase("result", true);
  renderBoard();
  renderResultViewContext();
  showResultOverlay();
  nextBtn.disabled = false;
  renderPlayHeader();
}

function uciMoveSnapshot(uci) {
  if (typeof uci !== "string" || uci.length < 4) return null;
  const move = { from: Chess.squareToIndex(uci.slice(0, 2)), to: Chess.squareToIndex(uci.slice(2, 4)) };
  if (uci.length > 4) move.promotion = uci[4];
  return Number.isFinite(move.from) && Number.isFinite(move.to) ? move : null;
}

function backToSummary() {
  const review = STATE.resultView.review;
  if (!review) return;
  STATE.resultView.review = null;
  STATE.resultView.analysisMode = false;
  STATE.resultView.pv = null;
  STATE.resultView.snapshotFen = "";
  STATE.resultView.context = review.summary;
  STATE.revealed = { best: null, game: null, user: null, userAlt: null };
  renderBoard();
  renderResultViewContext();
  revealResultOverlay();
  updateResultAnalysisControls();
  renderPlayHeader();
}

// "Play again" / "Rematch": fresh positions, never the ones whose best moves were just shown
// (they were all on screen a minute ago, a second round would measure memory, not skill): the same
// game when it was one game, else a new mix. A duel rematch can ask for the same positions
// explicitly (options.samePositions, "same positions" button of the summary: equal ground for a
// comparison of the players on purpose). The own games go back to the wizard.
async function drawFreshPositions(played) {
  const classics = ludusModule("Classics");
  if (!classics) return [];
  if (typeof classics.load === "function") await classics.load();
  const playedIds = new Set(played.map((position) => position.id));
  const wanted = played.length;
  const games = Array.from(new Set(played.map((position) => position.classic && position.classic.gameId).filter(Boolean)));
  let fresh = [];
  if (games.length === 1) {
    fresh = (classics.positions(games[0], { shuffle: true }) || []).filter((position) => !playedIds.has(position.id)).slice(0, wanted);
  }
  if (fresh.length < wanted) {
    const exclude = [...playedIds, ...fresh.map((position) => position.id)];
    fresh = fresh.concat(classics.random(wanted - fresh.length, { exclude }) || []);
  }
  return fresh;
}

async function replaySession(options) {
  const session = STATE.session;
  if (!session || !canReplaySession()) return;
  const { kind, mode, title, names, profileIds } = session;
  const played = STATE.positions.slice(0, Math.max(1, STATE.sessionPlayed));
  if (kind === "own") {
    openOwnGamesSetup({ mode, names: names || undefined, profileIds: profileIds || undefined });
    return;
  }
  let positions = played;
  if (!(options && options.samePositions === true)) {
    try {
      const fresh = await drawFreshPositions(played);
      if (Array.isArray(fresh) && fresh.length) positions = fresh;
    } catch (error) {
      positions = played;
    }
  }
  try {
    await startSession({ kind, title, mode, names: names || undefined, profileIds: profileIds || undefined, positions, options: session.options, duelStartOffset: isDuelMode() && STATE.duel.startOffset !== 1 ? 1 : 0 });
  } catch (error) {
    console.warn("[Ludus] the new session could not start", error);
    showToast(t("core.start.failed"), { kind: "error" });
  }
}

// "Review my mistakes now": the notebook has the cards this session just added.
// In a duel the button names a player: that profile becomes the active one first (the notebook shows the active profile's cards).
function reviewMistakes(profileId) {
  if (typeof profileId === "string" && profileId) {
    const profile = ludusModule("Profile");
    try {
      const active = profile && typeof profile.active === "function" ? profile.active() : null;
      if (profile && typeof profile.setActive === "function" && (!active || active.id !== profileId)) profile.setActive(profileId);
    } catch (error) {
      // The notebook opens for whoever is active.
    }
  }
  if (!routerShow("notebook", { review: true })) goHome();
}

// Share: the system sheet when there is one, else the clipboard with a toast, else a
// dialog with the text to copy by hand.
async function shareSummary() {
  const coach = ludusModule("Coach");
  const model = STATE.ui.summaryModel;
  if (!coach || !model) return;
  const text = coach.shareText(model, STATE.language);
  let url = "";
  try {
    url = `${window.location.origin}${window.location.pathname}`;
  } catch (error) {
    url = "";
  }
  const title = t("coach.share.title");
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, text, url: url || undefined });
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;
  }
  const full = url ? `${text}\n${t("coach.share.cta")} ${url}` : text;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(full);
      showToast(t("coach.sum.copied"), { kind: "success" });
      return;
    }
  } catch (error) {
    // fall through to the dialog
  }
  const ui = ludusModule("ui");
  const util = ludusModule("util");
  if (ui && typeof ui.modal === "function" && util && typeof util.h === "function") {
    ui.modal({
      title,
      body: [util.h("p", { class: "modal-text" }, t("coach.sum.shareFailed")), util.h("textarea", { class: "input co-share-text", readonly: true, rows: 6, "aria-label": title }, full)],
      actions: [{ label: t("ui.close"), kind: "primary" }],
    });
  }
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
  // A round reopened from the summary: "next" goes back to the summary.
  if (STATE.resultView.review) {
    backToSummary();
    return;
  }
  if (STATE.resultView.analysisMode) {
    applyResultSnapshotToBoard();
    STATE.resultView.analysisMode = false;
    updateResultAnalysisControls();
  }
  const resultSnapshot = captureResultViewSnapshot();
  hideResultOverlay();
  if (coachScrollEl) coachScrollEl.scrollTop = 0;

  if (isDuelMode()) {
    // Whoever goes first in the NEXT position is the one the scoreboard points at while it is being found.
    STATE.duel.firstPlayer = duelFirstPlayerFor(STATE.index + 1);
    STATE.duel.currentPlayer = STATE.duel.firstPlayer;
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
    showPositionSearchOverlay(t("overlay.searchingNext"), "", { cancellable: true, facts: true });
    setUiPhase("loading_next_position", true);
    const sessionToken = STATE.sessionToken;
    const search = await findNextMistake(ctx, { next: true });
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

// The cover of a new duel position, the first one included: it says who goes first (they take turns, PF-2), that the
// device goes to them and that the clock has not started. One tap starts it.
function readyTexts() {
  const first = duelPlayerName(STATE.duel.firstPlayer);
  const second = duelPlayerName(duelSecondPlayer());
  return {
    title: t("game.ready.title", { player: first }),
    subtitle: t("game.ready.subtitle", { player: first, other: second }),
    eyebrow: t("play.ready.eyebrow", { current: STATE.index + 1, total: soloSessionTarget() }),
    avatar: initialsFromName(first, `P${STATE.duel.firstPlayer + 1}`),
  };
}

function beginDuelReadyGate() {
  STATE.duel.readyWait = true;
  // The board, the hint and the skip button are closed until the tap; the clock shows the full time and does not run.
  setUiPhase("duel_ready", true);
  skipBtn.disabled = true;
  STATE.timer.durationMs = isUntimedSession() ? 0 : Math.round(normalizeTurnTimeSeconds(STATE.turnTimeSeconds) * 1000);
  updateRoundTimerUi(STATE.timer.durationMs);
  updateHintButton();
  const ready = readyTexts();
  showHandoffOverlay(ready.title, ready.subtitle, ready);
  renderPlayHeader();
  announcePlay(`${ready.eyebrow}. ${ready.title}. ${ready.subtitle}`);
}

function beginDuelRoundAfterReady() {
  STATE.duel.readyWait = false;
  hideHandoffOverlay();
  setUiPhase("playing", false);
  skipBtn.disabled = false;
  startRoundTimer();
  updateHintButton();
  focusBoardAfterRoundStart();
}

function revealDuelSecondTurn() {
  if (!isDuelMode()) return;
  if (STATE.duel.readyWait) {
    beginDuelRoundAfterReady();
    return;
  }
  if (STATE.ui.phase !== "handoff_ready") return;
  if (STATE.duel.currentPlayer !== STATE.duel.firstPlayer) return;
  if (!STATE.duel.roundResults[0]) return;
  STATE.duel.currentPlayer = duelSecondPlayer();
  STATE.duel.handoffReady = false;
  hideHandoffOverlay();
  startRound({ preserveDuelRoundResults: true });
}

// Clears everything a session left on the page: the round, the clock, the
// overlays, the summary, the hints. It does not route anywhere.
function resetGameSurface() {
  stopRoundTimer();
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  closePromotionPicker({ skipFocusReturn: true });
  hideResultOverlay();

  if (resultOverlayInnerEl) resultOverlayInnerEl.classList.remove("hidden");
  if (sessionSummaryResultEl) sessionSummaryResultEl.classList.add("hidden");
  if (summaryActionsEl) summaryActionsEl.classList.add("hidden");
  if (resultLiveEl) resultLiveEl.classList.add("sr-only");
  if (coachThinkingEl) coachThinkingEl.textContent = "";

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
  STATE.score = 0;
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  STATE.ui.lastShownScore = 0;
  STATE.ui.summaryModel = null;
  resetHintState();
  resetDuelState();
  renderSessionTitle();
  renderPlayHeader();
  updateHintButton();
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
  // Leaving on purpose forgets the session: only an unload (a reload, a closed tab) leaves its progress behind.
  clearSessionProgress();
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
  // A finished session is already recorded (it is, from the moment its last position is answered):
  // leaving it loses nothing, so nothing is asked.
  if (STATE.session && STATE.session.completed) return true;
  // What is lost is the summary, not the answers: they are already in the progress and the notebook (unless the browser refused
  // to store them: then the answers go too, and the dialog must not say otherwise, PC-2).
  const answered = Math.max(0, STATE.sessionPlayed);
  const body = answered <= 0
    ? t("confirm.restartToSetup.none")
    : t(sessionUnsavedReason() ? "confirm.restartToSetup.unsaved" : "confirm.restartToSetup", { answered });
  return showConfirmModal({
    title: t("confirm.restartTitle"),
    body,
    acceptLabel: t("confirm.restartAccept"),
    cancelLabel: t("confirm.restartCancel"),
    // Nothing irreversible hangs on this question: without the dialog's markup the exit still works.
    allowWithoutDialog: true,
  });
}

// ---------- A session interrupted by a reload or a closed tab ----------
// Answered rounds are recorded one by one, so a reload loses only the session's summary; the
// tab keeps (sessionStorage: this tab only, gone with it) what is needed to offer to go on, and
// the tab warns before it is closed (desktop browsers; phones ignore the warning) while a session
// with answers is running.

function sessionNeedsLeaveWarning() {
  const session = STATE.session;
  return Boolean(session && !session.completed && (STATE.sessionPlayed > 0 || STATE.isResolvingRound));
}

function onBeforeUnload(event) {
  if (!sessionNeedsLeaveWarning()) return undefined;
  event.preventDefault();
  // The text is the browser's own; the assignment is what makes Chrome ask.
  event.returnValue = "";
  return "";
}

function sessionStore() {
  try {
    return window.sessionStorage || null;
  } catch (error) {
    return null;
  }
}

function clearSessionProgress() {
  const store = sessionStore();
  try {
    if (store) store.removeItem(SESSION_PROGRESS_STORAGE_KEY);
  } catch (error) {
    // Nothing kept, nothing to clear.
  }
}

// Kept after every round: what was answered and, for a solo list of positions, the positions that
// are left (an own-games session or a duel cannot be rebuilt: it only leaves the note).
function saveSessionProgress() {
  const session = STATE.session;
  const store = sessionStore();
  if (!session || session.completed || !store) return;
  const resumable = session.mode === "solo" && session.kind !== "own" && !STATE.analysisContext;
  const record = {
    v: 1,
    at: Date.now(),
    id: session.id,
    kind: session.kind,
    title: session.title,
    mode: session.mode,
    profileIds: session.profileIds,
    options: session.options || {},
    answered: Math.max(0, STATE.sessionPlayed),
    total: Math.max(1, STATE.targetPositions),
    remaining: resumable ? STATE.positions.slice(Math.max(0, STATE.sessionPlayed)) : null,
    // "" | "blocked" | "quota": whether the profile's storage refused what this session produced. The page that offers to
    // resume is a new one (Profile's counters start again), so it cannot know this by itself (PC-2).
    unsaved: sessionUnsavedReason(),
  };
  try {
    let text = JSON.stringify(record);
    // A few hundred KB at most: sessionStorage is small and this is a convenience.
    if (text.length > 400000) {
      record.remaining = null;
      text = JSON.stringify(record);
    }
    store.setItem(SESSION_PROGRESS_STORAGE_KEY, text);
  } catch (error) {
    // Full or blocked: the warning before leaving still works.
  }
}

function readSessionProgress() {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || record.v !== 1 || !Number.isFinite(record.answered)) return null;
    return record;
  } catch (error) {
    return null;
  }
}

// At boot: a record left by a session that was interrupted (it is removed the moment it is read,
// so it is offered once). With answers and positions left it offers to go on; otherwise it only
// says that what was answered is saved.
// Whether what an interrupted session answered reached the profile's storage: "" when it did, else "blocked" or "quota".
// Two witnesses, because the page that asks is a new one: the record the old page left (its Profile saw the write fail) and
// the storage as it is now (a browser that blocks site data is blocked again after a reload). The worse reason wins.
function resumeStorageProblem(record) {
  const reasons = [record && record.unsaved];
  const profile = ludusModule("Profile");
  try {
    const status = profile && typeof profile.storageStatus === "function" ? profile.storageStatus() : null;
    if (status && status.ok === false) reasons.push(status.available === false || status.reason === "blocked" ? "blocked" : "quota");
  } catch (error) {
    // No answer: only the record speaks.
  }
  return reasons.includes("blocked") ? "blocked" : (reasons.includes("quota") ? "quota" : "");
}

// "That is already saved in your progress", or what is true when it was not (PC-2).
function resumeSavedText(record) {
  const problem = resumeStorageProblem(record);
  return t(problem ? `core.resume.unsaved.${problem}` : "core.resume.saved");
}

async function offerSessionResume() {
  const record = readSessionProgress();
  clearSessionProgress();
  if (!record || record.answered < 1 || STATE.session) return;
  const remaining = Array.isArray(record.remaining) ? normalizeSessionPositions(record.remaining, record.kind) : [];
  const saved = resumeSavedText(record);
  if (record.mode !== "solo" || !remaining.length) {
    showToast(t("core.resume.note", { answered: record.answered, total: Math.max(record.answered, Number(record.total) || 0), saved }), { kind: "info", duration: 9000 });
    return;
  }
  const accepted = await showConfirmModal({
    title: t("core.resume.title"),
    body: t("core.resume.body", {
      title: record.title || defaultSessionTitle(record.kind),
      answered: record.answered,
      total: record.total,
      saved,
      left: t(remaining.length === 1 ? "core.resume.left.one" : "core.resume.left", { remaining: remaining.length }),
    }),
    acceptLabel: t("core.resume.continue"),
    cancelLabel: t("core.resume.discard"),
    allowWithoutDialog: false,
  });
  if (!accepted || STATE.session) return;
  try {
    await startSession({ kind: record.kind, title: record.title, mode: "solo", positions: remaining, options: record.options });
  } catch (error) {
    console.warn("[Ludus] the interrupted session could not be resumed", error);
    showToast(t("core.resume.failed"), { kind: "error" });
  }
}

// ---------- First run ----------
// The very first session has no clock (the person has not read how it works yet) and says how to
// play at the top of the panel. It ends with the first answered round.

function isFirstRun() {
  try {
    if (Ludus.storage.get(FIRST_RUN_STORAGE_KEY, 0)) return false;
  } catch (error) {
    // Storage unavailable: treat as not first run, nothing is gained by guessing.
    return false;
  }
  return !hasPlayedBefore();
}

function markFirstRunDone() {
  try {
    Ludus.storage.set(FIRST_RUN_STORAGE_KEY, 1);
  } catch (error) {
    // Only costs the note on a later session.
  }
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
    // No legal move is not a position to play, and neither is a single one: a forced move is no decision
    // (it would be worth 10 points for playing the only move there is).
    if (!board || board.generateMoves().length < 2) return;
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
    ? [0, 1].map((index) => sanitizePlayerName(Array.isArray(cfg.names) ? cfg.names[index] : "", defaultDuelPlayerName(index)).slice(0, playerNameMax()))
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
  STATE.duel.startOffset = cfg.duelStartOffset === 1 ? 1 : 0;
  resetDuelState();
  applySessionOptions(cfg.options);
  // The very first session has no clock (unless a screen asked for one): see isFirstRun().
  const firstRun = isFirstRun();
  if (firstRun && !(cfg.options && cfg.options.clock)) STATE.clockMode = "untimed";
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
    firstRun,
    records: [],
    record: null,
    // What the closing summary is made of: the answers, in order, and what they earned.
    rounds: [],
    rewards: newSessionRewards(),
  };
  updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
  const session = STATE.session;
  // The engine loads while the first round is played; when it is up, the analysis
  // that scoring needs (and a better hint) starts on the position still on screen.
  void ensureStockfishLoading().then((ready) => {
    if (!ready || STATE.session !== session || STATE.roundSubmitted || !session || session.completed) return;
    prefetchRoundReference(STATE.positions[STATE.index]);
    updateHintButton();
    // The "backup engine" notice of the panel goes away once the strong one is up.
    if (STATE.ui.gamePhase === "thinking") renderThinkingPanel();
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
  syncRevealButtons();
  renderSessionTitle();
  renderPlayHeader();
  updateHintButton();
  updateRoundTimerUi();
  syncSoundButton();
  updateNextButton();
  setCoachExpanded(Boolean(gameLayoutEl && gameLayoutEl.dataset && gameLayoutEl.dataset.expanded));
  updatePgnSelectionUi();
  updateConfirmButton();
  refreshArmedLabels();
  if (STATE.setupWizard.sourceError?.key) {
    // The same message, in the other language, from its key and numbers (the countdown goes on from where it is).
    const shown = STATE.setupWizard.sourceError;
    showWizardSourceError(shown.key, shown.params || {}, shown.field || null, { actions: shown.actions, seconds: shown.seconds });
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

  if (STATE.board) renderBoard();

  // The coach panel is drawn from data alone, so it follows the language; a result being
  // explored keeps its stepper (the state lives in STATE.resultView.pv).
  if (STATE.resultView.visible && STATE.resultView.context) {
    renderResultViewContext();
  } else if (STATE.positions[STATE.index] && (STATE.ui.gamePhase === "thinking" || STATE.ui.gamePhase === "handoff")) {
    renderThinkingPanel(STATE.ui.gamePhase === "handoff" && !STATE.duel.readyWait ? duelSecondPlayer() : undefined);
  } else if (STATE.ui.gamePhase === "evaluating") {
    renderEvaluatingPanel();
  }

  if (handoffOverlayEl && !handoffOverlayEl.classList.contains("hidden") && isDuelMode() && STATE.duel.currentPlayer === STATE.duel.firstPlayer) {
    const handoff = STATE.duel.readyWait ? readyTexts() : handoffTexts();
    showHandoffOverlay(handoff.title, handoff.subtitle, handoff);
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

// The dock's "best move" and "move of the game" buttons: each draws its arrow on the
// board (and shows the move in its label), and a second press takes it away. They read
// the result on screen, so they also work on a round reopened from the summary.
function revealSpecificMove(type) {
  const context = STATE.resultView.context;
  if (!context || !STATE.resultView.visible || context.kind === "session_summary") return;
  if (!STATE.revealed) STATE.revealed = {};
  const shown = STATE.resultView.shown || (STATE.resultView.shown = { best: false, game: false });
  const source = type === "best" ? context.best : context.master;
  const slot = type === "best" ? "best" : "game";
  if (!source || !source.uci) return;
  if (shown[type]) {
    shown[type] = false;
    STATE.revealed[slot] = null;
  } else {
    STATE.revealed[slot] = uciMoveSnapshot(source.uci);
    shown[type] = true;
  }
  syncRevealButtons();
  renderBoard();
}

// Keeps the labels and the pressed state of the two buttons in step with what is drawn.
function syncRevealButtons() {
  const context = STATE.resultView.context;
  const shown = STATE.resultView.shown || {};
  const round = context && context.kind !== "session_summary";
  if (revealBestBtn) {
    const on = Boolean(shown.best && round && context.best);
    revealBestBtn.setAttribute("aria-pressed", on ? "true" : "false");
    revealBestBtn.classList.toggle("revealed-state", on);
    if (revealBestLabelEl) revealBestLabelEl.textContent = on ? t("evaluation.bestPrefix", { san: sanForPerson(context.best.san) || "-" }) : t("buttons.revealBest");
  }
  if (revealGameBtn) {
    const on = Boolean(shown.game && round && context.master);
    revealGameBtn.setAttribute("aria-pressed", on ? "true" : "false");
    revealGameBtn.classList.toggle("revealed-state", on);
    if (revealGameLabelEl) revealGameLabelEl.textContent = on ? t("evaluation.gamePrefix", { san: sanForPerson(context.master.san) || "-" }) : revealGameButtonLabel();
  }
}

async function getActivePgnTextSources() {
  if (!hasAnyPgnSource(true)) return [];
  return STATE.remotePgnSources.map((entry) => ({
    name: entry.name,
    text: entry.text,
    username: entry.username || "",
  }));
}

// ---------- Own games: what a download says when it fails, and what comes before it ----------

// The failure of the download that just ended, for the pipeline to show ({ key, params, actions, seconds }
// or { kind: "consent", ... }): the download knows what happened, the pipeline knows where to put the person.
function setDownloadFailure(view) {
  STATE.setupWizard.downloadFailure = view || null;
}

// What each failure means for the person, in the terms of remoteErrorView's callers: a headline that says what
// really happened (the user is not there, has no games, the provider asks for a pause or is having trouble, the
// device is offline...) and the remedies that fit it. Never the text of an exception.
function remoteErrorView(error, provider, user) {
  const code = error instanceof RemoteFetchError ? error.code : "unknown";
  const base = { provider: providerLabel(provider), user: user || "" };
  switch (code) {
    case "notFound": return { key: "download.error.notFound", params: base, actions: ["user", "platform"] };
    case "noGames": return { key: "download.error.noGames", params: base, actions: ["user", "platform"] };
    case "userMissing": return { key: "provider.requestedPlayerMissing", params: base, actions: ["user", "platform"] };
    case "rateLimited": {
      const seconds = Math.max(1, Math.ceil((Number(error.params && error.params.retryAfterMs) || RATE_LIMIT_PAUSE_MS) / 1000));
      return { key: "download.error.rateLimited", params: { ...base, seconds }, actions: ["retry"], seconds };
    }
    case "server": return { key: "download.error.server", params: { ...base, status: error.params && error.params.status ? error.params.status : "" }, actions: ["retry", "platform"] };
    case "offline": return { key: "download.error.offline", params: base, actions: ["retry"] };
    case "network": return { key: "download.error.network", params: base, actions: ["retry"] };
    case "timeout": return { key: "download.error.timeout", params: base, actions: ["retry"] };
    case "malformed": return { key: "download.error.malformed", params: base, actions: ["retry", "platform"] };
    case "tooLarge": return { key: "network.responseTooLarge", params: base, actions: ["retry"] };
    case "consentUnavailable": return { key: "download.error.consentUnavailable", params: base, actions: ["retry"] };
    default:
      console.error("[Ludus] the download failed", error);
      return { key: "download.error.unknown", params: base, actions: ["retry"] };
  }
}

// A failure that may still be answered by the last saved base (the provider is slow or away), as opposed to
// one that a saved base cannot fix (the user does not exist, has no games).
function remoteErrorIsTransient(error) {
  return error instanceof RemoteFetchError && ["rateLimited", "server", "offline", "network", "timeout", "tooLarge"].includes(error.code);
}

// The status of the download, where the person can see it (the wizard shows step 3 while it runs) and in
// the field's own line on step 2.
function setDownloadStatus(text) {
  if (onlineStatusEl) onlineStatusEl.textContent = text;
  if (analysisStatusEl) analysisStatusEl.textContent = text;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// True when at least one of the downloaded games has the person among its players: a download that does not
// is not theirs (the provider answered with somebody else's games, or the name is not what they typed).
function pgnIncludesPlayer(text, username) {
  if (!String(username || "").trim()) return true;
  return new RegExp(String.raw`^\[(?:White|Black)\s+"${escapeRegExp(username)}"\]`, "im").test(String(text || ""));
}

// The last username per provider, kept in this browser only (and forgotten with the saved games): someone who
// trains on their own games comes back to the same name. Not kept when the person asked not to keep downloads.
function readLastUsers() {
  try {
    const stored = Ludus.storage.get(LAST_USER_STORAGE_KEY, {});
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch (error) {
    return {};
  }
}

function rememberLastUsername(provider, username) {
  if (loadNoPersistDownloadsPreference() || !remoteUsernameIsValid(String(username || ""), provider)) return;
  try {
    Ludus.storage.set(LAST_USER_STORAGE_KEY, { ...readLastUsers(), [provider]: String(username) });
  } catch (error) {
    // A convenience only.
  }
}

function forgetLastUsernames() {
  try {
    Ludus.storage.remove(LAST_USER_STORAGE_KEY);
  } catch (error) {
    // Nothing kept, nothing to forget.
  }
}

// Puts the remembered username in an empty field (the consent step still asks to type it again).
function prefillLastUsername() {
  if (!onlineUserInputEl || String(onlineUserInputEl.value || "").trim()) return;
  const last = readLastUsers()[getRemoteProviderModeFromUi()];
  if (typeof last === "string" && last) {
    onlineUserInputEl.value = last;
    STATE.setupWizard.username = last;
  }
}

// Everything both providers do before asking for anything: the saved base when one covers the request, the
// courtesy pause, and the consent (which fails closed: without its dialog nothing is downloaded). Returns
// { finished: true, result } when it is over already (a saved base was used, or the download must not go on, with
// the reason in STATE.setupWizard.downloadFailure), or { finished: false } to go on to the network.
async function beginRemoteDownload(provider, rawUser, cacheKey, settings) {
  const cached = await readCachedRemotePgn(cacheKey, { minRequested: settings.maxGames });
  if (cached) return { finished: true, result: installRemotePgnSource(cached.source, { messageKey: "provider.usingCachedBase" }) };

  const block = remoteFetchThrottleBlock(provider);
  if (block) {
    setDownloadFailure({ key: block.key, params: block.params, actions: ["retry"], seconds: block.seconds || 0 });
    return { finished: true, result: false };
  }

  if (!consentDialogAvailable()) {
    setDownloadFailure(remoteErrorView(new RemoteFetchError("consentUnavailable"), provider, rawUser));
    return { finished: true, result: false };
  }
  if (!(await confirmRemoteFetchConsent(provider, rawUser))) {
    setDownloadFailure({ kind: "consent", key: "privacy.remoteFetchCancelled", params: { provider: providerLabel(provider) } });
    return { finished: true, result: false };
  }
  return { finished: false };
}

// The ready line of a finished download, with how it was made up.
function downloadReadyText({ bulletGames, blitzGames, qualityWarning, totalGames, rawUser, slowGames, preferredLabel }) {
  if (bulletGames > 0) {
    return t("provider.readyBullet", {
      warning: `${qualityWarning} `,
      total: totalGames,
      user: rawUser,
      slow: slowGames,
      preferred: preferredLabel,
      blitz: blitzGames,
      bullet: bulletGames,
    });
  }
  if (blitzGames > 0) {
    return t("provider.readyBlitz", { total: totalGames, user: rawUser, slow: slowGames, preferred: preferredLabel, blitz: blitzGames });
  }
  return t("provider.readyPreferred", { total: totalGames, user: rawUser, preferred: preferredLabel });
}

async function fetchLichessPgn() {
  const provider = "lichess";
  setDownloadFailure(null);
  const rawUser = getConfiguredRemoteUsername();
  if (!rawUser) {
    showWizardSourceError("provider.enterLichessContinue", {}, "username");
    return false;
  }

  const settings = getLichessFetchSettings();
  const nowMs = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const sinceMs = nowMs - oneYearMs;
  const preferredLabel = joinPreferredTimeClasses(settings.preferredPerf);
  const cacheKey = remotePgnCacheKey(provider, rawUser, cacheSignature({
    provider,
    preferredPerf: settings.preferredPerf,
    fallbackBlitz: settings.fallbackBlitz,
    fallbackBullet: settings.fallbackBullet,
  }));

  const start = await beginRemoteDownload(provider, rawUser, cacheKey, settings);
  if (start.finished) return start.result;

  if (STATE.userMode === "citizen") {
    setDownloadStatus(t("provider.downloadingFor", { user: rawUser, protocol: describeLichessNormalProtocol(settings) }));
  } else {
    setDownloadStatus(t("provider.searchingUpTo", { max: settings.maxGames, user: rawUser, preferred: preferredLabel }));
  }

  // The request can be cancelled (the person pressed "cancel", left the wizard, started another session): one
  // controller for every request of this download, reachable through activeRemoteDownloadController.
  const downloadController = typeof AbortController === "function" ? new AbortController() : null;
  activeRemoteDownloadController = downloadController;
  const downloadSignal = downloadController ? downloadController.signal : undefined;
  let counted = false;

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
      signal: downloadSignal,
    });
    if (!response.ok) throw remoteStatusError(response);
    // A download that reached the provider and was answered counts for the courtesy limit; one it refused does not.
    if (!counted) {
      counted = true;
      recordRemoteFetch();
    }
    const text = await readResponseTextWithLimit(response, undefined, downloadSignal);
    return { text, games: countPgnGames(text) };
  };
  const pause = async () => {
    await sleepMs(220);
    if (downloadSignal?.aborted) throw new RemoteFetchError("cancelled");
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
      setDownloadStatus(t("provider.completingBlitz", { count: totalGames, preferred: preferredLabel, remaining }));
      await pause();
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
      setDownloadStatus(t("provider.bulletAttempt", { context: warningContext, remaining }));
      await pause();
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

    if (totalGames <= 0) throw new RemoteFetchError("noGames");
    // The games must be the person's: checked BEFORE anything says "ready" (or is kept for next time).
    if (!pgnIncludesPlayer(finalText, rawUser)) throw new RemoteFetchError("userMissing");

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    const source = {
      name: `lichess_${safeUser}_${today}.pgn`,
      text: finalText,
      provider,
      username: rawUser,
      games: totalGames,
      requestedMax: settings.maxGames,
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
    rememberLastUsername(provider, rawUser);
    setDownloadStatus(downloadReadyText({ bulletGames, blitzGames, qualityWarning, totalGames, rawUser, slowGames: slow.games, preferredLabel }));
    return true;
  } catch (error) {
    // Cancelled (a new session started, or the person pressed "cancel"): nothing to report, the screen has moved on.
    if (downloadSignal?.aborted || (error instanceof RemoteFetchError && error.code === "cancelled")) return false;
    if (error instanceof RemoteFetchError && error.code === "rateLimited") recordRemoteCooldown(provider, error.params.retryAfterMs);
    if (remoteErrorIsTransient(error)) {
      const stale = await readCachedRemotePgn(cacheKey, { allowStale: true, minRequested: settings.maxGames });
      if (stale) return installRemotePgnSource(stale.source, { messageKey: "provider.usingStaleCachedBase" });
    }
    setDownloadFailure(remoteErrorView(error, provider, rawUser));
    return false;
  } finally {
    if (activeRemoteDownloadController === downloadController) {
      activeRemoteDownloadController = null;
    }
  }
}

// A monthly archive of a player, and only that: https on api.chess.com, /pub/player/<the person>/games/YYYY/MM.
// An address of any other shape (another host, another path, another player) is never asked for, whatever the
// list says (the list comes from the network; the page's own CSP is a second fence, not the only one).
function parseChessComArchiveUrl(url, username) {
  let parsed = null;
  try {
    parsed = new URL(String(url || ""));
  } catch (error) {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.host !== "api.chess.com" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  const match = parsed.pathname.match(/^\/pub\/player\/([^/]+)\/games\/(\d{4})\/(\d{2})\/?$/);
  if (!match) return null;
  if (username && normalizeName(decodeURIComponent(match[1])) !== normalizeName(username)) return null;
  const year = Number(match[2]);
  const month = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { url: parsed.href, year, month };
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
  const provider = "chesscom";
  setDownloadFailure(null);
  const rawUser = getConfiguredRemoteUsername();
  if (!rawUser) {
    showWizardSourceError("provider.enterChesscomContinue", {}, "username");
    return false;
  }

  const settings = getChessComFetchSettings();
  const preferredLabel = joinPreferredTimeClasses(settings.preferredSlowClasses);
  const cacheKey = remotePgnCacheKey(provider, rawUser, cacheSignature({
    provider,
    preferredSlowClasses: settings.preferredSlowClasses,
    fallbackBlitz: settings.fallbackBlitz,
    fallbackBullet: settings.fallbackBullet,
  }));

  const start = await beginRemoteDownload(provider, rawUser, cacheKey, settings);
  if (start.finished) return start.result;

  if (STATE.userMode === "citizen") {
    setDownloadStatus(t("provider.downloadingFor", { user: rawUser, protocol: describeChessComNormalProtocol(settings) }));
  } else {
    setDownloadStatus(t("provider.searchingUpTo", { max: settings.maxGames, user: rawUser, preferred: preferredLabel }));
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
    if (!response.ok) throw remoteStatusError(response);
    const payload = await readResponseJsonWithLimit(response, undefined, downloadSignal);
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
    if (!archivesResponse.ok) throw remoteStatusError(archivesResponse);
    // The provider answered: this download counts for the courtesy limit from here on.
    recordRemoteFetch();
    const archivesPayload = await readResponseJsonWithLimit(archivesResponse, undefined, downloadSignal);
    const archives = (Array.isArray(archivesPayload?.archives) ? archivesPayload.archives : [])
      .map((entry) => parseChessComArchiveUrl(entry, rawUser))
      .filter(Boolean)
      .filter((archive) => isArchiveInLastTwelveMonths(archive.year, archive.month))
      .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

    if (archives.length === 0) throw new RemoteFetchError("noGames");

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
          // A month that cannot be read is skipped (and said at the end); a pause the provider asked for or a
          // cancellation stops the whole download instead of knocking on the next month's door.
          if (archiveError instanceof RemoteFetchError && ["rateLimited", "cancelled"].includes(archiveError.code)) throw archiveError;
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
      setDownloadStatus(t("provider.completingBlitz", { count: totalGames, preferred: preferredLabel, remaining }));
      await sleepMs(220);
      blitzGames = await runArchivePass(new Set(["blitz"]), "Blitz");
    }

    let warningContext = "";
    if (settings.fallbackBullet && totalGames < settings.minSlowGames && totalGames < settings.maxGames && withinBudget()) {
      const remaining = settings.maxGames - totalGames;
      warningContext = blitzGames > 0
        ? t("provider.bulletContextStillShort", { user: rawUser, preferred: preferredLabel })
        : t("provider.bulletContextNoBlitz", { user: rawUser, preferred: preferredLabel });
      setDownloadStatus(t("provider.bulletAttempt", { context: warningContext, remaining }));
      await sleepMs(220);
      bulletGames = await runArchivePass(new Set(["bullet"]), "Bullet");
      if (bulletGames > 0) {
        qualityWarning = t("provider.bulletCompleted", { context: warningContext });
      }
    }

    if (totalGames <= 0 || selectedPgn.length === 0) throw new RemoteFetchError("noGames");
    const pgnText = `${selectedPgn.join("\n\n")}\n`;
    if (!pgnIncludesPlayer(pgnText, rawUser)) throw new RemoteFetchError("userMissing");

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    const source = {
      name: `chesscom_${safeUser}_${today}.pgn`,
      text: pgnText,
      provider,
      username: rawUser,
      games: totalGames,
      requestedMax: settings.maxGames,
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
    rememberLastUsername(provider, rawUser);
    let readyMessage = downloadReadyText({ bulletGames, blitzGames, qualityWarning, totalGames, rawUser, slowGames, preferredLabel });
    if (failedMonthLabels.length > 0) {
      readyMessage = `${readyMessage} ${t("provider.monthsSkipped", { months: failedMonthLabels.join(", ") })}`;
    }
    if (budgetExceeded) {
      readyMessage = `${readyMessage} ${t("provider.downloadBudgetExceeded")}`;
    }
    setDownloadStatus(readyMessage);
    return true;
  } catch (error) {
    // The download was aborted because a new session started (see
    // beginSessionWork) or the person cancelled it, not because of a real
    // failure: whatever screen the person is on now has already moved past this
    // download, so there is nothing useful to show here.
    if (downloadSignal?.aborted || (error instanceof RemoteFetchError && error.code === "cancelled")) return false;
    if (error instanceof RemoteFetchError && error.code === "rateLimited") recordRemoteCooldown(provider, error.params.retryAfterMs);
    if (remoteErrorIsTransient(error)) {
      const stale = await readCachedRemotePgn(cacheKey, { allowStale: true, minRequested: settings.maxGames });
      if (stale) return installRemotePgnSource(stale.source, { messageKey: "provider.usingStaleCachedBase" });
    }
    setDownloadFailure(remoteErrorView(error, provider, rawUser));
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

  try {
    await ensureEngineForSession();
    if (!isCurrentSessionWork(sessionToken)) return;
    if (!(await ensurePgnSourceAvailable(sessionToken))) return;

    const ctx = await loadCandidateAnalysisContext(effectiveConfig);
    if (!ctx) return;

    const firstSearch = await findNextMistake(ctx, { first: true });
    if (!isCurrentSessionWork(sessionToken)) return;
    if (!firstSearch.mistake) {
      sendWizardBackToSourceStep("provider.noUsefulMistakes", { analyzed: ctx.analyzed, total: ctx.total }, { actions: ["user", "platform"] });
      return;
    }

    enterPlayModeWithFirstPosition(firstSearch.mistake, ctx);
  } catch (error) {
    if (!isCurrentSessionWork(sessionToken)) return;
    // Whatever broke is for the console; the person is told something they can act on.
    console.error("[Ludus] the analysis of the games failed", error);
    if (analysisProgressWrapEl) analysisProgressWrapEl.classList.add("hidden");
    if (analysisMetricsEl) analysisMetricsEl.classList.add("hidden");
    sendWizardBackToSourceStep("analysis.status.failed", {}, { actions: ["retry", "platform"] });
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
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();
  setUiPhase("playing", false);
  STATE.session = null;
  STATE.scoringOverride = null;
  // The clock is the wizard's (it started from the setting and changed only this session).
  STATE.clockMode = STATE.setupWizard.clockMode === "untimed" ? "untimed" : "timed";
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
  renderPlayHeader();
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
  // Do not hold the session hostage to a 7 MB download on a bad connection: the wait goes on while bytes keep
  // arriving (and says how far they are), and ends when they stop: the session then starts on the local engine
  // and the download carries on, so later rounds can still use the strong one.
  void ensureStockfishLoading();
  await waitForEngineToLoad({
    onProgress: (download) => {
      if (download.state === "downloading" && Number.isFinite(download.ratio)) {
        analysisStatusEl.textContent = t("core.engine.downloading", { pct: Math.round(download.ratio * 100) });
      }
    },
    onGiveUp: () => {
      analysisStatusEl.textContent = t("core.engine.slow");
    },
  });
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
    const failure = STATE.setupWizard.downloadFailure;
    STATE.setupWizard.downloadFailure = null;
    if (configChanged) {
      sendWizardBackToSourceStep("provider.configChangedDuringDownload", {}, { actions: ["user", "platform"] });
    } else if (failure && failure.kind === "consent") {
      // A "no" to the privacy question is an answer, not a failure: the person stays where they are, told that
      // nothing was sent, and nothing offers them another user.
      STATE.ui.setupAnalyzing = false;
      setWizardFormControlsDisabled(false);
      resetAnalysisProgress();
      if (analysisProgressWrapEl) analysisProgressWrapEl.classList.add("hidden");
      if (analysisStatusEl) analysisStatusEl.textContent = t(failure.key, failure.params);
      updateAnalyzeButtonState();
    } else if (failure) {
      sendWizardBackToSourceStep(failure.key, failure.params, { actions: failure.actions, seconds: failure.seconds });
    } else {
      sendWizardBackToSourceStep("common.sourceError", {}, { actions: ["retry"] });
    }
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
    ? `${t("analysis.status.firstReady")} ${engineFallbackNotice()}`
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
    // The clock chosen in the wizard belongs to this session: a change in Settings does not reach it.
    options: { clock: { mode: STATE.clockMode, seconds: STATE.turnTimeSeconds } },
    startedAt: Date.now(),
    positions: STATE.targetPositions,
    completed: false,
    firstRun: isFirstRun(),
    records: [],
    record: null,
    rounds: [],
    rewards: newSessionRewards(),
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
    // "Previous" is the same step back the browser's Back makes (one history entry less).
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
    // The line of the last step says what "Start session" will do (not that "the next step" comes).
    if (analysisStatusEl && current + 1 === 3) analysisStatusEl.textContent = t("wizard.step3.analysisPrompt");
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
    prefillLastUsername();
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
    prefillLastUsername();
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
  // "@name" or a pasted profile address becomes the name it stands for once the field is left.
  onlineUserInputEl.addEventListener("change", () => {
    const clean = sanitizeWizardUsername(onlineUserInputEl.value);
    if (clean !== onlineUserInputEl.value) onlineUserInputEl.value = clean;
    STATE.setupWizard.username = clean;
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
    if ((Number(chipEl.getAttribute("data-seconds")) || 0) === 0) {
      setWizardClockMode("untimed");
      renderWizardStep();
      return;
    }
    const seconds = normalizeTurnTimeSeconds(
      chipEl.getAttribute("data-seconds"),
      { fallback: DEFAULT_TURN_TIME_SECONDS },
    );
    setWizardClockMode("timed");
    setWizardTurnTimeSeconds(seconds);
    renderWizardStep();
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
    requestHint({ fromUi: true });
  });
}
if (confirmMoveBtn) {
  confirmMoveBtn.addEventListener("click", () => {
    confirmPendingMove();
  });
}

if (wizardRetryUserBtn) {
  wizardRetryUserBtn.addEventListener("click", () => {
    clearWizardSourceError();
    if (onlineUserInputEl) {
      onlineUserInputEl.focus();
      if (typeof onlineUserInputEl.select === "function") onlineUserInputEl.select();
    }
  });
}

if (wizardRetryDownloadBtn) {
  wizardRetryDownloadBtn.addEventListener("click", () => {
    retryWizardDownload();
  });
}

// "Cancel" while the wizard downloads or searches: the requests are aborted, the search stops, the form is the
// person's again and nothing was kept.
if (analysisCancelBtn) {
  analysisCancelBtn.addEventListener("click", () => {
    if (!STATE.ui.setupAnalyzing) return;
    const searching = STATE.analysisInProgress;
    cancelSetupWork();
    if (analysisStatusEl) analysisStatusEl.textContent = t(searching ? "download.cancelledSearch" : "download.cancelled");
    if (analyzeBtn && typeof analyzeBtn.focus === "function") analyzeBtn.focus();
  });
}

// Enter in a field of the wizard goes on (next step, or start on the last one), like any form.
if (setupPanelEl) {
  setupPanelEl.addEventListener("keydown", (event) => {
    if (!event || event.key !== "Enter" || event.isComposing || event.defaultPrevented) return;
    const target = event.target;
    const tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
    if (tag !== "input") return;
    event.preventDefault();
    const next = wizardNextBtn && !wizardNextBtn.classList.contains("hidden") && !wizardNextBtn.disabled ? wizardNextBtn : null;
    const start = analyzeBtn && !analyzeBtn.classList.contains("hidden") && !analyzeBtn.disabled ? analyzeBtn : null;
    const button = next || start;
    if (button && typeof button.click === "function") button.click();
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
    prefillLastUsername();
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
    // The saved games and the remembered usernames go together.
    forgetLastUsernames();
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
    setWizardClockMode("timed");
    setWizardTurnTimeSeconds(turnTimeSecondsEl.value, { fallback: MIN_TURN_TIME_SECONDS });
    renderWizardStep();
  });
}

[duelPlayerAEl, duelPlayerBEl]
  .filter(Boolean)
  .forEach((inputEl) => {
    inputEl.addEventListener("input", () => {
      const current = collectWizardConfig();
      STATE.setupWizard.duelNames = [...current.duelNames];
      readDuelPlayersFromInputs();
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
    // Skipping is worth 0 points and adds a notebook card: a first tap arms it, a second one does it.
    if (!armConfirmation("skip", t("core.skip.confirm"))) return;
    void submitNoMove("manual_skip");
  });
}
if (restartBtn) restartBtn.addEventListener("click", () => {
  void leaveSession();
});
if (coachExpandBtn) {
  coachExpandBtn.addEventListener("click", () => {
    setCoachExpanded(!(gameLayoutEl && gameLayoutEl.dataset && gameLayoutEl.dataset.expanded));
  });
}
if (soundBtn) {
  soundBtn.addEventListener("click", () => {
    settingsSet("sound.enabled", !settingsGet("sound.enabled", true));
    syncSoundButton();
    // The switch is the same one as in Settings: what it does survives the session, and it says so.
    announceHint(t(settingsGet("sound.enabled", true) ? "core.sound.on" : "core.sound.off"));
  });
}

// Keyboard shortcuts of the play screen (the legend under the next button says them):
// H asks for a hint while thinking; N or Enter go on, E explores the board, B draws the
// best move and M the move of the game once the answer is in. They stay out of the way of
// typing, of dialogs, and of the controls that already answer Enter.
function onGameKeydown(event) {
  if (!document.body.classList.contains("playing-mode")) return;
  if (!event || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  // Single-letter shortcuts can be switched off (Settings > Accessibility): speech input and
  // switch users trigger them by accident (WCAG 2.1.4).
  if (!shortcutsEnabled()) return;
  const target = event.target;
  const tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
  if (tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable)) return;
  if (document.querySelector(".modal-backdrop")) return;
  if (consentOverlayEl && !consentOverlayEl.classList.contains("hidden")) return;
  if (promotionPickerEl && !promotionPickerEl.classList.contains("hidden")) return;
  const key = String(event.key || "").toLowerCase();
  const phase = currentGamePhase();
  if (phase === "thinking") {
    // Not on a repeat (a held key is not three hints), and the level that shows the move asks twice.
    if (key === "h" && !event.repeat && requestHint({ fromUi: true })) event.preventDefault();
    return;
  }
  if (phase !== "result") return;
  const interactive = target && typeof target.closest === "function"
    ? target.closest("button, a, summary, [role='gridcell'], [role='button']")
    : null;
  if (key === "n" || (key === "enter" && !interactive)) {
    if (nextBtn && !nextBtn.disabled) {
      event.preventDefault();
      void nextPosition();
    }
  } else if (key === "e") {
    event.preventDefault();
    if (STATE.resultView.analysisMode) resetResultAnalysisBoard();
    else enterResultAnalysisMode();
  } else if (key === "b") {
    event.preventDefault();
    revealSpecificMove("best");
  } else if (key === "m") {
    event.preventDefault();
    revealSpecificMove("game");
  }
}
document.addEventListener("keydown", onGameKeydown);
// What the last input was (board.confirmMove "touch" only asks a finger to confirm), and the
// round clock sleeps while the page is hidden.
document.addEventListener("pointerdown", (event) => {
  const type = event && event.pointerType;
  noteInputKind(type === "touch" || type === "pen" ? "touch" : "mouse");
}, true);
document.addEventListener("keydown", () => noteInputKind("keyboard"), true);
document.addEventListener("visibilitychange", onPageVisibilityChange);
// Closing the tab or reloading in the middle of a session with answers asks first (desktop browsers).
window.addEventListener("beforeunload", onBeforeUnload);
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
  promotionPickerEl.addEventListener("click", (event) => {
    if (event.target === promotionPickerEl) closePromotionPicker();
  });
}
promotionChoiceEls.forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => choosePromotion(btn.dataset.promotion));
});

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
});

// ---------- Service worker: offline shell and the update prompt (sw.js) ----------
//
// The worker serves the app shell from its precache and never replaces itself under a
// running page: a new build installs in the background and WAITS. The page then offers
// "a new version is ready - reload" (never while a session is running, so it cannot cover
// the board) and, when the person agrees, asks the waiting worker to take over
// (SKIP_WAITING) and reloads once it has. The very first install says "ready offline"
// once. What the worker could not do (a refused engine file, a full cache) comes back as a
// message and is logged here, because nothing else would ever show it.

const PWA_UPDATE_CHECK_MS = 30 * 60 * 1000;
const PWA_OFFLINE_FLAG = "ludus.pwa.offline.v1";

function registerPwaText() {
  const i18n = ludusModule("i18n");
  try {
    if (!i18n || typeof i18n.register !== "function") return;
    i18n.register({
      es: {
        "pwa.update.ready": "Hay una versión nueva de Ludus Scaccorum lista.",
        "pwa.update.reload": "Recargar",
        "pwa.offline.ready": "Lista para usar sin conexión (el motor fuerte se guarda la primera vez que jugás con conexión).",
      },
      en: {
        "pwa.update.ready": "A new version of Ludus Scaccorum is ready.",
        "pwa.update.reload": "Reload",
        "pwa.offline.ready": "Ready to use offline (the full engine is saved the first time you play online).",
      },
    });
  } catch (error) {
    // Text is cosmetic: without it the prompts show their keys.
  }
}

function watchServiceWorker(registration) {
  const container = navigator.serviceWorker;
  // Automation and some privacy modes stub serviceWorker out: register() can resolve with nothing
  // (or with something that is no registration). There is then nothing to watch, and nothing to fail.
  if (!container || typeof container.addEventListener !== "function") return;
  if (!registration || typeof registration.addEventListener !== "function") return;
  const hadController = Boolean(container.controller); // false on the very first visit: the install is not an update
  let controlled = hadController; // follows the page: a first-visit page is controlled from the claim on
  let swapRequested = false; // this tab asked for the new worker: its controllerchange means "reload now"
  let prompted = false;

  const gameBusy = () => {
    try {
      const game = ludusModule("game");
      return Boolean(game && typeof game.isActive === "function" && game.isActive());
    } catch (error) {
      return false;
    }
  };

  // Runs `callback` now, or as soon as no session is running.
  function whenIdle(callback) {
    if (!gameBusy()) {
      callback();
      return;
    }
    const bus = ludusModule("bus");
    if (!bus || typeof bus.on !== "function") return; // cannot tell: the next visit asks again
    const offs = [];
    const check = () => {
      if (gameBusy()) return;
      offs.forEach((off) => off());
      callback();
    };
    ["screen:changed", "session:completed"].forEach((name) => offs.push(bus.on(name, check)));
  }

  function acceptUpdate() {
    const waiting = registration.waiting;
    if (waiting) {
      swapRequested = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload(); // another tab already swapped the worker: only this page is old
    }
  }

  function promptReload() {
    if (prompted) return;
    prompted = true;
    whenIdle(() => {
      showToast(t("pwa.update.ready"), {
        kind: "info",
        duration: 0,
        action: { label: t("pwa.update.reload"), onClick: acceptUpdate },
      });
    });
  }

  function announceOfflineReady() {
    let seen = false;
    try {
      seen = window.localStorage.getItem(PWA_OFFLINE_FLAG) === "1";
      window.localStorage.setItem(PWA_OFFLINE_FLAG, "1");
    } catch (error) {
      // Storage blocked: say it again next time rather than never.
    }
    if (!seen) whenIdle(() => showToast(t("pwa.offline.ready"), { kind: "success", duration: 8000 }));
  }

  function track(worker) {
    if (!worker || typeof worker.addEventListener !== "function") return;
    const onState = () => {
      if (worker.state === "installed") {
        if (container.controller) promptReload(); // a newer build is now waiting
      } else if (worker.state === "activated") {
        if (!hadController) announceOfflineReady();
      } else if (worker.state === "redundant") {
        if (container.controller) console.info("[Ludus] a new version could not be installed yet; it will be tried again");
        else console.warn("[Ludus] the service worker could not install (storage full, or a deploy half way): offline mode is not available yet");
      }
    };
    worker.addEventListener("statechange", onState);
    onState();
  }

  registration.addEventListener("updatefound", () => track(registration.installing));
  track(registration.installing);
  if (registration.waiting && container.controller) promptReload();

  container.addEventListener("controllerchange", () => {
    const wasControlled = controlled;
    controlled = Boolean(container.controller);
    if (!wasControlled) return; // the first install claiming this page: nothing old to replace
    if (swapRequested) window.location.reload();
    else promptReload(); // another tab took the new worker: this page still runs the old code
  });

  container.addEventListener("message", (event) => {
    const data = event && event.data;
    if (data && data.type === "ludus-sw") console.warn("[Ludus] service worker:", data.event, data.detail || "");
  });

  // A long-lived window (an installed app left open) looks for a new build when it comes back.
  let lastCheck = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || Date.now() - lastCheck < PWA_UPDATE_CHECK_MS) return;
    lastCheck = Date.now();
    try {
      Promise.resolve(registration.update()).catch(() => {});
    } catch (error) {
      // An update check is a courtesy.
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol === "file:") return;
  registerPwaText();
  const unavailable = (error) => console.warn("[Ludus] the service worker could not be registered (the app works online, not offline):", error);
  window.addEventListener("load", () => {
    let pending = null;
    try {
      pending = navigator.serviceWorker.register("sw.js");
    } catch (error) {
      unavailable(error);
      return;
    }
    Promise.resolve(pending).then((registration) => {
      try {
        watchServiceWorker(registration);
      } catch (error) {
        console.warn("[Ludus] the service worker could not be watched (offline mode and update prompts are off):", error);
      }
    }, unavailable);
  });
}

// ---------- Boot: shell, screens, router, public API ----------

const SCREEN_NAMES = ["landing", "home", "classics", "notebook", "progress", "museum", "settings", "account"];

function registerRouterScreen(name, container, screen) {
  const router = ludusModule("router");
  if (!router) return;
  router.register(name, {
    el: container,
    title: screen && (screen.titleKey || screen.title),
    onShow(params) {
      if (name === "landing") document.body.classList.add("landing-active");
      if (screen && typeof screen.show === "function") screen.show(params);
    },
    onHide() {
      if (name === "landing") document.body.classList.remove("landing-active");
      if (screen && typeof screen.hide === "function") screen.hide();
    },
    // polish-discover (PD-4): a screen that keeps sub-states in the history (the museum's tabs, Ludus.router.pushSub) is told when Back or
    // Forward lands on one of them.
    onSub(sub) {
      if (screen && typeof screen.onSub === "function") screen.onSub(sub);
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
    title: "core.title.setup",
    onShow() {
      document.body.classList.remove("landing-active");
    },
    onHide() {
      cancelSetupWork();
    },
    // Back and Forward walk the steps of the wizard (each one is an entry of the history).
    onSub: wizardStepFromHistory,
    // An entry of a wizard that an earlier visit of the page opened cannot be shown (its state is gone).
    canEnter: () => wizardOpenedInThisPage,
  });
  router.register("game", {
    el: gameLayoutEl,
    title: "core.title.play",
    // The game replaces its history entry when it is left by a screen change, asks before a Back leaves a session
    // that has answers to lose (the exit button's question), and is not a place Forward can return to.
    transient: true,
    canLeave: () => confirmRestartToSetup(),
    canEnter: () => isSessionActive(),
    onShow() {
      document.body.classList.add("playing-mode");
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
      setWizardTurnTimeSeconds(payload.value);
      renderWizardStep();
    } else if (path === "clock.mode") {
      if (!STATE.session) STATE.clockMode = payload.value === "untimed" ? "untimed" : "timed";
      setWizardClockMode(payload.value);
      renderWizardStep();
    } else if (path === "hints.enabled" && typeof overrides.hints !== "boolean" && !STATE.session) {
      STATE.hintsEnabled = Boolean(payload.value);
      updateHintButton();
    } else if (path === "sound.enabled") {
      syncSoundButton();
    }
  });
  // A new achievement is a small celebration (Profile decides what unlocks); the ones that
  // arrive together are one toast, and the summary lists the ones of the session.
  bus.on("achievement:unlocked", (payload) => {
    const achievement = payload && payload.achievement ? payload.achievement : null;
    if (!achievement || !achievement.name) return;
    noteAchievement(achievement, payload.profileId);
    queueCelebration({ achievement });
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
    // The API asks for the next level whatever the taps before it (no slip protection: a script knows what it asks).
    hint: () => requestHint(),
    session: () => publicSessionInfo(STATE.session),
    resultContext: () => STATE.resultView.context,
    analyzePosition,
    isUsingFallbackEngine,
    // Settings > Privacy (QA SEC-008, F5): the "keep the games I download" preference and the wizard's "Clear saved game data",
    // for the settings screen. keep() is true by default; setKeep(false) means downloads live only in this tab.
    savedDownloads: {
      keep: () => !loadNoPersistDownloadsPreference(),
      setKeep(keep) {
        saveNoPersistDownloadsPreference(!keep);
      },
      // The saved games and the remembered usernames go together (as in the wizard).
      clear() {
        forgetLastUsernames();
        return clearAllRemotePgnCache();
      },
    },
    // For tests and end-to-end checks: hands the engine another transport
    // (a fake, or a Node child process) instead of the Worker, and may shorten
    // the waits (minEvalVisibleMs, retryBaseMs). Drops the engine that is
    // loaded; the next session loads the new one.
    configureEngine(options = {}) {
      const opts = options && typeof options === "object" ? options : {};
      engineTransportFactory = typeof opts.createTransport === "function" ? opts.createTransport : null;
      timingOverrides.minEvalVisibleMs = Number.isFinite(opts.minEvalVisibleMs) ? Math.max(0, opts.minEvalVisibleMs) : null;
      timingOverrides.engineRetryBaseMs = Number.isFinite(opts.retryBaseMs) ? Math.max(0, opts.retryBaseMs) : null;
      timingOverrides.engineStallMs = Number.isFinite(opts.stallMs) ? Math.max(1, opts.stallMs) : null;
      abortEngineWork();
      resetEngineToLocal();
      STATE.engineStatus = "idle";
      STATE.engineFilesReady = false;
      STATE.engineFailures = 0;
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
  // A session that a reload or a closed tab interrupted is offered once, when the screen has settled.
  setTimeout(() => {
    void offerSessionResume();
  }, 600);
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
setWizardTurnTimeSeconds(STATE.setupWizard.turnTimeSeconds);
readDuelPlayersFromInputs();
applyGameFormat(gameFormatEl ? gameFormatEl.value : "solo");
setSourceMode("lichess");
resetSetupWizard({
  mode: "solo",
  statusMessage: t("wizard.status.answerQuestions"),
});
updatePgnSelectionUi();
updateRoundTimerUi(Math.round(STATE.turnTimeSeconds * 1000));
buildBoard();
renderBoard();
bootCore();
refreshLocalizedUi();
registerServiceWorker();
void purgeExpiredRemotePgnCache();
