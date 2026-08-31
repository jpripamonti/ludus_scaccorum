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
const landingScreenEl = document.getElementById("landing-screen");
const landingStartBtn = document.getElementById("landing-start-btn");
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
const wizardModeSoloBtn = document.getElementById("wizard-mode-solo");
const wizardModeDuelBtn = document.getElementById("wizard-mode-duel");
const wizardProviderLichessBtn = document.getElementById("wizard-provider-lichess");
const wizardProviderChessComBtn = document.getElementById("wizard-provider-chesscom");
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
const positionSearchCancelBtnEl = document.getElementById("position-search-cancel-btn");
const promotionPickerEl = document.getElementById("promotion-picker");
const promotionChoiceEls = ["q", "r", "b", "n"].map((code) => document.getElementById(`promotion-choice-${code}`));
const soloClockRailEl = document.getElementById("solo-clock-rail");
const soloClockValueEl = document.getElementById("solo-clock-value");
const soloClockBarEl = document.getElementById("solo-clock-bar");
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

const INTERNAL_ANALYSIS_DEPTH = 3;
const DEFAULT_SCORING_SYSTEM = "simple_labels_v1";
const DEFAULT_CITIZEN_THRESHOLD = 80;
const DEFAULT_CITIZEN_MOVETIME = 250;
const DEFAULT_CITIZEN_SESSION_SIZE = 10;
const DEFAULT_TURN_TIME_SECONDS = 90;
const MIN_TURN_TIME_SECONDS = 5;
const MAX_TURN_TIME_SECONDS = 360;
const RATING_MOVE_TIME_MS = 5000;
const RATING_DEPTH = 18;
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
const MIN_ROUND_EVAL_VISIBLE_MS = 5000;
const ROUND_EVAL_MAX_TOTAL_MS = 7000;
const ROUND_EVAL_MIN_TOTAL_MS = 2200;
const ROUND_EVAL_MIN_TASK_MS = 350;
const ROUND_THINKING_MESSAGE_INTERVAL_MS = 1700;
const MISTAKE_SEARCH_TIME_BUDGET_MS = 25000;
const MISTAKE_SEARCH_CANDIDATE_BUDGET = 400;
const CLOCK_TICK_MS = 100;
const LANGUAGE_STORAGE_KEY = "ludus.language";
const SETUP_STORAGE_KEY = "ludus.setup.v1";
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
// Per-game and per-annotation caps applied while parsing PGN text, so one
// pathological game (huge, a giant single comment, absurd move count, or
// absurdly nested variations) gets skipped instead of freezing the tab.
const PGN_GAME_MAX_CHARS = 512 * 1024;
const PGN_COMMENT_MAX_CHARS = 4000;
const PGN_MAX_PLIES = 600;
const PGN_MAX_VARIATION_DEPTH = 12;
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
    "labels.positionsEvaluatedTitle": "Posiciones evaluadas",
    "result.title": "Resultado",
    "result.pending": "Todavía no hay jugada evaluada.",
    "result.boardToolsLabel": "Herramientas del tablero",
    "score.totalPoints": "Puntos totales",
    "score.duelScore": "Marcador duelo",
    "scoring.system.simple.label": "Etiquetas simples (v1)",
    "scoring.system.simple.description": "Puntajes simples por calidad: Error grave -1, Mala -0.5, Dudosa 0, Interesante 0.25, Buena 0.5, Muy buena 0.75, Perfecta 1.",
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
    "evaluation.wonPoints": "Ganaste {points} pts",
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
    "labels.positionsEvaluatedTitle": "Evaluated positions",
    "result.title": "Result",
    "result.pending": "There is no evaluated move yet.",
    "result.boardToolsLabel": "Board tools",
    "score.totalPoints": "Total points",
    "score.duelScore": "Duel score",
    "scoring.system.simple.label": "Simple labels (v1)",
    "scoring.system.simple.description": "Simple quality scoring: Serious mistake -1, Bad -0.5, Dubious 0, Interesting 0.25, Good 0.5, Very good 0.75, Perfect 1.",
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
    "evaluation.wonPoints": "You won {points} pts",
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

function normalizeTurnTimeSeconds(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_TURN_TIME_SECONDS;
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : fallback;
  return clamp(Math.round(safeValue), MIN_TURN_TIME_SECONDS, MAX_TURN_TIME_SECONDS);
}

function loadSetupPreference() {
  try {
    const stored = window.localStorage.getItem(SETUP_STORAGE_KEY);
    if (!stored) {
      return { turnTimeSeconds: DEFAULT_TURN_TIME_SECONDS };
    }
    const parsed = JSON.parse(stored);
    return {
      turnTimeSeconds: normalizeTurnTimeSeconds(parsed?.turnTimeSeconds),
    };
  } catch (error) {
    return { turnTimeSeconds: DEFAULT_TURN_TIME_SECONDS };
  }
}

function saveSetupPreference(turnTimeSeconds) {
  try {
    const payload = {
      turnTimeSeconds: normalizeTurnTimeSeconds(turnTimeSeconds),
    };
    window.localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage failures.
  }
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

function rawTranslation(key, language = STATE?.language || "es") {
  const normalized = normalizeLanguage(language);
  return TRANSLATIONS[normalized]?.[key] ?? TRANSLATIONS.es?.[key] ?? key;
}

function t(key, params = {}, language = STATE?.language || "es") {
  return interpolate(rawTranslation(key, language), params);
}

function preferredLocale() {
  return normalizeLanguage(STATE?.language || detectInitialLanguage());
}

const DUEL_DEFAULT_PLAYERS = ["Jugador 1", "Jugador 2"];
const ROUND_THINKING_FACTS = [
  "¿Sabías que Emanuel Lasker mantuvo el título mundial durante 27 años (1894-1921)? Es el reinado más largo en la historia del Campeonato Mundial de Ajedrez.",
  "¿Sabías que Garry Kasparov perdió un match contra la supercomputadora Deep Blue de IBM en 1997? Fue la primera vez que un campeón mundial reinante cayó ante una máquina en condiciones de torneo.",
  "¿Sabías que Frank Marshall guardó durante años un sacrificio preparado contra José Raúl Capablanca? Cuando finalmente lo jugó en 1918, Capablanca encontró la defensa correcta sobre el tablero y ganó la partida.",
  "¿Sabías que Paul Morphy jugó la famosa 'Partida de la Ópera' en un palco del Teatro de la Ópera de París en 1858? Derrotó a dos aristócratas que jugaban juntos consultándose entre ellos.",
  "¿Sabías que Viktor Korchnoi acusó al equipo de Anatoli Karpov de enviarle señales secretas con yogur durante el Campeonato Mundial de 1978? La organización del match terminó interviniendo por la polémica.",
  "¿Sabías que Magnus Carlsen derrotó a Bill Gates en una partida promocional que duró menos de dos minutos? La partida terminó en apenas 9 movimientos.",
  "¿Sabías que Akiba Rubinstein fue considerado el jugador más fuerte del mundo hacia 1912 pero nunca jugó por el título mundial? La Primera Guerra Mundial y problemas financieros impidieron organizar su match.",
  "¿Sabías que Alexander Alekhine es el único campeón mundial que murió siendo todavía campeón? Falleció en 1946 antes de disputar un nuevo match por el título.",
  "¿Sabías que Bobby Fischer ganó 20 partidas consecutivas contra grandes maestros entre 1970 y 1971? La racha incluyó partidas del Interzonal de Palma de Mallorca y del ciclo de Candidatos.",
  "¿Sabías que Vera Menchik tenía un 'club' con el nombre de los grandes maestros que perdían contra ella? Cuando derrotaba a uno, decía que quedaba automáticamente incorporado al llamado 'Club Vera Menchik'.",
  "¿Sabías que Vladimir Kramnik sorprendió al mundo del ajedrez usando repetidamente la Defensa Berlín contra Garry Kasparov en el match por el título mundial de 2000? La solidez de esa apertura fue clave para ganar el campeonato.",
  "¿Sabías que David Bronstein estuvo a una sola partida de convertirse en campeón mundial en 1951? Empató el match contra Mikhail Botvinnik, lo que permitió al campeón retener el título.",
  "¿Sabías que Paul Keres terminó cinco veces entre los primeros en el torneo de Candidatos sin llegar a disputar el título mundial? Por eso a veces se lo llama 'el mejor jugador que nunca fue campeón'.",
  "¿Sabías que Miguel Najdorf jugó 45 partidas simultáneas a ciegas en 1947? Ganó 39, empató 4 y perdió solo 2, estableciendo un récord mundial en ese momento.",
  "¿Sabías que Judit Polgár llegó al puesto 8 del ranking mundial absoluto? Es considerada la jugadora más fuerte de la historia del ajedrez.",
  "¿Sabías que Paul Morphy obtuvo su título de abogado en Louisiana a los 19 años, pero no pudo ejercer de inmediato por su edad? Esa pausa legal coincidió con su explosión como la mayor estrella del ajedrez de su época.",
  "¿Sabías que Mikhail Botvinnik combinó el ajedrez de élite con una carrera seria como ingeniero electricista? Mientras competía por el título mundial, también desarrollaba trabajo técnico e investigador fuera del tablero.",
  "¿Sabías que José Raúl Capablanca trabajó en el servicio diplomático cubano? Su cargo le permitió viajar por Europa mientras seguía construyendo su carrera como uno de los grandes genios del ajedrez.",
  "¿Sabías que Emanuel Lasker obtuvo un doctorado en matemáticas y publicó obras de filosofía? Fue uno de los ajedrecistas más intelectualmente versátiles, destacando en la investigación académica más allá del tablero.",
  "¿Sabías que Max Euwe, campeón mundial en 1935, era matemático de formación y llegó a ser profesor universitario? Durante años convivieron en él el ajedrecista de élite y el académico.",
  "¿Sabías que Vasily Smyslov, además de campeón mundial, era un barítono con nivel profesional? Hizo audiciones para el teatro Bolshói y siguió dando recitales de ópera incluso durante su etapa en la élite del ajedrez.",
  "¿Sabías que Viktor Korchnoi pasó un tiempo compitiendo como apátrida después de abandonar la Unión Soviética? Uno de los jugadores más fuertes del mundo llegó a disputar la élite sin representar formalmente a ningún país.",
  "¿Sabías que Samuel Reshevsky se hizo famoso como niño prodigio y daba exhibiciones simultáneas contra adultos cuando todavía era muy chico? Su celebridad internacional empezó mucho antes de su madurez como gran maestro.",
  "¿Sabías que Alexander Alekhine estudió Derecho en la Universidad de París? Además de campeón mundial, también tuvo una formación universitaria lejos del tablero.",
  "¿Sabías que Mark Taimanov no fue solo gran maestro, sino también pianista de concierto de nivel internacional? Llegó a destacar seriamente en dos carreras de élite a la vez: ajedrez y música.",
  "¿Sabías que Reuben Fine, uno de los jugadores más fuertes del mundo en los años 30 y 40, dejó en gran parte el ajedrez para dedicarse a la psicología? Terminó siendo psicólogo, profesor universitario y autor de libros en ambas disciplinas.",
  "¿Sabías que Milan Vidmar fue al mismo tiempo gran maestro y especialista en ingeniería eléctrica? Se mantuvo entre los mejores del mundo mientras desarrollaba una carrera académica y técnica.",
  "¿Sabías que Capablanca aprendió a jugar observando a su padre cuando era apenas un niño? Su talento parecía tan natural que muy pronto empezó a derrotar a jugadores adultos en Cuba.",
  "¿Sabías que Lasker insistía en cobrar honorarios altos y negociar buenas condiciones para sus matches? Con eso ayudó a elevar el estatus profesional de los ajedrecistas en una época en que vivir del juego era mucho más difícil.",
  "¿Sabías que Samuel Reshevsky, después de su fama temprana como prodigio, también completó estudios universitarios en contabilidad? Su vida combinó por años el ajedrez de elite con una formación profesional formal.",
  "¿Sabías que el match por el Campeonato Mundial de 1984 entre Anatoli Karpov y Garry Kasparov fue suspendido sin resultado después de más de cinco meses? Se jugaba al primero en ganar 6 partidas, pero la FIDE lo detuvo con Karpov arriba por 5 a 3.",
  "¿Sabías que Ding Liren estuvo 100 partidas clásicas consecutivas sin perder entre 2017 y 2018? Esa racha fue una de las más impresionantes de la era moderna.",
  "¿Sabías que Abhimanyu Mishra se convirtió en el gran maestro más joven de la historia? Logró el título en 2021 con 12 años, 4 meses y 25 días.",
  "¿Sabías que Susan Polgar fue la primera mujer en obtener el título de gran maestro cumpliendo las normas y el Elo exigidos en la categoría absoluta? Lo consiguió en 1991.",
  "¿Sabías que Hikaru Nakamura logró algo rarísimo en el ajedrez moderno: ser al mismo tiempo un jugador de élite mundial y una superestrella del streaming? Su figura ayudó a unir el ajedrez profesional con la cultura de internet.",
  "¿Sabías que Levy Rozman, más conocido como GothamChess, tomó su apodo de Nueva York? El 'Gotham' de su nombre viene de su vínculo con la ciudad antes de convertirse en uno de los divulgadores de ajedrez más populares del mundo.",
  "¿Sabías que Alexandra Botez terminó dando nombre a una 'jugada' que en realidad es un chiste de internet? El llamado 'Botez Gambit' surgió entre los espectadores de BotezLive para bromear sobre esas posiciones en las que alguien cuelga la dama sin querer.",
  "¿Sabías que Pepe Cuenca no solo es gran maestro, sino también ingeniero? Esa combinación de nivel ajedrecístico alto y estilo expresivo como comentarista ayudó a convertirlo en una de las voces más reconocibles del ajedrez en español.",
  "¿Sabías que BotezLive no se hizo famoso solo por el nivel ajedrecístico, sino por convertir el ajedrez en un formato de entretenimiento masivo? El canal ayudó a acercar el juego a públicos mucho más amplios que los habituales.",
  "¿Sabías que el número de partidas posibles es mayor al número de átomos en el universo observable? Se conoce como el Número de Shannon (10^120) y sirve para ilustrar la complejidad casi infinita del juego.",
  "¿Sabías que Mikhail Tal, el 'Mago de Riga', ganó el título mundial en 1960 con un estilo de sacrificio tan caótico que hipnotizaba a sus rivales? Se decía que sus oponentes tenían miedo de mirarlo a los ojos durante la partida por su mirada intensa.",
  "¿Sabías que 'El Turco' fue un falso autómata que engañó al mundo durante 84 años en los siglos XVIII y XIX? Parecía una máquina, pero escondía a un maestro en su interior; llegó a jugar contra Napoleón Bonaparte y Benjamin Franklin.",
  "¿Sabías que la primera partida de ajedrez entre la Tierra y el espacio ocurrió en 1970? Los cosmonautas de la misión Soyuz 9 jugaron contra representantes en tierra; la partida terminó en tablas tras seis horas de transmisión.",
  "¿Sabías que Wilhelm Steinitz, el primer campeón mundial oficial, afirmó una vez que podía darle un peón de ventaja a Dios y aun así ganarle? Era conocido por su carácter fuerte y por ser el padre de la estrategia moderna.",
  "¿Sabías que la partida oficial más larga de la historia duró 20 horas y 15 minutos? Fue disputada entre Ivan Nikolić y Goran Arsović en Belgrado (1989) y terminó en tablas tras 269 movimientos.",
  "¿Sabías que existe una variante llamada Chess960 creada por Bobby Fischer? Su objetivo es eliminar la memorización de aperturas sorteando la posición de las piezas en la primera fila, forzando la creatividad desde el primer movimiento.",
];

const ROUND_THINKING_FACTS_EN = [
  "Did you know Emanuel Lasker held the world title for 27 years (1894-1921)? It remains the longest reign in World Chess Championship history.",
  "Did you know Garry Kasparov lost a match to IBM's Deep Blue supercomputer in 1997? It was the first time a reigning world champion lost to a machine under tournament conditions.",
  "Did you know Frank Marshall saved a prepared sacrifice against Jose Raul Capablanca for years? When he finally played it in 1918, Capablanca found the correct defense over the board and won the game.",
  "Did you know Paul Morphy played the famous Opera Game from a box at the Paris Opera House in 1858? He defeated two aristocrats who were consulting each other on every move.",
  "Did you know Viktor Korchnoi accused Anatoly Karpov's team of sending him secret signals with yogurt during the 1978 World Championship? The organizers ended up stepping in because of the controversy.",
  "Did you know Magnus Carlsen beat Bill Gates in a promotional game that lasted less than two minutes? The game ended in only 9 moves.",
  "Did you know Akiba Rubinstein was considered the strongest player in the world around 1912 but never played for the world title? World War I and financial problems prevented the match from being organized.",
  "Did you know Alexander Alekhine is the only world champion who died while still holding the title? He died in 1946 before he could play another championship match.",
  "Did you know Bobby Fischer won 20 consecutive games against grandmasters between 1970 and 1971? The streak included games from the Palma de Mallorca Interzonal and the Candidates cycle.",
  "Did you know Vera Menchik had a 'club' named after the grandmasters she beat? Whenever she defeated one, she said he was automatically admitted to the so-called Vera Menchik Club.",
  "Did you know Vladimir Kramnik shocked the chess world by repeatedly using the Berlin Defense against Garry Kasparov in the 2000 title match? The opening's solidity was key to winning the championship.",
  "Did you know David Bronstein was just one game away from becoming world champion in 1951? He drew the match against Mikhail Botvinnik, which allowed the champion to keep the title.",
  "Did you know Paul Keres finished among the leaders in the Candidates tournament five times without ever getting a world title match? That is why he is sometimes called the best player never to become champion.",
  "Did you know Miguel Najdorf played 45 blindfold simultaneous games in 1947? He won 39, drew 4, and lost only 2, setting a world record at the time.",
  "Did you know Judit Polgar reached number 8 in the absolute world rankings? She is considered the strongest female chess player in history.",
  "Did you know Paul Morphy earned his law degree in Louisiana at age 19 but could not practice immediately because of his age? That legal pause coincided with his explosion as the biggest chess star of his era.",
  "Did you know Mikhail Botvinnik combined elite chess with a serious career as an electrical engineer? While fighting for the world title, he was also doing technical and research work away from the board.",
  "Did you know Jose Raul Capablanca worked in the Cuban diplomatic service? The post allowed him to travel around Europe while building his career as one of chess's great geniuses.",
  "Did you know Emanuel Lasker earned a doctorate in mathematics and published works of philosophy? He was one of the most intellectually versatile chess players, with serious academic work beyond the board.",
  "Did you know Max Euwe, world champion in 1935, was trained as a mathematician and later became a university professor? For years he combined elite chess with academic life.",
  "Did you know Vasily Smyslov, besides being world champion, was a baritone of professional level? He auditioned for the Bolshoi Theatre and kept giving opera recitals even during his elite chess years.",
  "Did you know Viktor Korchnoi spent time competing as a stateless player after leaving the Soviet Union? One of the world's strongest players reached the top level without formally representing any country.",
  "Did you know Samuel Reshevsky became famous as a child prodigy and gave simultaneous exhibitions against adults while still very young? His international fame began long before his mature grandmaster career.",
  "Did you know Alexander Alekhine studied law at the University of Paris? In addition to being world champion, he also had a university education far from the board.",
  "Did you know Mark Taimanov was not only a grandmaster but also a concert pianist of international level? He seriously pursued two elite careers at once: chess and music.",
  "Did you know Reuben Fine, one of the world's strongest players in the 1930s and 1940s, largely left chess to devote himself to psychology? He became a psychologist, university professor, and author in both fields.",
  "Did you know Milan Vidmar was both a grandmaster and an expert in electrical engineering? He remained among the world's best while developing an academic and technical career.",
  "Did you know Capablanca learned to play by watching his father when he was just a child? His talent seemed so natural that he soon began defeating adult players in Cuba.",
  "Did you know Lasker insisted on high fees and good match conditions? In doing so, he helped raise the professional status of chess players in an era when making a living from the game was much harder.",
  "Did you know Samuel Reshevsky, after his early fame as a prodigy, also completed university studies in accounting? For years his life combined elite chess with formal professional training.",
  "Did you know the 1984 World Championship match between Anatoly Karpov and Garry Kasparov was stopped without a result after more than five months? It was being played to the first 6 wins, but FIDE halted it with Karpov leading 5-3.",
  "Did you know Ding Liren went 100 consecutive classical games without a loss between 2017 and 2018? It was one of the most impressive unbeaten streaks of the modern era.",
  "Did you know Abhimanyu Mishra became the youngest grandmaster in history? He earned the title in 2021 at 12 years, 4 months, and 25 days old.",
  "Did you know Susan Polgar was the first woman to earn the grandmaster title by meeting the full norms and rating requirements of the open category? She achieved it in 1991.",
  "Did you know Hikaru Nakamura pulled off something very rare in modern chess: being both an elite world player and a streaming superstar? His profile helped connect professional chess with internet culture.",
  "Did you know Levy Rozman, better known as GothamChess, took his nickname from New York? The 'Gotham' in his name comes from his bond with the city before he became one of the most popular chess educators in the world.",
  "Did you know Alexandra Botez ended up lending her name to a so-called 'move' that is really an internet joke? The 'Botez Gambit' came from BotezLive viewers joking about positions where someone accidentally hangs their queen.",
  "Did you know Pepe Cuenca is not only a grandmaster but also an engineer? That mix of strong chess skill and expressive commentary style helped make him one of the most recognizable chess voices in Spanish.",
  "Did you know BotezLive became famous not only for chess strength but for turning chess into a mass entertainment format? The channel helped bring the game to much wider audiences than usual.",
  "Did you know the number of possible chess games is greater than the number of atoms in the observable universe? It is known as the Shannon Number (10^120) and illustrates the game's near-infinite complexity.",
  "Did you know Mikhail Tal, the 'Magician from Riga,' won the world title in 1960 with a sacrificial style so chaotic it hypnotized his rivals? People said his opponents were afraid to look him in the eyes during the game because of his intense stare.",
  "Did you know 'The Turk' was a fake automaton that fooled the world for 84 years in the 18th and 19th centuries? It looked like a machine but hid a master inside; it even played against Napoleon Bonaparte and Benjamin Franklin.",
  "Did you know the first chess game between Earth and space took place in 1970? Cosmonauts from Soyuz 9 played against representatives on the ground; the game ended in a draw after six hours of transmission.",
  "Did you know Wilhelm Steinitz, the first official world champion, once claimed he could give God a pawn and still win? He was known for his strong personality and for being the father of modern strategy.",
  "Did you know the longest official chess game in history lasted 20 hours and 15 minutes? It was played by Ivan Nikolic and Goran Arsovic in Belgrade in 1989 and ended in a draw after 269 moves.",
  "Did you know Bobby Fischer created a variant called Chess960? Its goal is to remove opening memorization by randomizing the back-rank pieces, forcing creativity from move one.",
];

const ROUND_THINKING_MESSAGES = {
  easy: ROUND_THINKING_FACTS,
  medium: ROUND_THINKING_FACTS,
  hard: ROUND_THINKING_FACTS,
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
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
  engine: { mode: "local", worker: null, ready: false, evalCache: new Map() },
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
  setupWizard: {
    step: 1,
    mode: "solo",
    duelNames: [...DUEL_DEFAULT_PLAYERS],
    platform: "lichess",
    username: "",
    sessionSize: DEFAULT_CITIZEN_SESSION_SIZE,
    turnTimeSeconds: INITIAL_SETUP.turnTimeSeconds,
    sourceError: null,
  },
  timer: { intervalId: null, deadlineMs: 0, durationMs: 0 },
  ui: {
    phase: "playing",
    blockBoardInput: false,
    setupAnalyzing: false,
    positionSearchState: null,
    handoffState: null,
    handoffReturnFocusEl: null,
    searchCancelRequested: false,
    thinkingMessages: {
      level: "medium",
      queue: [],
      intervalId: null,
    },
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
  document.title = t("meta.title");
}

function updateLanguageToggleUi() {
  const current = preferredLocale();
  if (languageBtnEs) languageBtnEs.setAttribute("aria-pressed", current === "es" ? "true" : "false");
  if (languageBtnEn) languageBtnEn.setAttribute("aria-pressed", current === "en" ? "true" : "false");
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

function setLanguage(language, options = {}) {
  const nextLanguage = normalizeLanguage(language);
  STATE.language = nextLanguage;
  if (!options.skipPersist) saveLanguagePreference(nextLanguage);
  updateDocumentLanguage();
  updateLanguageToggleUi();
  syncLocalizedPlayerDefaults();
  applyStaticTranslations();
  refreshLocalizedUi();
}

class Chess {
  constructor(fen) {
    this.loadFen(fen || Chess.START_FEN);
  }

  loadFen(fen) {
    const parts = fen.split(" ");
    const rows = parts[0].split("/");
    this.board = Array(64).fill(null);
    rows.forEach((row, rankIdx) => {
      let file = 0;
      for (const char of row) {
        if (Number.isNaN(Number(char))) {
          this.board[rankIdx * 8 + file] = char;
          file += 1;
        } else {
          file += Number(char);
        }
      }
    });
    this.turn = parts[1];
    this.castling = parts[2];
    this.enPassant = parts[3] === "-" ? -1 : Chess.squareToIndex(parts[3]);
    const halfmove = Number(parts[4]);
    const fullmove = Number(parts[5]);
    this.halfmove = Number.isFinite(halfmove) ? halfmove : 0;
    this.fullmove = Number.isFinite(fullmove) && fullmove > 0 ? fullmove : 1;
  }

  fen() {
    let placement = "";
    for (let rank = 0; rank < 8; rank += 1) {
      let empty = 0;
      for (let file = 0; file < 8; file += 1) {
        const piece = this.board[rank * 8 + file];
        if (!piece) {
          empty += 1;
        } else {
          if (empty) {
            placement += empty;
            empty = 0;
          }
          placement += piece;
        }
      }
      if (empty) placement += empty;
      if (rank !== 7) placement += "/";
    }
    const ep = this.enPassant === -1 ? "-" : Chess.indexToSquare(this.enPassant);
    return `${placement} ${this.turn} ${this.castling || "-"} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  static indexToSquare(index) {
    const rank = 8 - Math.floor(index / 8);
    const file = files[index % 8];
    return `${file}${rank}`;
  }

  static squareToIndex(square) {
    const file = files.indexOf(square[0]);
    const rank = Number(square[1]);
    return (8 - rank) * 8 + file;
  }

  pieceAt(index) { return this.board[index]; }
  isWhite(piece) { return piece && piece === piece.toUpperCase(); }
  isBlack(piece) { return piece && piece === piece.toLowerCase(); }
  isOpponent(piece, color) { return color === "w" ? this.isBlack(piece) : this.isWhite(piece); }
  inBounds(index) { return index >= 0 && index < 64; }
  isPromotionRank(index, color) {
    const rank = Math.floor(index / 8);
    return color === "w" ? rank === 0 : rank === 7;
  }

  generateMoves() {
    const moves = [];
    for (let i = 0; i < 64; i += 1) {
      const piece = this.board[i];
      if (!piece) continue;
      if (this.turn === "w" && this.isBlack(piece)) continue;
      if (this.turn === "b" && this.isWhite(piece)) continue;
      moves.push(...this.generatePieceMoves(i, piece));
    }
    return moves.filter((move) => this.isLegal(move));
  }

  generatePieceMoves(index, piece) {
    const moves = [];
    const rank = Math.floor(index / 8);
    const file = index % 8;
    const color = this.isWhite(piece) ? "w" : "b";
    const dir = color === "w" ? -1 : 1;

    const pushMove = (to, extras = {}) => moves.push({ from: index, to, piece, ...extras });

    switch (piece.toUpperCase()) {
      case "P": {
        const forward = index + dir * 8;
        if (this.inBounds(forward) && !this.board[forward]) {
          if (this.isPromotionRank(forward, color)) {
            ["Q", "R", "B", "N"].forEach((promo) => {
              pushMove(forward, { promotion: color === "w" ? promo : promo.toLowerCase() });
            });
          } else {
            pushMove(forward);
          }
          const startRank = color === "w" ? 6 : 1;
          const doubleForward = index + dir * 16;
          if (rank === startRank && !this.board[doubleForward]) {
            pushMove(doubleForward, { doublePawn: true });
          }
        }
        [-1, 1].forEach((df) => {
          const captureFile = file + df;
          if (captureFile < 0 || captureFile > 7) return;
          const captureIndex = index + dir * 8 + df;
          if (!this.inBounds(captureIndex)) return;
          const target = this.board[captureIndex];
          if (target && this.isOpponent(target, color)) {
            if (this.isPromotionRank(captureIndex, color)) {
              ["Q", "R", "B", "N"].forEach((promo) => {
                pushMove(captureIndex, { capture: true, promotion: color === "w" ? promo : promo.toLowerCase() });
              });
            } else {
              pushMove(captureIndex, { capture: true });
            }
          }
          if (this.enPassant === captureIndex) {
            pushMove(captureIndex, { capture: true, enPassant: true });
          }
        });
        break;
      }
      case "N": {
        const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        jumps.forEach(([dr, df]) => {
          const r = rank + dr;
          const f = file + df;
          if (r < 0 || r > 7 || f < 0 || f > 7) return;
          const to = r * 8 + f;
          const target = this.board[to];
          if (!target || this.isOpponent(target, color)) pushMove(to, { capture: Boolean(target) });
        });
        break;
      }
      case "B":
      case "R":
      case "Q": {
        const directions = [];
        if (piece.toUpperCase() !== "B") directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
        if (piece.toUpperCase() !== "R") directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        directions.forEach(([dr, df]) => {
          let r = rank + dr;
          let f = file + df;
          while (r >= 0 && r < 8 && f >= 0 && f < 8) {
            const to = r * 8 + f;
            const target = this.board[to];
            if (!target) {
              pushMove(to);
            } else {
              if (this.isOpponent(target, color)) pushMove(to, { capture: true });
              break;
            }
            r += dr;
            f += df;
          }
        });
        break;
      }
      case "K": {
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let df = -1; df <= 1; df += 1) {
            if (dr === 0 && df === 0) continue;
            const r = rank + dr;
            const f = file + df;
            if (r < 0 || r > 7 || f < 0 || f > 7) continue;
            const to = r * 8 + f;
            const target = this.board[to];
            if (!target || this.isOpponent(target, color)) pushMove(to, { capture: Boolean(target) });
          }
        }
        moves.push(...this.generateCastlingMoves(index, color));
        break;
      }
      default:
        break;
    }

    return moves;
  }

  generateCastlingMoves(index, color) {
    const moves = [];
    if (this.inCheck(color)) return moves;
    const rank = color === "w" ? 7 : 0;
    if (index !== rank * 8 + 4) return moves;
    const rights = this.castling;
    // The castling rights string can outlive the rook it describes (a FEN can
    // simply claim a right that doesn't match the board). Require the actual
    // rook on its corner square, or makeMove below would "castle" with nothing.
    const rook = color === "w" ? "R" : "r";

    if ((color === "w" && rights.includes("K")) || (color === "b" && rights.includes("k"))) {
      if (this.board[rank * 8 + 7] === rook
        && !this.board[rank * 8 + 5] && !this.board[rank * 8 + 6]
        && !this.isSquareAttacked(rank * 8 + 5, color) && !this.isSquareAttacked(rank * 8 + 6, color)) {
        moves.push({ from: index, to: rank * 8 + 6, piece: color === "w" ? "K" : "k", castle: "K" });
      }
    }

    if ((color === "w" && rights.includes("Q")) || (color === "b" && rights.includes("q"))) {
      if (this.board[rank * 8 + 0] === rook
        && !this.board[rank * 8 + 3] && !this.board[rank * 8 + 2] && !this.board[rank * 8 + 1]
        && !this.isSquareAttacked(rank * 8 + 3, color) && !this.isSquareAttacked(rank * 8 + 2, color)) {
        moves.push({ from: index, to: rank * 8 + 2, piece: color === "w" ? "K" : "k", castle: "Q" });
      }
    }

    return moves;
  }

  isLegal(move) {
    const snapshot = this.clone();
    snapshot.makeMove(move);
    return !snapshot.inCheck(this.turn);
  }

  makeMove(move) {
    const movingPiece = this.board[move.from];
    const captured = this.board[move.to];
    const wasBlackMove = this.turn === "b";
    const resetsHalfmove = Boolean(movingPiece && movingPiece.toUpperCase() === "P") || Boolean(captured) || Boolean(move.enPassant);
    this.board[move.from] = null;

    if (move.enPassant) {
      const dir = this.isWhite(movingPiece) ? 1 : -1;
      this.board[move.to + dir * 8] = null;
    }

    if (move.castle) {
      const rank = this.isWhite(movingPiece) ? 7 : 0;
      if (move.castle === "K") {
        this.board[rank * 8 + 5] = this.board[rank * 8 + 7];
        this.board[rank * 8 + 7] = null;
      } else {
        this.board[rank * 8 + 3] = this.board[rank * 8 + 0];
        this.board[rank * 8 + 0] = null;
      }
    }

    this.board[move.to] = move.promotion || movingPiece;
    this.updateCastlingRights(movingPiece, move, captured);

    if (move.doublePawn) {
      this.enPassant = move.from + (this.isWhite(movingPiece) ? -8 : 8);
    } else {
      this.enPassant = -1;
    }

    this.halfmove = resetsHalfmove ? 0 : (Number.isFinite(this.halfmove) ? this.halfmove + 1 : 1);
    if (wasBlackMove) {
      this.fullmove = Number.isFinite(this.fullmove) ? this.fullmove + 1 : 1;
    }
    this.turn = this.turn === "w" ? "b" : "w";
  }

  updateCastlingRights(piece, move, captured) {
    if (piece.toUpperCase() === "K") {
      this.castling = this.castling.replace(this.isWhite(piece) ? /K|Q/g : /k|q/g, "");
    }
    if (piece.toUpperCase() === "R") {
      const from = move.from;
      if (from === 56) this.castling = this.castling.replace("Q", "");
      if (from === 63) this.castling = this.castling.replace("K", "");
      if (from === 0) this.castling = this.castling.replace("q", "");
      if (from === 7) this.castling = this.castling.replace("k", "");
    }
    if (captured && captured.toUpperCase() === "R") {
      if (move.to === 56) this.castling = this.castling.replace("Q", "");
      if (move.to === 63) this.castling = this.castling.replace("K", "");
      if (move.to === 0) this.castling = this.castling.replace("q", "");
      if (move.to === 7) this.castling = this.castling.replace("k", "");
    }
  }

  inCheck(color) {
    const king = color === "w" ? "K" : "k";
    const kingIndex = this.board.findIndex((piece) => piece === king);
    return this.isSquareAttacked(kingIndex, color);
  }

  isSquareAttacked(index, color) {
    if (index < 0) return false;
    const enemy = color === "w" ? "b" : "w";
    const rank = Math.floor(index / 8);
    const file = index % 8;

    const enemyPawn = enemy === "w" ? "P" : "p";
    const pawnDir = enemy === "w" ? 1 : -1;
    for (const df of [-1, 1]) {
      const r = rank + pawnDir;
      const f = file + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      const idx = r * 8 + f;
      if (this.board[idx] === enemyPawn) return true;
    }

    const knight = enemy === "w" ? "N" : "n";
    const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, df] of jumps) {
      const r = rank + dr;
      const f = file + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      if (this.board[r * 8 + f] === knight) return true;
    }

    const rook = enemy === "w" ? "R" : "r";
    const bishop = enemy === "w" ? "B" : "b";
    const queen = enemy === "w" ? "Q" : "q";
    const king = enemy === "w" ? "K" : "k";

    const lines = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dr, df] of lines) {
      let r = rank + dr;
      let f = file + df;
      while (r >= 0 && r < 8 && f >= 0 && f < 8) {
        const idx = r * 8 + f;
        const piece = this.board[idx];
        if (piece) {
          const isDiagonal = dr !== 0 && df !== 0;
          if (piece === queen) return true;
          if (isDiagonal && piece === bishop) return true;
          if (!isDiagonal && piece === rook) return true;
          break;
        }
        r += dr;
        f += df;
      }
    }

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let df = -1; df <= 1; df += 1) {
        if (dr === 0 && df === 0) continue;
        const r = rank + dr;
        const f = file + df;
        if (r < 0 || r > 7 || f < 0 || f > 7) continue;
        if (this.board[r * 8 + f] === king) return true;
      }
    }

    return false;
  }

  clone() { return new Chess(this.fen()); }
}

Chess.START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Structural FEN validation for FEN strings coming from outside the app (e.g.
// a PGN "FEN" tag). loadFen() itself stays permissive, since every other
// caller only ever feeds it FEN strings the app generated itself; this is the
// gate untrusted input goes through before it is trusted enough to load.
Chess.isValidFen = function isValidFen(fen) {
  if (typeof fen !== "string") return false;
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) return false;
  const [placement, turn, castling, enPassant, halfmove, fullmove] = parts;

  const rows = placement.split("/");
  if (rows.length !== 8) return false;
  const board = Array(64).fill(null);
  let whiteKings = 0;
  let blackKings = 0;
  for (let rankIdx = 0; rankIdx < 8; rankIdx += 1) {
    let file = 0;
    for (const char of rows[rankIdx]) {
      if (/[1-8]/.test(char)) {
        file += Number(char);
      } else if (/[pnbrqkPNBRQK]/.test(char)) {
        if (file > 7) return false;
        board[rankIdx * 8 + file] = char;
        if (char === "K") whiteKings += 1;
        if (char === "k") blackKings += 1;
        file += 1;
      } else {
        return false;
      }
    }
    if (file !== 8) return false;
  }
  if (whiteKings !== 1 || blackKings !== 1) return false;

  if (turn !== "w" && turn !== "b") return false;

  if (castling !== "-") {
    if (!castling || !/^K?Q?k?q?$/.test(castling)) return false;
    // A castling right is only meaningful with its rook still on the corner;
    // a FEN claiming otherwise is exactly the inconsistency generateCastlingMoves
    // guards against, so it is rejected here too rather than loaded.
    if (castling.includes("K") && board[63] !== "R") return false;
    if (castling.includes("Q") && board[56] !== "R") return false;
    if (castling.includes("k") && board[7] !== "r") return false;
    if (castling.includes("q") && board[0] !== "r") return false;
  }

  if (enPassant !== "-" && !/^[a-h][36]$/.test(enPassant)) return false;
  if (!/^\d+$/.test(halfmove)) return false;
  if (!/^\d+$/.test(fullmove) || Number(fullmove) < 1) return false;

  return true;
};

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

function gameMoveAuthorName() {
  const fromAnalysis = sanitizePlayerName(STATE.analysisContext?.targetName, "");
  if (fromAnalysis) return fromAnalysis;
  const fromWizard = sanitizePlayerName(STATE.setupWizard?.username, "");
  if (fromWizard) return fromWizard;
  const fromRemote = sanitizePlayerName(STATE.remotePgnSources?.[0]?.username, "");
  if (fromRemote) return fromRemote;
  const fromDetected = sanitizePlayerName(playerNameDetectedEl?.textContent, "");
  if (fromDetected && fromDetected !== t("players.notDetected")) return fromDetected;
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

function setPositionSearchProgress(ratio = null, label = "") {
  if (!positionSearchProgressEl || !positionSearchProgressBarEl || !positionSearchProgressLabelEl) return;
  if (!Number.isFinite(ratio)) {
    if (STATE.ui.positionSearchState) {
      STATE.ui.positionSearchState.progressRatio = null;
      STATE.ui.positionSearchState.progressLabel = "";
    }
    positionSearchProgressEl.classList.add("hidden");
    positionSearchProgressBarEl.style.width = "0%";
    positionSearchProgressLabelEl.textContent = "";
    return;
  }
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  if (STATE.ui.positionSearchState) {
    STATE.ui.positionSearchState.progressRatio = safeRatio;
    STATE.ui.positionSearchState.progressLabel = String(label || `${Math.round(safeRatio * 100)}%`);
  }
  positionSearchProgressEl.classList.remove("hidden");
  positionSearchProgressBarEl.style.width = `${Math.round(safeRatio * 100)}%`;
  positionSearchProgressLabelEl.textContent = String(label || `${Math.round(safeRatio * 100)}%`);
}

function normalizeThinkingLevel(level) {
  if (level === "hard") return "hard";
  if (level === "easy") return "easy";
  return "medium";
}

function nextRoundThinkingMessage(level = "medium") {
  const bucket = normalizeThinkingLevel(level);
  const thinkingState = STATE.ui.thinkingMessages;
  if (thinkingState.level !== bucket || !Array.isArray(thinkingState.queue) || thinkingState.queue.length === 0) {
    thinkingState.level = bucket;
    const facts = preferredLocale() === "en" ? ROUND_THINKING_FACTS_EN : ROUND_THINKING_FACTS;
    thinkingState.queue = shuffle([...(facts || ROUND_THINKING_FACTS)]);
  }
  return thinkingState.queue.pop() || t("common.searching");
}

function stopRoundThinkingMessages() {
  const thinkingState = STATE.ui.thinkingMessages;
  if (thinkingState.intervalId) {
    clearInterval(thinkingState.intervalId);
    thinkingState.intervalId = null;
  }
  thinkingState.queue = [];
}

function startRoundThinkingMessages(level = "medium") {
  stopRoundThinkingMessages();
  if (!positionSearchMetaEl) return;
  const normalizedLevel = normalizeThinkingLevel(level);
  const pushMessage = () => {
    if (!positionSearchMetaEl || positionSearchOverlayEl?.classList.contains("hidden")) return;
    positionSearchMetaEl.textContent = nextRoundThinkingMessage(normalizedLevel);
  };
  pushMessage();
  // Removed setInterval to stop continuous message changes.
  // STATE.ui.thinkingMessages.intervalId = setInterval(pushMessage, ROUND_THINKING_MESSAGE_INTERVAL_MS);
}

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
}

function hidePositionSearchOverlay() {
  if (!positionSearchOverlayEl) return;
  positionSearchOverlayEl.classList.add("hidden");
  STATE.ui.positionSearchState = null;
  stopRoundThinkingMessages();
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

function enterResultAnalysisMode() {
  if (!STATE.resultView.visible || !STATE.resultView.snapshotFen) return;
  applyResultSnapshotToBoard();
  STATE.resultView.analysisMode = true;
  setUiPhase("result_analysis", false);
  updateResultAnalysisControls();
}

function resetResultAnalysisBoard() {
  if (!STATE.resultView.visible || !STATE.resultView.snapshotFen) return;
  applyResultSnapshotToBoard();
  if (STATE.resultView.analysisMode) setUiPhase("result_analysis", false);
  updateResultAnalysisControls();
}

function qualityToVerdictClass(qualityCode) {
  if (!qualityCode) return "";
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

function renderResultViewContext() {
  const context = STATE.resultView.context;
  if (!context) return;
  if (context.kind === "round_solo") {
    renderRoundFeedbackTable(
      context.bestSan,
      evaluationToText(decodeEvaluation(context.bestMover)),
      context.gameSan,
      Number.isFinite(context.gameMover) ? evaluationToText(decodeEvaluation(context.gameMover)) : t("common.notAvailable"),
      context.userSan || "",
      evaluationToText(decodeEvaluation(context.userMover)),
      context.bestMover,
      context.gameMover,
      context.userMover,
      context.scored,
      context.noMoveReason,
      { mode: "solo", hitThreshold: context.hitThreshold },
    );
    const summary = !context.userMove
      ? (context.noMoveReason === "timeout" ? t("evaluation.timeoutZeroPts") : t("evaluation.noMoveMadeZeroPts"))
      : t("evaluation.wonPoints", { points: formatSigned(context.scored.points) });
    showResultOverlay(t("game.result.yourMove"), summary, context.scored?.qualityCode);
    return;
  }

  if (context.kind === "round_duel") {
    renderRoundFeedbackTable(
      context.bestSan,
      evaluationToText(decodeEvaluation(context.bestMover)),
      context.gameSan,
      Number.isFinite(context.gameMover) ? evaluationToText(decodeEvaluation(context.gameMover)) : t("common.notAvailable"),
      context.player2.san || "",
      evaluationToText(decodeEvaluation(context.currentUserMover)),
      context.bestMover,
      context.gameMover,
      context.currentUserMover,
      context.currentScored,
      context.currentNoMoveReason,
      {
        mode: "duel",
        duel: {
          player1: context.player1,
          player2: context.player2,
        },
      },
    );
    showResultOverlay(
      t("game.result.positionSolved"),
      `R${context.round}: ${context.player1.name} ${formatSigned(context.player1.points)} · ${context.player2.name} ${formatSigned(context.player2.points)}`
    );
    let winnerText = t("game.comparison.tie");
    if (context.player1.points > context.player2.points) winnerText = t("game.comparison.advantage", { player: context.player1.name });
    if (context.player2.points > context.player1.points) winnerText = t("game.comparison.advantage", { player: context.player2.name });
    roundResultEl.insertAdjacentHTML("afterbegin", `<p class="result-summary-line">${escapeHtml(winnerText)}</p>`);
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

function soloScoreText() {
  return `${formatPoints(STATE.score || 0)} pts`;
}

function duelMatchScoreText() {
  return `${duelPlayerName(0)} ${formatPoints(STATE.duel.scores[0] || 0)} - ${formatPoints(STATE.duel.scores[1] || 0)} ${duelPlayerName(1)}`;
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
  wizardTimerChipEls.forEach((chipEl) => {
    const chipSeconds = Number(chipEl.getAttribute("data-seconds")) || 0;
    const selected = chipSeconds === seconds;
    chipEl.classList.toggle("is-selected", selected);
    chipEl.setAttribute("aria-pressed", selected ? "true" : "false");
  });
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

// Un solo reloj para los dos modos: el de la barra de ronda. En duelo muestra
// el tiempo del jugador que está al turno, porque sólo uno juega a la vez.
function updateRoundTimerUi(remainingMs = STATE.timer.deadlineMs - Date.now()) {
  if (!soloClockRailEl || !soloClockValueEl || !soloClockBarEl) return;

  const duration = Math.max(1, STATE.timer.durationMs || Math.round(STATE.turnTimeSeconds * 1000));
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = clamp(safeRemaining / duration, 0, 1);

  const showClock = document.body.classList.contains("playing-mode") && !STATE.resultView.visible;
  soloClockRailEl.classList.toggle("hidden", !showClock);
  if (!showClock) return;

  soloClockValueEl.textContent = formatClock(safeRemaining);
  soloClockBarEl.style.setProperty("--clock-ratio", `${Math.round(ratio * 100)}%`);
  soloClockRailEl.classList.remove("urgency-mid", "urgency-high");
  if (ratio <= 0.2) {
    soloClockRailEl.classList.add("urgency-high");
  } else if (ratio <= 0.45) {
    soloClockRailEl.classList.add("urgency-mid");
  }
}

function startRoundTimer() {
  stopRoundTimer();
  const durationMs = Math.round(normalizeTurnTimeSeconds(STATE.turnTimeSeconds) * 1000);
  STATE.timer.durationMs = durationMs;
  STATE.timer.deadlineMs = Date.now() + durationMs;
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

function getEffectiveAnalysisConfig() {
  if (STATE.userMode === "citizen") {
    return {
      moveTimeMs: DEFAULT_CITIZEN_MOVETIME,
      thresholdCp: DEFAULT_CITIZEN_THRESHOLD,
      scoringSystem: DEFAULT_SCORING_SYSTEM,
    };
  }
  return {
    moveTimeMs: clamp(Number(analysisTimeMsEl.value) || DEFAULT_CITIZEN_MOVETIME, 50, 10000),
    thresholdCp: clamp(Number(thresholdEl.value) || DEFAULT_CITIZEN_THRESHOLD, 50, 800),
    scoringSystem: normalizeScoringSystem(scoringSystemEl ? scoringSystemEl.value : DEFAULT_SCORING_SYSTEM),
  };
}

function getRatingConfig() {
  return { depth: RATING_DEPTH, moveTimeMs: RATING_MOVE_TIME_MS };
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
}

function showWizardSourceError(key = "common.sourceError", params = {}) {
  const hasTranslation = Object.prototype.hasOwnProperty.call(TRANSLATIONS[preferredLocale()] || {}, key)
    || Object.prototype.hasOwnProperty.call(TRANSLATIONS.es || {}, key);
  const text = hasTranslation ? t(key, params) : String(key || "").trim();
  STATE.setupWizard.sourceError = hasTranslation ? { key, params } : { raw: text };
  if (wizardSourceErrorEl) {
    wizardSourceErrorEl.textContent = text;
    wizardSourceErrorEl.classList.remove("hidden");
  }
  if (wizardSourceCtaEl) wizardSourceCtaEl.classList.remove("hidden");
}

function clearWizardStepError() {
  if (wizardStepErrorEl) {
    wizardStepErrorEl.textContent = "";
    wizardStepErrorEl.classList.add("hidden");
  }
  [duelPlayerAEl, duelPlayerBEl].forEach((inputEl) => {
    if (inputEl) inputEl.removeAttribute("aria-describedby");
  });
}

function showWizardStepError(message = "") {
  if (!wizardStepErrorEl) return;
  const text = String(message || "").trim();
  wizardStepErrorEl.textContent = text;
  wizardStepErrorEl.classList.toggle("hidden", !text);
  [duelPlayerAEl, duelPlayerBEl].forEach((inputEl) => {
    if (!inputEl) return;
    if (text) inputEl.setAttribute("aria-describedby", "wizard-step-error");
    else inputEl.removeAttribute("aria-describedby");
  });
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
    `<p><strong>${escapeHtml(t("game.summaryRoundTime"))}:</strong> ${config.turnTimeSeconds}s</p>`,
  ].join("");
}

function renderWizardStep() {
  const step = clamp(Number(STATE.setupWizard.step) || 1, 1, 3);
  STATE.setupWizard.step = step;
  const config = collectWizardConfig();

  wizardStepEls.forEach((stepEl, idx) => {
    if (!stepEl) return;
    const isCurrent = idx + 1 === step;
    stepEl.classList.toggle("hidden", !isCurrent);
    stepEl.classList.toggle("is-active", isCurrent);
  });

  if (wizardStepIndicatorEl) wizardStepIndicatorEl.textContent = t("wizard.stepIndicator", { step, total: 3 });
  if (wizardProgressBarEl) wizardProgressBarEl.style.width = `${Math.round((step / 3) * 100)}%`;

  if (wizardModeSoloBtn) {
    const selected = config.mode === "solo";
    wizardModeSoloBtn.classList.toggle("is-selected", selected);
    wizardModeSoloBtn.setAttribute("aria-pressed", selected ? "true" : "false");
  }
  if (wizardModeDuelBtn) {
    const selected = config.mode === "duel";
    wizardModeDuelBtn.classList.toggle("is-selected", selected);
    wizardModeDuelBtn.setAttribute("aria-pressed", selected ? "true" : "false");
  }
  if (duelConfigEl) duelConfigEl.classList.toggle("hidden", config.mode !== "duel");

  if (wizardProviderLichessBtn) {
    const selected = config.platform === "lichess";
    wizardProviderLichessBtn.classList.toggle("is-selected", selected);
    wizardProviderLichessBtn.setAttribute("aria-pressed", selected ? "true" : "false");
  }
  if (wizardProviderChessComBtn) {
    const selected = config.platform === "chesscom";
    wizardProviderChessComBtn.classList.toggle("is-selected", selected);
    wizardProviderChessComBtn.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  wizardSizeChipEls.forEach((chipEl) => {
    const chipSize = Number(chipEl.getAttribute("data-size")) || 0;
    const selected = chipSize === config.sessionSize;
    chipEl.classList.toggle("is-selected", selected);
    chipEl.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  updateWizardTimerChipSelection(config.turnTimeSeconds);

  if (wizardPrevBtn) wizardPrevBtn.classList.toggle("hidden", step <= 1);
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
      return { valid: false, reason: t("wizard.validation.chooseMode") };
    }
    if (config.mode === "duel") {
      const [a, b] = config.duelNames;
      if (!a || !b) {
        return { valid: false, reason: t("wizard.validation.fillDuelNames") };
      }
      if (a.length > 20 || b.length > 20) {
        return { valid: false, reason: t("wizard.validation.duelNameMax") };
      }
    }
  }

  if (safeStep >= 2) {
    if (!isRemoteSourceMode(config.platform)) {
      return { valid: false, reason: t("wizard.validation.choosePlatform") };
    }
    if (!config.username) {
      return { valid: false, reason: t("wizard.validation.enterUsername") };
    }
    if (!usernamePattern.test(config.username)) {
      return { valid: false, reason: t("wizard.validation.invalidUsername") };
    }
  }

  if (safeStep >= 3) {
    if (!Number.isInteger(config.sessionSize) || config.sessionSize < 1 || config.sessionSize > 200) {
      return { valid: false, reason: t("wizard.validation.chooseCount") };
    }
  }

  return { valid: true, reason: t("wizard.validation.ready") };
}

function goToWizardStep(step) {
  STATE.setupWizard.step = clamp(Number(step) || 1, 1, 3);
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

function resetSetupWizard({ mode = null, statusMessage = "" } = {}) {
  if (mode) {
    STATE.setupWizard.mode = normalizeGameFormat(mode);
  }
  STATE.setupWizard.step = 1;
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
  goToWizardStep(1);
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
  if (analysisStatusEl && !blockedByAnalysis && STATE.setupWizard.step !== 2 && !readiness.valid) {
    analysisStatusEl.textContent = readiness.reason;
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

function showLandingScreen() {
  if (landingScreenEl) {
    landingScreenEl.classList.remove("hidden");
    landingScreenEl.style.display = "";
  }
  document.body.classList.add("landing-active");
  if (setupPanelEl) {
    setupPanelEl.classList.add("hidden");
    setupPanelEl.style.display = "";
  }
}

function openSetupFromLanding({ format = null, statusMessage = "" } = {}) {
  if (landingScreenEl) {
    landingScreenEl.classList.add("hidden");
    landingScreenEl.style.display = "none";
  }
  document.body.classList.remove("landing-active");
  if (setupPanelEl) {
    setupPanelEl.classList.remove("hidden");
    setupPanelEl.style.display = "grid";
  }
  if (format) {
    const normalized = normalizeGameFormat(format);
    if (gameFormatEl) gameFormatEl.value = normalized;
    STATE.setupWizard.mode = normalized;
  }
  resetSetupWizard({
    mode: format ? normalizeGameFormat(format) : STATE.setupWizard.mode,
    statusMessage: statusMessage || t("wizard.status.currentStep"),
  });
  updatePgnSelectionUi();
}

function startFromLanding() {
  // Opening the wizard is the first sign of someone meaning to play, so the
  // engine download starts here and usually finishes while they fill in the
  // three steps. Whoever only looks at the landing page pays nothing.
  void ensureStockfishLoading();
  openSetupFromLanding({
    statusMessage: t("wizard.status.modeSourceOptions"),
  });
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

function moveToUci(move) {
  if (!move) return "";
  return `${Chess.indexToSquare(move.from)}${Chess.indexToSquare(move.to)}${move.promotion ? move.promotion.toLowerCase() : ""}`;
}

function uciToMove(uci, board) {
  if (!uci || uci === "(none)") return null;
  const from = Chess.squareToIndex(uci.slice(0, 2));
  const to = Chess.squareToIndex(uci.slice(2, 4));
  const promo = uci[4];
  return board.generateMoves().find((move) => {
    if (move.from !== from || move.to !== to) return false;
    if (promo) {
      const expected = board.turn === "w" ? promo.toUpperCase() : promo.toLowerCase();
      return move.promotion === expected;
    }
    return true;
  }) || null;
}

function moveToSan(board, move) {
  if (!move) return "-";
  const after = board.clone();
  after.makeMove(move);
  const opponentTurn = after.turn;
  const suffix = after.inCheck(opponentTurn)
    ? (after.generateMoves().length === 0 ? "#" : "+")
    : "";
  if (move.castle === "K") return `O-O${suffix}`;
  if (move.castle === "Q") return `O-O-O${suffix}`;
  const piece = move.piece.toUpperCase();
  const destination = Chess.indexToSquare(move.to);
  const capture = move.capture || move.enPassant ? "x" : "";
  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  if (piece === "P") {
    const file = files[move.from % 8];
    return `${capture ? file : ""}${capture}${destination}${promo}${suffix}`;
  }

  const ambiguousMoves = board.generateMoves().filter((candidate) => (
    candidate !== move
    && candidate.to === move.to
    && candidate.from !== move.from
    && candidate.piece.toUpperCase() === piece
  ));
  let disambiguation = "";
  if (ambiguousMoves.length > 0) {
    const file = files[move.from % 8];
    const rank = String(8 - Math.floor(move.from / 8));
    const sameFile = ambiguousMoves.some((candidate) => files[candidate.from % 8] === file);
    const sameRank = ambiguousMoves.some((candidate) => String(8 - Math.floor(candidate.from / 8)) === rank);
    if (!sameFile) {
      disambiguation = file;
    } else if (!sameRank) {
      disambiguation = rank;
    } else {
      disambiguation = `${file}${rank}`;
    }
  }
  return `${piece}${disambiguation}${capture}${destination}${promo}${suffix}`;
}

function toMoverScore(whiteScore, moverTurn) {
  return moverTurn === "w" ? whiteScore : -whiteScore;
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

function evaluationToText(evalObj) {
  if (!evalObj) return t("common.notAvailable");
  if (evalObj.kind === "cp") {
    const cp = Math.round(evalObj.cp);
    const sign = cp > 0 ? "+" : "";
    return `${sign}${cp} cp`;
  }
  return evalObj.matePly > 0
    ? t("evaluation.mateIn", { ply: evalObj.matePly })
    : t("evaluation.getsMatedIn", { ply: Math.abs(evalObj.matePly) });
}

const SCORING_SYSTEMS = {
  simple_labels_v1: {
    labelKey: "scoring.system.simple.label",
    descriptionKey: "scoring.system.simple.description",
  },
};

const WIN_CHANCE_MULTIPLIER = -0.00368208;

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

function formatPoints(value, options = {}) {
  const { signed = false } = options;
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  let text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  if (signed && rounded > 0) text = `+${text}`;
  return text;
}

function formatSigned(value) {
  return formatPoints(value, { signed: true });
}

function scoreToWinningChance(score) {
  if (!Number.isFinite(score)) return null;
  const abs = Math.abs(score);
  if (abs >= MATE_SCORE_THRESHOLD) {
    const mateDistance = Math.max(1, Math.round((MATE_SCORE_BASE - abs) / MATE_SCORE_STEP));
    const cp = (21 - Math.min(10, mateDistance)) * 100;
    const signed = cp * (score >= 0 ? 1 : -1);
    return 2 / (1 + Math.exp(WIN_CHANCE_MULTIPLIER * signed)) - 1;
  }
  const limitedCp = clamp(score, -1000, 1000);
  return 2 / (1 + Math.exp(WIN_CHANCE_MULTIPLIER * limitedCp)) - 1;
}

function scoreToExpectedPoints(score) {
  const chance = scoreToWinningChance(score);
  if (!Number.isFinite(chance)) return null;
  return (chance + 1) / 2;
}

function cpQualityCode(loss, exactBest = false, expectedLoss = null, reasonCode = "") {
  if (reasonCode === "no_move") return "no_move";
  if (reasonCode === "allows_mate" || reasonCode === "missed_forced_mate") return "blunder";
  if (exactBest || reasonCode === "optimal_mate") return "perfect";
  if (!Number.isFinite(loss)) return "no_move";
  const nearPerfectByCp = loss <= 10;
  const nearPerfectByExpected = Number.isFinite(expectedLoss) && expectedLoss <= 0.008 && loss <= 18;
  if (nearPerfectByCp || nearPerfectByExpected) return "perfect";
  if (loss <= 35) return "very_good";
  if (loss <= 70) return "good";
  if (loss <= 115) return "interesting";
  if (loss <= 165) return "dubious";
  if (loss <= 240) return "bad";
  return "blunder";
}

function pointsFromQualityCode(code) {
  switch (code) {
    case "perfect":
      return 1;
    case "very_good":
      return 0.75;
    case "good":
      return 0.5;
    case "interesting":
      return 0.25;
    case "dubious":
      return 0;
    case "bad":
      return -0.5;
    case "blunder":
      return -1;
    case "no_move":
    default:
      return 0;
  }
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

function scoreMoveAgainstBest(bestMoverScore, choiceMoverScore, scoringSystem = STATE.scoringSystem, options = {}) {
  const system = normalizeScoringSystem(scoringSystem);
  const base = computeLossAgainstBest(bestMoverScore, choiceMoverScore);
  const exactBest = Boolean(options.exactBest);
  const bestExpected = scoreToExpectedPoints(bestMoverScore);
  const choiceExpected = scoreToExpectedPoints(choiceMoverScore);
  const expectedLoss = Number.isFinite(bestExpected) && Number.isFinite(choiceExpected)
    ? clamp(bestExpected - choiceExpected, 0, 1)
    : null;
  const qualityCode = cpQualityCode(base.loss, exactBest, expectedLoss, base.reasonCode);
  const points = pointsFromQualityCode(qualityCode);

  return {
    ...base,
    points: Math.round(points * 100) / 100,
    qualityCode,
    expectedLoss,
    scoringSystem: system,
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

function getRoundEvaluationPlan(board, position, baseMoveTimeMs = RATING_MOVE_TIME_MS) {
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

  const base = clamp(Number(baseMoveTimeMs) || RATING_MOVE_TIME_MS, 900, ROUND_EVAL_MAX_TOTAL_MS);
  const scaledBudget = Math.round(2600 + normalized * 4400);
  const weightedBudget = Math.round((scaledBudget * 0.7) + (base * 0.3));
  const totalBudgetMs = clamp(weightedBudget, ROUND_EVAL_MIN_TOTAL_MS, ROUND_EVAL_MAX_TOTAL_MS);

  return {
    level,
    label,
    totalBudgetMs,
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

function normalizeScore(score, turn) {
  return turn === "w" ? score : -score;
}

function resetEngineToLocal() {
  if (STATE.engine.worker) {
    try {
      STATE.engine.worker.terminate();
    } catch (error) {
      // ignore terminate failures
    }
  }
  STATE.engine = { mode: "local", worker: null, ready: false, evalCache: new Map() };
}

function localFallbackDepth(depth) {
  return clamp(Number(depth) || LOCAL_FALLBACK_MAX_DEPTH, 1, LOCAL_FALLBACK_MAX_DEPTH);
}

function cacheGet(key) {
  return STATE.engine.evalCache.get(key);
}

function cacheSet(key, value) {
  if (STATE.engine.evalCache.size > 25000) {
    STATE.engine.evalCache.clear();
  }
  STATE.engine.evalCache.set(key, value);
}

async function waitForWorkerReady(worker, timeoutMs = ENGINE_READY_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      resolve(value);
    };
    const timeout = setTimeout(() => finish(false), timeoutMs);

    const onMessage = (event) => {
      const line = typeof event.data === "string" ? event.data : "";
      if (line === "readyok") finish(true);
      else if (line.startsWith("engine-error")) finish(false);
    };
    // A missing or broken engine file gives up here instead of burning the
    // whole wait on an answer that is never coming.
    const onError = () => finish(false);

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage("uci");
    worker.postMessage("isready");
  });
}

// One attempt at starting the strong engine. The worker requests the engine
// file itself, so the app no longer fetches it first just to check it is there.
async function setupStockfish() {
  resetEngineToLocal();
  try {
    const worker = new Worker("vendor/stockfish-18-lite-single.js");
    worker.onerror = () => resetEngineToLocal();
    const ready = await waitForWorkerReady(worker);
    if (!ready) {
      try {
        worker.terminate();
      } catch (error) {
        // ignore
      }
      return false;
    }
    STATE.engine = { mode: "stockfish", worker, ready: true, evalCache: new Map() };
    return true;
  } catch (error) {
    resetEngineToLocal();
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
        if (attempt > 0) await sleepMs(ENGINE_RETRY_BASE_MS * attempt);
        if (await setupStockfish()) return true;
      }
      return false;
    })().finally(() => {
      engineLoad = null;
    });
  }
  return engineLoad;
}

async function stockfishEvaluate(fen, depth, moveTimeMs, options = {}) {
  return new Promise((resolve, reject) => {
    // Keep this worker in a local reference. When a worker fails mid-round the
    // app switches to the local engine and the shared reference becomes null;
    // the cleanup below used to throw on that null before rejecting, which left
    // the promise pending and the screen stuck on "evaluating" with no way out.
    const worker = STATE.engine.worker;
    if (!worker) {
      reject(new Error("Worker no disponible"));
      return;
    }

    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    let lastScore = 0;
    let lastDepth = 0;
    let lastElapsedMs = 0;
    let finished = false;
    const safeMoveTime = clamp(Number(moveTimeMs) || 0, 0, 10000);
    const startedAt = Date.now();
    const timeoutMs = Math.max(15000, safeMoveTime * 3 + 5000);
    const emitProgress = (forcedRatio = null) => {
      if (!onProgress) return;
      if (finished && !Number.isFinite(forcedRatio)) return;
      const elapsedMs = Number.isFinite(lastElapsedMs) && lastElapsedMs > 0
        ? lastElapsedMs
        : (Date.now() - startedAt);
      let ratio = Number.isFinite(forcedRatio) ? forcedRatio : 0;
      if (!Number.isFinite(forcedRatio)) {
        if (safeMoveTime > 0) {
          ratio = clamp(elapsedMs / safeMoveTime, 0, 0.98);
        } else {
          ratio = clamp(lastDepth / Math.max(1, Number(depth) || 1), 0, 0.98);
        }
      }
      onProgress({
        ratio,
        elapsedMs,
        targetMs: safeMoveTime,
        depth: lastDepth,
      });
    };
    const progressInterval = onProgress ? setInterval(() => emitProgress(), 120) : null;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("Timeout del motor"));
    }, timeoutMs);

    const handler = (event) => {
      const line = event.data;
      if (typeof line !== "string") return;
      if (line.startsWith("info ")) {
        const depthMatch = line.match(/\bdepth (\d+)/);
        if (depthMatch) lastDepth = Number(depthMatch[1]);
        const timeMatch = line.match(/\btime (\d+)/);
        if (timeMatch) lastElapsedMs = Number(timeMatch[1]);
        emitProgress();
      }
      if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) lastScore = Number(match[1]);
      }
      if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
          const mate = Number(match[1]);
          lastScore = encodeMateScore(mate);
        }
      }
      if (line.startsWith("bestmove")) {
        if (finished) return;
        finished = true;
        cleanup();
        emitProgress(1);
        const bestMove = line.split(" ")[1];
        resolve({ bestMove, score: lastScore });
      }
    };

    const onWorkerError = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("Fallo del motor"));
    };

    function cleanup() {
      if (progressInterval) clearInterval(progressInterval);
      clearTimeout(timeout);
      worker.removeEventListener("message", handler);
      worker.removeEventListener("error", onWorkerError);
    }

    worker.addEventListener("message", handler);
    worker.addEventListener("error", onWorkerError);
    worker.postMessage(`position fen ${fen}`);
    if (safeMoveTime > 0) {
      worker.postMessage(`go movetime ${safeMoveTime}`);
    } else {
      worker.postMessage(`go depth ${depth}`);
    }
  });
}

async function getBestMoveWithEngine(board, depth, moveTimeMs, options = {}) {
  const effectiveMoveTime = adaptiveMoveTime(moveTimeMs, board, options);
  if (STATE.engine.mode === "stockfish") {
    const stockfishCacheKey = `best|stockfish|${board.fen()}|d${depth}|t${effectiveMoveTime}`;
    const cached = cacheGet(stockfishCacheKey);
    if (cached) {
      if (typeof options.onProgress === "function") {
        options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, cached: true });
      }
      return { move: uciToMove(cached.bestMove, board), score: cached.score };
    }
    try {
      const result = await stockfishEvaluate(board.fen(), depth, effectiveMoveTime, {
        onProgress: options.onProgress,
      });
      const normalized = normalizeScore(result.score, board.turn);
      cacheSet(stockfishCacheKey, { bestMove: result.bestMove, score: normalized });
      return { move: uciToMove(result.bestMove, board), score: normalized };
    } catch (error) {
      resetEngineToLocal();
    }
  }

  const depthForLocal = localFallbackDepth(depth);
  const localCacheKey = `best|local|${board.fen()}|d${depthForLocal}`;
  const cached = cacheGet(localCacheKey);
  if (cached) {
    if (typeof options.onProgress === "function") {
      options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, cached: true, fallback: true });
    }
    return { move: uciToMove(cached.bestMove, board), score: cached.score };
  }
  const local = searchBestMove(board, depthForLocal);
  if (typeof options.onProgress === "function") {
    options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, fallback: true, depth: depthForLocal });
  }
  cacheSet(localCacheKey, { bestMove: moveToUci(local.move), score: local.score });
  return local;
}

async function evaluateMoveWithEngine(board, move, depth, moveTimeMs, options = {}) {
  const clone = board.clone();
  clone.makeMove(move);
  const effectiveMoveTime = adaptiveMoveTime(moveTimeMs, board, options);
  if (STATE.engine.mode === "stockfish") {
    const stockfishCacheKey = `eval|stockfish|${clone.fen()}|d${depth}|t${effectiveMoveTime}`;
    const cached = cacheGet(stockfishCacheKey);
    if (Number.isFinite(cached)) {
      if (typeof options.onProgress === "function") {
        options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, cached: true });
      }
      return cached;
    }
    try {
      const result = await stockfishEvaluate(clone.fen(), depth, effectiveMoveTime, {
        onProgress: options.onProgress,
      });
      const normalized = normalizeScore(result.score, clone.turn);
      cacheSet(stockfishCacheKey, normalized);
      return normalized;
    } catch (error) {
      resetEngineToLocal();
    }
  }

  const depthForLocal = localFallbackDepth(depth);
  const localCacheKey = `eval|local|${clone.fen()}|d${depthForLocal}`;
  const cached = cacheGet(localCacheKey);
  if (Number.isFinite(cached)) {
    if (typeof options.onProgress === "function") {
      options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, cached: true, fallback: true });
    }
    return cached;
  }
  const localScore = evaluatePosition(clone, depthForLocal);
  if (typeof options.onProgress === "function") {
    options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, fallback: true, depth: depthForLocal });
  }
  cacheSet(localCacheKey, localScore);
  return localScore;
}

// ---------- PGN parsing ----------

// Strips (parenthesised variations). Bails out once nesting goes past
// PGN_MAX_VARIATION_DEPTH so a single pathological game (accidental or
// hostile) cannot force unbounded work here or in later parsing steps; the
// caller treats an overflowed result as a malformed game and skips it.
function removeVariations(text) {
  let out = "";
  let level = 0;
  for (const ch of text) {
    if (ch === "(") {
      level += 1;
      if (level > PGN_MAX_VARIATION_DEPTH) return { text: out, overflowed: true };
    } else if (ch === ")") {
      level = Math.max(0, level - 1);
    } else if (level === 0) {
      out += ch;
    }
  }
  return { text: out, overflowed: false };
}

// True when any single {...} comment in the raw game text is longer than a
// normal annotation. Used to skip the game outright rather than spend work
// stripping it.
function hasOversizedComment(gameText) {
  const comments = gameText.match(/\{[^}]*\}/g);
  if (!comments) return false;
  return comments.some((comment) => comment.length > PGN_COMMENT_MAX_CHARS);
}

function parseTags(gameText) {
  const tags = {
    Event: "Partida",
    White: "Blancas",
    Black: "Negras",
    Site: "",
    Date: "",
    ECO: "",
    Result: "",
  };
  gameText
    .split("\n")
    .filter((line) => line.startsWith("["))
    .forEach((line) => {
      const match = line.match(/^\[(\w+)\s+"(.*)"\]$/);
      if (!match) return;
      const [, key, value] = match;
      tags[key] = value;
    });
  return tags;
}

// Standard PGN semantics: a game that starts from a composed or resumed
// position (not the initial one) carries SetUp "1" together with a FEN tag.
// Replaying such a game's SAN moves from the initial position instead would
// either fail to resolve them or, worse, resolve them against the wrong
// position if the same move text happens to also be legal from move 1. A game
// whose SetUp/FEN pair is missing half or names an invalid FEN is reported as
// invalid so the caller can skip it explicitly instead of guessing.
function resolveGameStartFen(tags) {
  const hasSetUp = String(tags.SetUp || "").trim() === "1";
  const hasFen = typeof tags.FEN === "string" && tags.FEN.trim().length > 0;
  if (!hasSetUp && !hasFen) return { fen: Chess.START_FEN, valid: true };
  if (hasSetUp !== hasFen) return { fen: null, valid: false };
  const fen = tags.FEN.trim();
  if (!Chess.isValidFen(fen)) return { fen: null, valid: false };
  return { fen, valid: true };
}

function cleanTagValue(v) {
  const trimmed = String(v || "").trim();
  if (!trimmed || trimmed === "?" || trimmed === "????.??.??") return "";
  return trimmed;
}

// Returns the SAN move list, or null when the game is malformed/pathological
// (variation nesting too deep, or more plies than any realistic game) so the
// caller can skip just this game instead of crashing or hanging on it.
function tokenizeSanMoves(gameText) {
  const movesText = gameText
    .split("\n")
    .filter((line) => !line.startsWith("["))
    .join(" ");
  const stripped = removeVariations(
    movesText
      .replace(/\{[^}]*\}/g, " ")
      .replace(/;.*$/gm, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\r/g, " "),
  );
  if (stripped.overflowed) return null;
  const normalized = stripped.text
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(" ").filter(Boolean);
  const sanMoves = tokens.filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
  if (sanMoves.length > PGN_MAX_PLIES) return null;
  return sanMoves;
}

function splitGamesFromText(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n\n(?=\[Event|\[Site|\[Date|\[Round|\[White|\[Black|\[Result)/g)
    .filter((g) => g.trim().length > 0);
}

// Builds one game's parsed record, or null when it trips a parsing budget
// (oversized text, an oversized single comment, too many plies, or variation
// nesting too deep) - see PGN_GAME_MAX_CHARS and friends. A single hostile or
// corrupted game degrades to "skipped", not a frozen tab.
function buildGameFromText(gameText) {
  if (gameText.length > PGN_GAME_MAX_CHARS) return null;
  if (hasOversizedComment(gameText)) return null;
  const sanMoves = tokenizeSanMoves(gameText);
  if (!sanMoves) return null;
  return { tags: parseTags(gameText), sanMoves };
}

function sanToMove(san, chess) {
  let clean = String(san || "")
    .replace(/\s*e\.p\.$/i, "")
    .replace(/[+#!?]/g, "");
  if (clean === "O-O" || clean === "0-0") return chess.generateMoves().find((m) => m.castle === "K");
  if (clean === "O-O-O" || clean === "0-0-0") return chess.generateMoves().find((m) => m.castle === "Q");

  const match = clean.match(/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=([NBRQK]))?$/);
  if (!match) return null;

  const [, pieceLetter, fileHint, rankHint, captureFlag, destination, , promo] = match;
  const piece = pieceLetter || "P";
  const dest = Chess.squareToIndex(destination);
  const promoPiece = promo ? (chess.turn === "w" ? promo : promo.toLowerCase()) : null;

  return chess.generateMoves().find((move) => {
    if (move.to !== dest) return false;
    if (move.piece.toUpperCase() !== piece) return false;
    if (promoPiece && move.promotion !== promoPiece) return false;
    if (captureFlag && !move.capture && !move.enPassant) return false;
    if (!captureFlag && (move.capture || move.enPassant)) return false;
    if (fileHint && files[move.from % 8] !== fileHint) return false;
    if (rankHint && String(8 - Math.floor(move.from / 8)) !== rankHint) return false;
    return true;
  }) || null;
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

      const best = await getBestMoveWithEngine(before, ctx.depth, ctx.moveTimeMs);
      const playedEvalWhite = await evaluateMoveWithEngine(before, move, Math.max(1, ctx.depth - 1), ctx.moveTimeMs);

      const bestMover = toMoverScore(best.score, moverColor);
      const playedMover = toMoverScore(playedEvalWhite, moverColor);
      const scored = computeLossAgainstBest(bestMover, playedMover);

      if ((scored.diff || 0) < adaptive.threshold) return null;

      return {
        fen: before.fen(),
        meta: buildMeta(tags, moveNumber, moverColor),
        gameIdx: candidate.gameIdx,
        gameMoveUci: moveToUci(move),
        gameMoveSan: moveToSan(before, move),
        gameEvalText: evaluationToText(decodeEvaluation(playedMover)),
        bestMoveUci: moveToUci(best.move),
        bestMoveSan: moveToSan(before, best.move),
        bestEvalText: evaluationToText(decodeEvaluation(bestMover)),
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

  if (!STATE.resultView || !STATE.resultView.visible) return;

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
  setUiPhase("playing", false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();

  renderGameInfo(position);
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
  const band = INF_BAR_LABEL_BANDS[code] || INF_BAR_LABEL_BANDS.no_move;
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
  const noMove = !Number.isFinite(userMover);
  const noMoveByTimeout = noMoveReason === "timeout";
  const duelNoMoveNote = noMoveByTimeout
    ? t("evaluation.timeoutZeroPoints")
    : (noMove ? t("evaluation.noMoveZeroPoints") : "");
  const duelSummary = `${t("evaluation.classification")}: ${qualityLabel(scored.qualityCode)} | ${t("evaluation.delta")}: ${formatDelta(bestMover, userMover)} | ${t("evaluation.points")}: ${formatSigned(scored.points)}${duelNoMoveNote ? ` | ${duelNoMoveNote}` : ""}`;

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
    revealGameBtn.classList.remove("hidden");
    revealGameBtn.textContent = revealGameButtonLabel();
  }

  if (!(extra.mode !== "duel" && noMove)) {
    renderVerticalInfographic({ bestNode: null, gameNode: null, userNodes });
  }
}

function finalSessionSummaryText() {
  if (!isDuelMode()) return t("game.finalScoreSolo", { score: formatPoints(STATE.score) });
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

async function evaluateRoundMovesForPosition(base, position, moves, ratingDepth, ratingMoveTimeMs, options = {}) {
  const moverTurn = base.turn;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const minTaskMs = clamp(Number(options.minTaskMs) || ROUND_EVAL_MIN_TASK_MS, 150, ROUND_EVAL_MAX_TOTAL_MS);
  const maxTotalMs = clamp(Number(options.maxTotalMs) || ROUND_EVAL_MAX_TOTAL_MS, minTaskMs, ROUND_EVAL_MAX_TOTAL_MS);
  const totalBudgetMs = clamp(Number(options.totalBudgetMs) || maxTotalMs, minTaskMs, maxTotalMs);
  const overallStartMs = Date.now();

  const game = uciToMove(position.gameMoveUci, base);
  const needsBestSearch = !uciToMove(position.bestMoveUci, base);
  const userEvalTasks = moves.reduce((acc, payload) => {
    const hasMove = Boolean(payload && payload.move);
    return hasMove ? acc + 1 : acc;
  }, 0);
  const totalTasks = Math.max(1, (needsBestSearch ? 1 : 0) + 1 + (game ? 1 : 0) + userEvalTasks);
  let completedTasks = 0;
  let spentMs = 0;

  const emitProgress = (taskProgress = 0, stepLabel = "", payload = {}) => {
    if (!onProgress) return;
    const localProgress = clamp(Number(taskProgress) || 0, 0, 1);
    const ratio = clamp((completedTasks + localProgress) / totalTasks, 0, 1);
    const elapsedTotalMs = Math.max(0, Date.now() - overallStartMs);
    onProgress({
      ratio,
      stepLabel,
      elapsedMs: payload.elapsedMs,
      targetMs: payload.targetMs,
      elapsedTotalMs,
      totalBudgetMs,
      completedTasks,
      totalTasks,
    });
  };

  const runEngineTask = async (enabled, stepLabel, taskRunner) => {
    if (!enabled) return null;
    const remainingTasks = Math.max(1, totalTasks - completedTasks);
    const remainingBudget = Math.max(minTaskMs, totalBudgetMs - spentMs);
    const plannedTaskMs = clamp(Math.round(remainingBudget / remainingTasks), minTaskMs, ROUND_EVAL_MAX_TOTAL_MS);
    const taskStartMs = Date.now();
    const engineOptions = {
      minMoveTimeMs: Math.max(150, Math.round(plannedTaskMs * 0.65)),
      maxMoveTimeMs: plannedTaskMs,
      onProgress: (payload = {}) => {
        emitProgress(payload.ratio, stepLabel, payload);
      },
    };
    emitProgress(0, stepLabel, { elapsedMs: 0, targetMs: plannedTaskMs });
    const value = await taskRunner(engineOptions, plannedTaskMs);
    const elapsedMs = Math.max(1, Date.now() - taskStartMs);
    spentMs += elapsedMs;
    completedTasks += 1;
    emitProgress(0, `${stepLabel} listo`, { elapsedMs, targetMs: plannedTaskMs });
    return value;
  };

  const bestByTag = uciToMove(position.bestMoveUci, base);
  const searchedBest = await runEngineTask(
    !bestByTag,
    "best_move_search",
    (engineOptions, plannedTaskMs) => getBestMoveWithEngine(base, ratingDepth, plannedTaskMs, engineOptions),
  );
  const best = bestByTag || searchedBest?.move || null;
  const bestEvalSource = best
    ? await runEngineTask(
      true,
      "best_move_eval",
      (engineOptions, plannedTaskMs) => evaluateMoveWithEngine(base, best, Math.max(1, ratingDepth - 1), plannedTaskMs, engineOptions),
    )
    : NaN;
  const gameEvalWhite = game
    ? await runEngineTask(
      true,
      "game_move_eval",
      (engineOptions, plannedTaskMs) => evaluateMoveWithEngine(base, game, Math.max(1, ratingDepth - 1), plannedTaskMs, engineOptions),
    )
    : NaN;
  const bestMover = toMoverScore(bestEvalSource, moverTurn);
  const gameMover = toMoverScore(gameEvalWhite, moverTurn);
  const hitThreshold = Number.isFinite(position.thresholdUsed) ? position.thresholdUsed : 120;

  const evaluatedMoves = [];
  for (let idx = 0; idx < moves.length; idx += 1) {
    const payload = moves[idx];
    const candidateMove = payload && payload.move ? payload.move : null;
    const noMoveReason = candidateMove ? "" : (payload?.noMoveReason || "no_move");
    const userEvalWhite = candidateMove
      ? await runEngineTask(
        true,
        `move_eval_${idx + 1}`,
        (engineOptions, plannedTaskMs) => evaluateMoveWithEngine(base, candidateMove, Math.max(1, ratingDepth - 1), plannedTaskMs, engineOptions),
      )
      : NaN;
    const userMover = toMoverScore(userEvalWhite, moverTurn);
    const isExactBest = Boolean(candidateMove && best && moveToUci(candidateMove) === moveToUci(best));
    const scored = scoreMoveAgainstBest(bestMover, userMover, STATE.scoringSystem, { exactBest: isExactBest });
    const hit = Boolean(candidateMove && Number.isFinite(scored.diff) && scored.diff <= hitThreshold);

    evaluatedMoves.push({
      move: candidateMove,
      noMoveReason,
      userMover,
      scored,
      hit,
      userSan: candidateMove ? moveToSan(base, candidateMove) : "",
      userEvalText: evaluationToText(decodeEvaluation(userMover)),
    });
  }
  emitProgress(1, "evaluation_complete", { elapsedMs: Date.now() - overallStartMs, targetMs: totalBudgetMs });

  return {
    best,
    game,
    bestMover,
    gameMover,
    bestSan: best ? moveToSan(base, best) : position.bestMoveSan || "-",
    gameSan: game ? moveToSan(base, game) : position.gameMoveSan || "-",
    bestEvalText: evaluationToText(decodeEvaluation(bestMover)),
    gameEvalText: Number.isFinite(gameMover) ? evaluationToText(decodeEvaluation(gameMover)) : position.gameEvalText || t("common.notAvailable"),
    hitThreshold,
    evaluatedMoves,
  };
}

async function resolveRound(move, options = {}) {
  if (STATE.roundSubmitted || STATE.isResolvingRound) return;
  const sessionToken = STATE.sessionToken;
  stopRoundTimer();
  STATE.roundSubmitted = true;
  STATE.isResolvingRound = true;
  const duelFirstTurn = isDuelMode() && STATE.duel.currentPlayer === 0;
  try {
    const { ratingDepth, ratingMoveTimeMs, position, base, noMove, noMoveReason } =
      prepareRoundResolutionContext(move, options, duelFirstTurn);

    if (duelFirstTurn) {
      handleDuelFirstTurnHandoff(base, position, move, noMoveReason);
      return;
    }

    showEvaluatingMoveOnBoard(move, noMove, noMoveReason);

    const movesToEvaluate = buildMovesToEvaluate(move, noMoveReason);

    const { roundPlan, evaluationVisibleStartedAt } = beginRoundEvaluationOverlay(base, position, ratingMoveTimeMs);

    const evaluation = await evaluateRoundMovesForPosition(
      base,
      position,
      movesToEvaluate,
      ratingDepth,
      ratingMoveTimeMs,
      {
        totalBudgetMs: roundPlan.totalBudgetMs,
        maxTotalMs: ROUND_EVAL_MAX_TOTAL_MS,
        minTaskMs: ROUND_EVAL_MIN_TASK_MS,
        onProgress: (payload = {}) => {
          const ratio = clamp(Number(payload.ratio) || 0, 0, 1);
          const elapsedTotalMs = Math.max(0, Number(payload.elapsedTotalMs) || 0);
          const pct = Math.round(ratio * 100);
          const progressLabel = t("overlay.progressLabel", {
            pct,
            elapsed: (elapsedTotalMs / 1000).toFixed(1),
            total: (roundPlan.totalBudgetMs / 1000).toFixed(1),
          });
          setPositionSearchProgress(ratio, progressLabel);
        },
      },
    );

    const baseResult = await settleRoundEvaluationVisibility(sessionToken, evaluation, evaluationVisibleStartedAt);
    if (!baseResult) return;

    if (!isDuelMode()) {
      renderSoloRoundOutcome(move, noMove, noMoveReason, base, position, evaluation, baseResult);
      return;
    }

    renderDuelRoundOutcome(base, position, evaluation, baseResult);
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
    startRoundTimer();
  } finally {
    STATE.isResolvingRound = false;
  }
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
  const { depth: ratingDepth, moveTimeMs: ratingMoveTimeMs } = getRatingConfig();
  const position = STATE.positions[STATE.index];
  const base = new Chess(position.fen);
  const noMove = !move;
  const noMoveReason = noMove ? (options.noMoveReason || "no_move") : "";
  const playerIdx = STATE.duel.currentPlayer;
  const playerName = duelPlayerName(playerIdx);

  STATE.userMove = move || null;
  STATE.selection = null;
  STATE.legalMoves = [];
  skipBtn.disabled = true;
  setUiPhase(duelFirstTurn ? "handoff_wait_eval" : "playing", true);

  return { ratingDepth, ratingMoveTimeMs, position, base, noMove, noMoveReason };
}

// Duel mode, player 1's turn: stash their pending move without evaluating it
// yet, and hand the board off to player 2 to play their reply.
function handleDuelFirstTurnHandoff(base, position, move, noMoveReason) {
  STATE.duel.roundResults[0] = {
    pendingMove: move ? { ...move } : null,
    noMoveReason,
    userMove: snapshotMove(move),
  };
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
  }
}

// Builds the list of moves the engine needs to score for this round: one
// move in solo mode, or both players' moves in duel mode.
function buildMovesToEvaluate(move, noMoveReason) {
  const movesToEvaluate = [];
  if (!isDuelMode()) {
    movesToEvaluate.push({ move, noMoveReason });
  } else {
    const p1Pending = STATE.duel.roundResults[0];
    const p1Move = p1Pending && p1Pending.pendingMove ? { ...p1Pending.pendingMove } : null;
    const p1NoMoveReason = p1Move ? "" : (p1Pending?.noMoveReason || "no_move");
    movesToEvaluate.push({ move: p1Move, noMoveReason: p1NoMoveReason });
    movesToEvaluate.push({ move, noMoveReason });
  }
  return movesToEvaluate;
}

// Works out the search-difficulty plan for this round and shows the
// "searching" overlay with its progress bar before the engine call starts.
function beginRoundEvaluationOverlay(base, position, ratingMoveTimeMs) {
  const evaluationTitle = isDuelMode()
    ? t("overlay.evaluatingBoth")
    : t("overlay.evaluatingYours");
  const roundPlan = getRoundEvaluationPlan(base, position, ratingMoveTimeMs);
  const budgetLabel = `${(roundPlan.totalBudgetMs / 1000).toFixed(1)}s max`;
  showPositionSearchOverlay(
    evaluationTitle,
    t("overlay.difficultyBudget", { label: t(`difficulty.${roundPlan.label}`), budget: budgetLabel }),
    {
      showProgress: true,
      progressRatio: 0,
      progressLabel: t("overlay.progressLabel", {
        pct: 0,
        elapsed: "0.0",
        total: (roundPlan.totalBudgetMs / 1000).toFixed(1),
      }),
    },
  );
  startRoundThinkingMessages(roundPlan.level);
  const evaluationVisibleStartedAt = Date.now();
  return { roundPlan, evaluationVisibleStartedAt };
}

// After the engine call resolves: bail out silently if a newer session has
// since started, otherwise wait out the minimum "visible thinking" time,
// compute the fallback base result, and hide the search overlay.
// Returns null when the caller should stop (stale session work).
async function settleRoundEvaluationVisibility(sessionToken, evaluation, evaluationVisibleStartedAt) {
  if (!isCurrentSessionWork(sessionToken)) return null;
  const evaluationVisibleElapsedMs = Date.now() - evaluationVisibleStartedAt;
  if (evaluationVisibleElapsedMs < MIN_ROUND_EVAL_VISIBLE_MS) {
    await sleepMs(MIN_ROUND_EVAL_VISIBLE_MS - evaluationVisibleElapsedMs);
  }
  if (!isCurrentSessionWork(sessionToken)) return null;
  const baseResult = evaluation.evaluatedMoves[0] || {
    move: null,
    noMoveReason: "no_move",
    userMover: NaN,
    scored: scoreMoveAgainstBest(evaluation.bestMover, NaN, STATE.scoringSystem),
    hit: false,
    userSan: "",
    userEvalText: t("common.notAvailable"),
  };

  hidePositionSearchOverlay();
  setThinkingMode(false);

  return baseResult;
}

// Solo mode: renders the result board/feedback table, updates the score and
// history, and leaves the UI ready for the next position.
function renderSoloRoundOutcome(move, noMove, noMoveReason, base, position, evaluation, baseResult) {
  STATE.board = new Chess(position.fen);
  setBoardPerspective(base.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.revealed = { best: null, game: null, user: move || null, userAlt: null };
  captureResultSnapshot(position.fen);
  renderBoard();
  renderRoundFeedbackTable(
    evaluation.bestSan,
    evaluation.bestEvalText,
    evaluation.gameSan,
    evaluation.gameEvalText,
    baseResult.userSan,
    baseResult.userEvalText,
    evaluation.bestMover,
    evaluation.gameMover,
    baseResult.userMover,
    baseResult.scored,
    baseResult.noMoveReason,
    { mode: "solo", hitThreshold: evaluation.hitThreshold },
  );
  STATE.resultView.context = {
    kind: "round_solo",
    bestSan: evaluation.bestSan,
    gameSan: evaluation.gameSan,
    bestMover: evaluation.bestMover,
    gameMover: evaluation.gameMover,
    userMover: baseResult.userMover,
    scored: baseResult.scored,
    noMoveReason: baseResult.noMoveReason,
    userSan: baseResult.userSan || "",
    userMove: snapshotMove(move),
    hitThreshold: evaluation.hitThreshold,
  };
  const soloRoundSummary = noMove
    ? (noMoveReason === "timeout" ? t("evaluation.timeoutZeroPts") : t("evaluation.noMoveMadeZeroPts"))
    : t("evaluation.wonPoints", { points: formatSigned(baseResult.scored.points) });
  showResultOverlay(t("game.result.yourMove"), soloRoundSummary, baseResult.scored?.qualityCode);
  setUiPhase("result", true);
  STATE.score = Math.round((STATE.score + baseResult.scored.points) * 100) / 100;
  STATE.sessionPlayed += 1;
  if (baseResult.hit) STATE.sessionHits += 1;
  pushHistoryEntry({
    round: STATE.index + 1,
    mode: "solo",
    fen: position.fen,
    meta: position.meta,
    bestSan: evaluation.bestSan,
    gameSan: evaluation.gameSan,
    userSan: baseResult.userSan || "",
    bestMove: snapshotMove(evaluation.best),
    gameMove: snapshotMove(evaluation.game),
    userMove: snapshotMove(move),
  });
  nextBtn.textContent = t("buttons.nextPosition");
  nextBtn.disabled = false;
  skipBtn.disabled = true;
  if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  setScoringInfoVisible(true);
}

// Duel mode: builds both players' results, updates duel scores/hits, renders
// the comparison feedback table, and leaves the UI ready for the next position.
function renderDuelRoundOutcome(base, position, evaluation, baseResult) {
  const secondResult = evaluation.evaluatedMoves[1] || baseResult;
  const p1 = duelPlayerName(0);
  const p2 = duelPlayerName(1);
  const r1 = {
    points: baseResult.scored.points,
    diff: baseResult.scored.diff,
    qualityCode: baseResult.scored.qualityCode,
    bestSan: evaluation.bestSan,
    userSan: baseResult.userSan,
    userMove: snapshotMove(baseResult.move),
    hit: baseResult.hit,
  };
  const r2 = {
    points: secondResult.scored.points,
    diff: secondResult.scored.diff,
    qualityCode: secondResult.scored.qualityCode,
    bestSan: evaluation.bestSan,
    userSan: secondResult.userSan,
    userMove: snapshotMove(secondResult.move),
    hit: secondResult.hit,
  };
  STATE.duel.roundResults = [r1, r2];
  STATE.duel.scores[0] = Math.round((STATE.duel.scores[0] + (r1.points || 0)) * 100) / 100;
  STATE.duel.scores[1] = Math.round((STATE.duel.scores[1] + (r2.points || 0)) * 100) / 100;
  if (r1.hit) STATE.duel.hits[0] += 1;
  if (r2.hit) STATE.duel.hits[1] += 1;

  STATE.board = new Chess(position.fen);
  setBoardPerspective(base.turn);
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.revealed = {
    best: null,
    game: null,
    user: secondResult.move || null,
    userAlt: r1.userMove || null,
  };
  captureResultSnapshot(position.fen);
  renderBoard();
  hideHandoffOverlay();
  renderRoundFeedbackTable(
    evaluation.bestSan,
    evaluation.bestEvalText,
    evaluation.gameSan,
    evaluation.gameEvalText,
    secondResult.userSan,
    secondResult.userEvalText,
    evaluation.bestMover,
    evaluation.gameMover,
    secondResult.userMover,
    secondResult.scored,
    secondResult.noMoveReason,
    {
      mode: "duel",
      duel: {
        player1: {
          name: p1,
          san: r1.userSan,
          qualityCode: r1.qualityCode,
          points: r1.points,
          diff: r1.diff,
          hit: r1.hit,
        },
        player2: {
          name: p2,
          san: r2.userSan,
          qualityCode: r2.qualityCode,
          points: r2.points,
          diff: r2.diff,
          hit: r2.hit,
        },
      },
    },
  );
  STATE.resultView.context = {
    kind: "round_duel",
    round: STATE.index + 1,
    bestSan: evaluation.bestSan,
    gameSan: evaluation.gameSan,
    bestMover: evaluation.bestMover,
    gameMover: evaluation.gameMover,
    currentUserMover: secondResult.userMover,
    currentScored: secondResult.scored,
    currentNoMoveReason: secondResult.noMoveReason,
    player1: {
      name: p1,
      san: r1.userSan,
      qualityCode: r1.qualityCode,
      points: r1.points,
      diff: r1.diff,
      hit: r1.hit,
    },
    player2: {
      name: p2,
      san: r2.userSan,
      qualityCode: r2.qualityCode,
      points: r2.points,
      diff: r2.diff,
      hit: r2.hit,
    },
  };
  const duelBestQuality = r1.points >= r2.points ? r1.qualityCode : r2.qualityCode;
  showResultOverlay(
    t("game.result.positionSolved"),
    `R${STATE.index + 1}: ${p1} ${formatSigned(r1.points)} · ${p2} ${formatSigned(r2.points)}`,
    duelBestQuality
  );
  if (roundResultPanelEl) roundResultPanelEl.classList.remove("hidden");

  let winnerText = t("game.comparison.tie");
  if (r1.points > r2.points) winnerText = t("game.comparison.advantage", { player: p1 });
  if (r2.points > r1.points) winnerText = t("game.comparison.advantage", { player: p2 });
  roundResultEl.insertAdjacentHTML("afterbegin", `<p class="result-summary-line">${escapeHtml(winnerText)}</p>`);
  STATE.sessionPlayed += 1;
  pushHistoryEntry({
    round: STATE.index + 1,
    mode: "duel",
    fen: position.fen,
    meta: position.meta,
    bestSan: evaluation.bestSan,
    gameSan: evaluation.gameSan,
    bestMove: snapshotMove(evaluation.best),
    gameMove: snapshotMove(evaluation.game),
    player1Name: p1,
    player2Name: p2,
    player1San: r1.userSan,
    player2San: r2.userSan,
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
    if (roundResultEl) roundResultEl.classList.add("hidden");
    if (resultAnalysisBtn) resultAnalysisBtn.classList.add("hidden");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (sessionSummaryResultEl) sessionSummaryResultEl.classList.remove("hidden");
    STATE.resultView.context = { kind: "session_summary", noMorePositions: false };
    if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = sessionSummaryScoreText();
    if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = finalSessionSummaryText();
    if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");

    roundStatusEl.textContent = t("game.sessionDone");
    skipBtn.disabled = true;
    stopRoundTimer();
    setThinkingMode(false);
    updateCompetitiveStatus();
    setScoringInfoVisible(true);
    setUiPhase("result", true);

    // Show only the summary card overlay
    revealResultOverlay();
    if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
    updateRoundTimerUi(0);
    renderBoardArrows();
    return;
  }

  if (STATE.index >= STATE.positions.length - 1) {
    const ctx = STATE.analysisContext;
    if (!ctx) {
      if (roundResultEl) roundResultEl.classList.add("hidden");
      if (resultAnalysisBtn) resultAnalysisBtn.classList.add("hidden");
      if (nextBtn) nextBtn.classList.add("hidden");

      if (sessionSummaryResultEl) sessionSummaryResultEl.classList.remove("hidden");
      STATE.resultView.context = { kind: "session_summary", noMorePositions: false };
      if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = sessionSummaryScoreText();
      if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = finalSessionSummaryText();
      if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");

      roundStatusEl.textContent = t("game.sessionDone");
      skipBtn.disabled = true;
      stopRoundTimer();
      setThinkingMode(false);
      setScoringInfoVisible(true);
      setUiPhase("result", true);

      // Show only the summary card overlay
      revealResultOverlay();
      if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
      updateRoundTimerUi(0);
      renderBoardArrows();
      return;
    }

    nextBtn.disabled = true;
    skipBtn.disabled = true;
    // Do not show a duplicate loading message on the top bar
    roundStatusEl.textContent = "";
    showPositionSearchOverlay(t("overlay.searchingNext"), "", { cancellable: true });
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
      if (roundResultEl) roundResultEl.classList.add("hidden");
      if (resultAnalysisBtn) resultAnalysisBtn.classList.add("hidden");
      if (nextBtn) nextBtn.classList.add("hidden");

      if (sessionSummaryResultEl) sessionSummaryResultEl.classList.remove("hidden");
      STATE.resultView.context = { kind: "session_summary", noMorePositions: true };
      if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = sessionSummaryScoreText();
      if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = `${finalSessionSummaryText()} ${t("game.noMorePositions")}`;
      if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");

      roundStatusEl.textContent = t("game.sessionDone");
      skipBtn.disabled = true;
      stopRoundTimer();
      setThinkingMode(false);
      setScoringInfoVisible(true);
      setUiPhase("result", true);

      // Show only the summary card overlay
      revealResultOverlay();
      if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
      updateRoundTimerUi(0);
      renderBoardArrows();
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

function restartToSetup() {
  beginSessionWork();
  stopRoundTimer();
  resetEngineToLocal();
  STATE.ui.setupAnalyzing = false;
  setWizardFormControlsDisabled(false);
  setThinkingMode(false);
  setScoringInfoVisible(false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();

  if (resultOverlayInnerEl) resultOverlayInnerEl.classList.remove("hidden"); // Restore normal layout exactly
  if (sessionSummaryResultEl) sessionSummaryResultEl.classList.add("hidden");
  if (summaryMenuBtn) summaryMenuBtn.classList.add("hidden");
  if (roundResultEl) roundResultEl.classList.remove("hidden");
  if (resultAnalysisBtn) resultAnalysisBtn.classList.remove("hidden");

  setUiPhase("playing", false);
  document.body.classList.remove("playing-mode");
  setupPanelEl.classList.remove("hidden");
  gameLayoutEl.classList.add("hidden");

  STATE.positions = [];
  STATE.index = 0;
  STATE.selection = null;
  STATE.legalMoves = [];
  STATE.userMove = null;
  STATE.board = null;
  STATE.roundSubmitted = false;
  STATE.isResolvingRound = false;
  STATE.revealed = { best: false, game: false, user: true, userAlt: true };
  if (revealBestBtn) revealBestBtn.classList.remove("revealed-state");
  if (revealGameBtn) revealGameBtn.classList.remove("revealed-state");
  STATE.sessionPlayed = 0;
  STATE.sessionHits = 0;
  resetDuelState();
  renderSessionProgress();
  updateScoreDisplay();
  updateCompetitiveStatus();
  if (roundResultPanelEl) roundResultPanelEl.classList.add("hidden");
  roundResultEl.innerHTML = "";
  analysisStatusEl.textContent = t("wizard.status.currentStep");
  if (playerNameDetectedEl) playerNameDetectedEl.textContent = t("players.enterUserContinue");
  resetAnalysisProgress();
  analysisProgressWrapEl.classList.add("hidden");
  skipBtn.disabled = true;
  nextBtn.disabled = true;
  resetSetupWizard({
    mode: "solo",
    statusMessage: t("wizard.status.nextSession"),
  });
  updatePgnSelectionUi();
  showLandingScreen();
  buildBoard();
  renderBoard();
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

function refreshLocalizedUi() {
  applyStaticTranslations();
  updateOnlineProviderUi();
  syncLocalizedPlayerDefaults();
  updateScoringSystemHint();
  updateResultAnalysisControls();
  updateScoreDisplay();
  updateCompetitiveStatus();
  renderSessionProgress();
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
      const from = Chess.squareToIndex(p.bestMoveUci.substring(0, 2));
      const to = Chess.squareToIndex(p.bestMoveUci.substring(2, 4));
      const prom = p.bestMoveUci.length > 4 ? p.bestMoveUci[4] : undefined;
      STATE.revealed.best = { from, to, promotion: prom };
      if (revealBestBtn) {
        revealBestBtn.textContent = t("evaluation.bestPrefix", { san: p.bestMoveSan || "-" });
        revealBestBtn.classList.add("revealed-state");
      }
    }
  } else if (type === "game") {
    if (revealGameBtn.classList.contains("revealed-state")) {
      revealGameBtn.classList.remove("revealed-state");
      revealGameBtn.textContent = revealGameButtonLabel();
      STATE.revealed.game = null;
    } else {
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
    showWizardSourceError("provider.enterLichessContinue");
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
    showWizardSourceError("provider.enterChesscomContinue");
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
  stopRoundTimer();
  setThinkingMode(false);
  setScoringInfoVisible(false);
  hideHandoffOverlay();
  hidePositionSearchOverlay();
  hideResultOverlay();
  setUiPhase("playing", false);
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
  setupPanelEl.classList.add("hidden");
  document.body.classList.add("playing-mode");
  gameLayoutEl.classList.remove("hidden");
  startRound();
}

// ---------- Events ----------

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
    showLandingScreen();
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
      if (current === 1) showWizardStepError(validation.reason);
      if (current === 2) showWizardSourceError(validation.reason);
      if (analysisStatusEl && current === 3) analysisStatusEl.textContent = validation.reason;
      focusFirstInvalidWizardControl(current, validation);
      return;
    }
    clearWizardStepError();
    clearWizardSourceError();
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

if (landingStartBtn) {
  landingStartBtn.addEventListener("click", () => {
    startFromLanding();
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
showLandingScreen();
buildBoard();
renderBoard();
refreshLocalizedUi();
registerServiceWorker();
void purgeExpiredRemotePgnCache();
