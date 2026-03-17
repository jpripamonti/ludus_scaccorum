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
const wizardSourceErrorEl = document.getElementById("wizard-source-error");
const wizardSourceCtaEl = document.getElementById("wizard-source-cta");
const wizardRetryUserBtn = document.getElementById("wizard-retry-user-btn");
const wizardSwitchPlatformBtn = document.getElementById("wizard-switch-platform-btn");
const wizardSummaryEl = document.getElementById("wizard-summary");

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
const playerATimerEl = document.getElementById("player-a-timer");
const playerBTimerEl = document.getElementById("player-b-timer");
const playerATimerValueEl = document.getElementById("player-a-timer-value");
const playerBTimerValueEl = document.getElementById("player-b-timer-value");
const playerATimerBarEl = document.getElementById("player-a-timer-bar");
const playerBTimerBarEl = document.getElementById("player-b-timer-bar");
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
const soloClockRailEl = document.getElementById("solo-clock-rail");
const soloClockValueEl = document.getElementById("solo-clock-value");
const soloClockBarEl = document.getElementById("solo-clock-bar");
const resultOverlayEl = document.getElementById("result-overlay");
const resultOverlayInnerEl = document.getElementById("result-overlay-inner");
const resultOverlayTitleEl = document.getElementById("result-overlay-title");
const resultOverlayPointsEl = document.getElementById("result-overlay-points");
const revealBestBtn = document.getElementById("reveal-best-btn");
const revealGameBtn = document.getElementById("reveal-game-btn");
const resultAnalysisBtn = document.getElementById("result-analysis-btn");
const resultAnalysisResetBtn = document.getElementById("result-analysis-reset-btn");
const boardArrowsEl = document.getElementById("board-arrows");
const roundStatusEl = document.getElementById("round-status");
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
const playerTimerEls = [playerATimerEl, playerBTimerEl];
const playerTimerValueEls = [playerATimerValueEl, playerBTimerValueEl];
const playerTimerBarEls = [playerATimerBarEl, playerBTimerBarEl];
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
const ROUND_EVAL_MAX_TOTAL_MS = 7000;
const ROUND_EVAL_MIN_TOTAL_MS = 2200;
const ROUND_EVAL_MIN_TASK_MS = 350;
const ROUND_THINKING_MESSAGE_INTERVAL_MS = 1700;
const CLOCK_TICK_MS = 100;
const LANGUAGE_STORAGE_KEY = "ludus.language";
const SETUP_STORAGE_KEY = "ludus.setup.v1";
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
    "buttons.backToMenu": "Volver al menú",
    "buttons.skipMove": "Omitir jugada (0 pts)",
    "buttons.restartMenu": "Volver al menú",
    "wizard.title": "Configuración guiada",
    "wizard.heading": "Armemos tu sesión en 3 pasos",
    "wizard.stepIndicator": "Paso {step} de {total}",
    "wizard.step1.question": "¿Cómo querés jugar?",
    "wizard.step1.ariaLabel": "Modo de juego",
    "wizard.step1.solo": "Jugar solo/a",
    "wizard.step1.duel": "Jugar contra alguien",
    "wizard.step1.player1Label": "Nombre Jugador 1",
    "wizard.step1.player2Label": "Nombre Jugador 2",
    "wizard.step2.question": "¿De dónde traemos tus partidas?",
    "wizard.step2.help": "Vamos a descargar partidas públicas del último año para encontrar posiciones.",
    "wizard.step2.howItWorks": "¿Cómo funciona?",
    "wizard.step2.howItWorksBody": "El sistema obtiene tus partidas recientes de partidas a ritmo Lento (Clásico/Rápido). Si no hay suficientes, puede usar partidas Blitz como respaldo. Se descargan hasta la cantidad necesaria para generar tus posiciones de entrenamiento.",
    "wizard.step2.platformAriaLabel": "Plataforma",
    "wizard.step2.lichess": "Lichess",
    "wizard.step2.chesscom": "Chess.com",
    "wizard.step2.usernameLabel": "Nombre de usuario",
    "wizard.step2.enterUsername": "Ingresá tu usuario para continuar.",
    "wizard.step3.question": "¿Cuántas posiciones querés jugar hoy?",
    "wizard.step3.ariaLabel": "Cantidad de posiciones",
    "wizard.step3.positions5": "5 posiciones",
    "wizard.step3.positions10": "10 posiciones",
    "wizard.step3.positions20": "20 posiciones",
    "wizard.step3.customCount": "Personalizado (1 a 200)",
    "wizard.step3.timerLabel": "Tiempo por ronda",
    "wizard.step3.timerAriaLabel": "Tiempo por ronda",
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
    "compat.gameFormat.solo": "Modo Estudio (1 jugador)",
    "compat.gameFormat.duel": "Duelo de Caballeros (2 jugadores)",
    "players.default1": "Jugador 1",
    "players.default2": "Jugador 2",
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
    "score.totalPoints": "Puntos totales",
    "score.duelScore": "Marcador duelo",
    "scoring.system.simple.label": "Etiquetas simples (v1)",
    "scoring.system.simple.description": "Puntajes simples por calidad: Blunder -1, Mala -0.5, Dudosa 0, Interesante 0.25, Buena 0.5, Muy buena 0.75, Perfecta 1.",
    "quality.no_move": "Sin jugada",
    "quality.perfect": "Perfecta",
    "quality.very_good": "Muy buena",
    "quality.good": "Buena",
    "quality.interesting": "Interesante (!?)",
    "quality.dubious": "Dudosa",
    "quality.bad": "Mala",
    "quality.blunder": "Blunder",
    "common.notAvailable": "No disponible",
    "common.unknown": "desconocido",
    "common.searching": "Pensando...",
    "common.gameFallback": "Partida",
    "common.playersUnavailable": "Jugadores no disponibles",
    "common.white": "Blancas",
    "common.black": "Negras",
    "common.sourceError": "No pudimos obtener partidas de ese usuario. Revisá el nombre o cambiá de plataforma.",
    "common.sourceErrorWithDetail": "No pudimos obtener partidas de ese usuario. Revisá el nombre o cambiá de plataforma. ({error})",
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
    "game.roundDuel": "Posición {current}/{target} · Juega {player} ({turn}/2)",
    "game.roundReview": "Revisión · {label}",
    "game.duelCompetitive": "Duelo local · {seconds}s por turno · {system}",
    "game.duelHint": "Competitivo local: ambos jugadores reciben exactamente las mismas posiciones y tiempo.",
    "game.soloHint": "Entrenamiento individual con puntaje total acumulado.",
    "game.studyMode": "Modo estudio (solo/a)",
    "game.localDuel": "Duelo local ({a} vs {b})",
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
    "analysis.status.reused": "{prefix}Posición detectada ({count}). Se reutiliza partida por falta de alternativas.",
    "analysis.status.candidate": "{prefix}Analizando candidata {ordinal}/{total}. Detectadas: {detected}.",
    "analysis.status.ready": "{prefix}Posición detectada ({count}). Podés jugar.",
    "analysis.status.continuity": "{prefix}Posición detectada ({count}). Se priorizó continuidad de sesión.",
    "analysis.status.noFresh": "{prefix}Posición detectada ({count}). No hubo más partidas nuevas en el umbral.",
    "analysis.status.noMore": "{prefix}No quedan más posiciones en el umbral.",
    "analysis.status.prepareBase": "Preparando base online de {provider}...",
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
    "provider.noUsefulMistakes": "No se detectaron errores útiles con este usuario. Candidatas analizadas: {analyzed}/{total}.",
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
    "buttons.backToMenu": "Back to menu",
    "buttons.skipMove": "Skip move (0 pts)",
    "buttons.restartMenu": "Back to menu",
    "wizard.title": "Guided setup",
    "wizard.heading": "Let's build your session in 3 steps",
    "wizard.stepIndicator": "Step {step} of {total}",
    "wizard.step1.question": "How do you want to play?",
    "wizard.step1.ariaLabel": "Game mode",
    "wizard.step1.solo": "Play solo",
    "wizard.step1.duel": "Play against someone",
    "wizard.step1.player1Label": "Player 1 name",
    "wizard.step1.player2Label": "Player 2 name",
    "wizard.step2.question": "Where should we get your games from?",
    "wizard.step2.help": "We will download public games from the last year to find positions.",
    "wizard.step2.howItWorks": "How does it work?",
    "wizard.step2.howItWorksBody": "The system gets your recent long-time-control games (Classical/Rapid). If that is not enough, it can use Blitz as backup. It downloads up to the amount needed to generate your training positions.",
    "wizard.step2.platformAriaLabel": "Platform",
    "wizard.step2.lichess": "Lichess",
    "wizard.step2.chesscom": "Chess.com",
    "wizard.step2.usernameLabel": "Username",
    "wizard.step2.enterUsername": "Enter your username to continue.",
    "wizard.step3.question": "How many positions do you want to play today?",
    "wizard.step3.ariaLabel": "Number of positions",
    "wizard.step3.positions5": "5 positions",
    "wizard.step3.positions10": "10 positions",
    "wizard.step3.positions20": "20 positions",
    "wizard.step3.customCount": "Custom (1 to 200)",
    "wizard.step3.timerLabel": "Time per round",
    "wizard.step3.timerAriaLabel": "Time per round",
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
    "compat.gameFormat.duel": "Gentlemen's duel (2 players)",
    "players.default1": "Player 1",
    "players.default2": "Player 2",
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
    "score.totalPoints": "Total points",
    "score.duelScore": "Duel score",
    "scoring.system.simple.label": "Simple labels (v1)",
    "scoring.system.simple.description": "Simple quality scoring: Blunder -1, Bad -0.5, Dubious 0, Interesting 0.25, Good 0.5, Very good 0.75, Perfect 1.",
    "quality.no_move": "No move",
    "quality.perfect": "Perfect",
    "quality.very_good": "Very good",
    "quality.good": "Good",
    "quality.interesting": "Interesting (!?)",
    "quality.dubious": "Dubious",
    "quality.bad": "Bad",
    "quality.blunder": "Blunder",
    "common.notAvailable": "Not available",
    "common.unknown": "unknown",
    "common.searching": "Thinking...",
    "common.gameFallback": "Game",
    "common.playersUnavailable": "Players unavailable",
    "common.white": "White",
    "common.black": "Black",
    "common.sourceError": "We couldn't fetch games for that user. Check the username or switch platform.",
    "common.sourceErrorWithDetail": "We couldn't fetch games for that user. Check the username or switch platform. ({error})",
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
    "game.roundDuel": "Position {current}/{target} · {player} to move ({turn}/2)",
    "game.roundReview": "Review · {label}",
    "game.duelCompetitive": "Local duel · {seconds}s per turn · {system}",
    "game.duelHint": "Competitive local mode: both players get exactly the same positions and time.",
    "game.soloHint": "Individual training with total accumulated score.",
    "game.studyMode": "Study mode (solo)",
    "game.localDuel": "Local duel ({a} vs {b})",
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
    "analysis.status.reused": "{prefix}Position found ({count}). Reusing a game due to lack of alternatives.",
    "analysis.status.candidate": "{prefix}Analyzing candidate {ordinal}/{total}. Found: {detected}.",
    "analysis.status.ready": "{prefix}Position found ({count}). You can play now.",
    "analysis.status.continuity": "{prefix}Position found ({count}). Session continuity was prioritized.",
    "analysis.status.noFresh": "{prefix}Position found ({count}). There were no more fresh games above the threshold.",
    "analysis.status.noMore": "{prefix}There are no more positions above the threshold.",
    "analysis.status.prepareBase": "Preparing online base from {provider}...",
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
    "provider.noUsefulMistakes": "No useful mistakes were detected for this user. Candidates analyzed: {analyzed}/{total}.",
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
  userMove: null,
  score: 0,
  engine: { mode: "local", worker: null, ready: false, evalCache: new Map() },
  boardPerspective: "w",
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
  language: INITIAL_LANGUAGE,
  scoringSystem: DEFAULT_SCORING_SYSTEM,
  sourceMode: "lichess",
  remotePgnSources: [],
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
    this.halfmove = Number(parts[4]);
    this.fullmove = Number(parts[5]);
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

    if ((color === "w" && rights.includes("K")) || (color === "b" && rights.includes("k"))) {
      if (!this.board[rank * 8 + 5] && !this.board[rank * 8 + 6]
        && !this.isSquareAttacked(rank * 8 + 5, color) && !this.isSquareAttacked(rank * 8 + 6, color)) {
        moves.push({ from: index, to: rank * 8 + 6, piece: color === "w" ? "K" : "k", castle: "K" });
      }
    }

    if ((color === "w" && rights.includes("Q")) || (color === "b" && rights.includes("q"))) {
      if (!this.board[rank * 8 + 3] && !this.board[rank * 8 + 2] && !this.board[rank * 8 + 1]
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

function hasAnyPgnSource(requireDownloadedRemote = false) {
  if (!requireDownloadedRemote) {
    return getConfiguredRemoteUsername().length > 0;
  }
  const remote = STATE.remotePgnSources[0];
  if (!remote) return false;
  return getRemoteProvider(remote) === STATE.sourceMode;
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
  if (handoffOverlayTitleEl) handoffOverlayTitleEl.textContent = STATE.ui.handoffState.title;
  if (handoffOverlaySubtitleEl) handoffOverlaySubtitleEl.textContent = STATE.ui.handoffState.subtitle;
  handoffOverlayEl.classList.remove("hidden");
}

function hideHandoffOverlay() {
  if (!handoffOverlayEl) return;
  STATE.ui.handoffState = null;
  handoffOverlayEl.classList.add("hidden");
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

function showResultOverlay(title, pointsText) {
  if (!resultOverlayEl) return;
  if (resultOverlayTitleEl) resultOverlayTitleEl.textContent = title || t("result.title");
  if (resultOverlayPointsEl) resultOverlayPointsEl.textContent = pointsText || "";
  STATE.resultView.visible = true;
  STATE.resultView.analysisMode = false;
  document.body.classList.add("result-visible");
  resultOverlayEl.classList.remove("hidden");
  updateResultAnalysisControls();
  renderBoardArrows();
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
    showResultOverlay(t("game.result.yourMove"), summary);
    return;
  }

  if (context.kind === "round_duel") {
    renderRoundFeedbackTable(
      context.bestSan,
      evaluationToText(decodeEvaluation(context.bestMover)),
      context.gameSan,
      Number.isFinite(context.gameMover) ? evaluationToText(decodeEvaluation(context.gameMover)) : t("common.notAvailable"),
      context.player2.userSan || "",
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
    if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = `${formatPoints(STATE.score)} pts`;
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

function soloProgressText() {
  return `${t("labels.positionsEvaluatedTitle")}: ${Math.max(0, STATE.sessionPlayed)} / ${soloSessionTarget()}`;
}

function updatePlayerPanels() {
  const activeIdx = currentUiPlayerIndex();
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

  if (playerAScoreValueEl) playerAScoreValueEl.textContent = soloScoreText();
  if (soloProgressLineEl) soloProgressLineEl.textContent = soloProgressText();

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
    chipEl.classList.toggle("is-selected", chipSeconds === seconds);
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

function updateRoundTimerUi(remainingMs = STATE.timer.deadlineMs - Date.now()) {
  const duration = Math.max(1, STATE.timer.durationMs || Math.round(STATE.turnTimeSeconds * 1000));
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = clamp(safeRemaining / duration, 0, 1);

  const activePlayer = currentUiPlayerIndex();
  playerTimerEls.forEach((timerEl, idx) => {
    const valueEl = playerTimerValueEls[idx];
    const barEl = playerTimerBarEls[idx];
    if (!timerEl || !valueEl || !barEl) return;

    const isActiveTimer = isDuelMode() ? idx === activePlayer : idx === 0;
    const displayRatio = isActiveTimer ? ratio : 1;
    const displayTime = isActiveTimer ? safeRemaining : duration;
    valueEl.textContent = formatClock(displayTime);
    barEl.style.width = `${Math.round(displayRatio * 100)}%`;
    timerEl.classList.remove("is-passive");
    timerEl.classList.remove("urgency-mid", "urgency-high");
    if (isActiveTimer) {
      if (ratio <= 0.2) {
        timerEl.classList.add("urgency-high");
      } else if (ratio <= 0.45) {
        timerEl.classList.add("urgency-mid");
      }
    }
  });

  if (!isDuelMode()) {
    const timerEl = playerTimerEls[1];
    const valueEl = playerTimerValueEls[1];
    const barEl = playerTimerBarEls[1];
    if (timerEl && valueEl && barEl) {
      valueEl.textContent = formatClock(duration);
      barEl.style.width = "100%";
      timerEl.classList.remove("urgency-mid", "urgency-high");
      timerEl.classList.add("is-passive");
    }
  }

  if (soloClockRailEl && soloClockValueEl && soloClockBarEl) {
    const showSoloClock = !isDuelMode()
      && document.body.classList.contains("playing-mode")
      && !STATE.resultView.visible;
    soloClockRailEl.classList.toggle("hidden", !showSoloClock);
    if (showSoloClock) {
      soloClockValueEl.textContent = formatClock(safeRemaining);
      soloClockBarEl.style.height = `${Math.round(ratio * 100)}%`;
      soloClockRailEl.classList.remove("urgency-mid", "urgency-high");
      if (ratio <= 0.2) {
        soloClockRailEl.classList.add("urgency-high");
      } else if (ratio <= 0.45) {
        soloClockRailEl.classList.add("urgency-mid");
      }
    }
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

function renderWizardSummary() {
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

  if (wizardModeSoloBtn) wizardModeSoloBtn.classList.toggle("is-selected", config.mode === "solo");
  if (wizardModeDuelBtn) wizardModeDuelBtn.classList.toggle("is-selected", config.mode === "duel");
  if (duelConfigEl) duelConfigEl.classList.toggle("hidden", config.mode !== "duel");

  if (wizardProviderLichessBtn) wizardProviderLichessBtn.classList.toggle("is-selected", config.platform === "lichess");
  if (wizardProviderChessComBtn) wizardProviderChessComBtn.classList.toggle("is-selected", config.platform === "chesscom");

  wizardSizeChipEls.forEach((chipEl) => {
    const chipSize = Number(chipEl.getAttribute("data-size")) || 0;
    chipEl.classList.toggle("is-selected", chipSize === config.sessionSize);
  });
  updateWizardTimerChipSelection(config.turnTimeSeconds);

  if (wizardPrevBtn) wizardPrevBtn.classList.toggle("hidden", step <= 1);
  if (wizardNextBtn) wizardNextBtn.classList.toggle("hidden", step >= 3);
  if (analyzeBtn) analyzeBtn.classList.toggle("hidden", step !== 3);

  if (step !== 2) clearWizardSourceError();
  if (step === 3) renderWizardSummary();

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
  clearWizardSourceError();
  syncWizardToLegacyInputs();
  if (analysisStatusEl && statusMessage) analysisStatusEl.textContent = statusMessage;
  goToWizardStep(1);
}

function sendWizardBackToSourceStep(key = "common.sourceError", params = {}) {
  showWizardSourceError(key, params);
  STATE.ui.setupAnalyzing = false;
  if (analyzeBtn) analyzeBtn.disabled = false;
  goToWizardStep(2);
  if (onlineUserInputEl) onlineUserInputEl.focus();
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
  if (move.castle === "K") return "O-O";
  if (move.castle === "Q") return "O-O-O";
  const piece = move.piece.toUpperCase();
  const destination = Chess.indexToSquare(move.to);
  const capture = move.capture || move.enPassant ? "x" : "";
  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  if (piece === "P") {
    const file = files[move.from % 8];
    return `${capture ? file : ""}${capture}${destination}${promo}`;
  }
  return `${piece}${capture}${destination}${promo}`;
}

function toMoverScore(whiteScore, moverTurn) {
  return moverTurn === "w" ? whiteScore : -whiteScore;
}

function decodeEvaluation(moverScore) {
  if (!Number.isFinite(moverScore)) return null;
  const abs = Math.abs(moverScore);
  if (abs >= 90000) {
    const mateDistance = Math.max(1, Math.round((100000 - abs) / 1000));
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
  if (abs >= 90000) {
    const mateDistance = Math.max(1, Math.round((100000 - abs) / 1000));
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

function cacheGet(key) {
  return STATE.engine.evalCache.get(key);
}

function cacheSet(key, value) {
  if (STATE.engine.evalCache.size > 25000) {
    STATE.engine.evalCache.clear();
  }
  STATE.engine.evalCache.set(key, value);
}

async function waitForWorkerReady(worker, timeoutMs = 7000) {
  return new Promise((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      worker.removeEventListener("message", onMessage);
      resolve(false);
    }, timeoutMs);

    const onMessage = (event) => {
      const line = typeof event.data === "string" ? event.data : "";
      if (line === "readyok") {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve(true);
      }
      if (line.startsWith("engine-error")) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve(false);
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage("uci");
    worker.postMessage("isready");
  });
}

async function setupStockfish() {
  resetEngineToLocal();
  try {
    const response = await fetch("vendor/stockfish-18-lite-single.js", { method: "HEAD" });
    if (!response.ok) return;
    const worker = new Worker("vendor/stockfish-18-lite-single.js");
    worker.onerror = () => resetEngineToLocal();
    const ready = await waitForWorkerReady(worker, 7000);
    if (!ready) {
      try {
        worker.terminate();
      } catch (error) {
        // ignore
      }
      return;
    }
    STATE.engine = { mode: "stockfish", worker, ready: true, evalCache: new Map() };
  } catch (error) {
    resetEngineToLocal();
  }
}

async function stockfishEvaluate(fen, depth, moveTimeMs, options = {}) {
  return new Promise((resolve, reject) => {
    if (!STATE.engine.worker) {
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
      if (progressInterval) clearInterval(progressInterval);
      STATE.engine.worker.removeEventListener("message", handler);
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
          lastScore = mate > 0 ? 100000 - mate * 1000 : -100000 - mate * 1000;
        }
      }
      if (line.startsWith("bestmove")) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (progressInterval) clearInterval(progressInterval);
        emitProgress(1);
        const bestMove = line.split(" ")[1];
        STATE.engine.worker.removeEventListener("message", handler);
        resolve({ bestMove, score: lastScore });
      }
    };

    STATE.engine.worker.addEventListener("message", handler);
    STATE.engine.worker.postMessage(`position fen ${fen}`);
    if (safeMoveTime > 0) {
      STATE.engine.worker.postMessage(`go movetime ${safeMoveTime}`);
    } else {
      STATE.engine.worker.postMessage(`go depth ${depth}`);
    }
  });
}

async function getBestMoveWithEngine(board, depth, moveTimeMs, options = {}) {
  const effectiveMoveTime = adaptiveMoveTime(moveTimeMs, board, options);
  const cacheKey = `best|${STATE.engine.mode}|${board.fen()}|d${depth}|t${effectiveMoveTime}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    if (typeof options.onProgress === "function") {
      options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, cached: true });
    }
    return { move: uciToMove(cached.bestMove, board), score: cached.score };
  }

  if (STATE.engine.mode === "stockfish") {
    try {
      const result = await stockfishEvaluate(board.fen(), depth, effectiveMoveTime, {
        onProgress: options.onProgress,
      });
      const normalized = normalizeScore(result.score, board.turn);
      cacheSet(cacheKey, { bestMove: result.bestMove, score: normalized });
      return { move: uciToMove(result.bestMove, board), score: normalized };
    } catch (error) {
      resetEngineToLocal();
    }
  }

  const local = searchBestMove(board, depth);
  if (typeof options.onProgress === "function") {
    options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, fallback: true });
  }
  cacheSet(cacheKey, { bestMove: moveToUci(local.move), score: local.score });
  return local;
}

async function evaluateMoveWithEngine(board, move, depth, moveTimeMs, options = {}) {
  const clone = board.clone();
  clone.makeMove(move);
  const effectiveMoveTime = adaptiveMoveTime(moveTimeMs, board, options);
  const cacheKey = `eval|${STATE.engine.mode}|${clone.fen()}|d${depth}|t${effectiveMoveTime}`;
  const cached = cacheGet(cacheKey);
  if (Number.isFinite(cached)) {
    if (typeof options.onProgress === "function") {
      options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, cached: true });
    }
    return cached;
  }

  if (STATE.engine.mode === "stockfish") {
    try {
      const result = await stockfishEvaluate(clone.fen(), depth, effectiveMoveTime, {
        onProgress: options.onProgress,
      });
      const normalized = normalizeScore(result.score, clone.turn);
      cacheSet(cacheKey, normalized);
      return normalized;
    } catch (error) {
      resetEngineToLocal();
    }
  }

  const localScore = evaluatePosition(clone, depth);
  if (typeof options.onProgress === "function") {
    options.onProgress({ ratio: 1, elapsedMs: 0, targetMs: effectiveMoveTime, fallback: true });
  }
  cacheSet(cacheKey, localScore);
  return localScore;
}

// ---------- PGN parsing ----------

function removeVariations(text) {
  let out = "";
  let level = 0;
  for (const ch of text) {
    if (ch === "(") level += 1;
    else if (ch === ")") level = Math.max(0, level - 1);
    else if (level === 0) out += ch;
  }
  return out;
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

function cleanTagValue(v) {
  const trimmed = String(v || "").trim();
  if (!trimmed || trimmed === "?" || trimmed === "????.??.??") return "";
  return trimmed;
}

function tokenizeSanMoves(gameText) {
  const movesText = gameText
    .split("\n")
    .filter((line) => !line.startsWith("["))
    .join(" ");
  const normalized = removeVariations(
    movesText
      .replace(/\{[^}]*\}/g, " ")
      .replace(/;.*$/gm, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\r/g, " "),
  )
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(" ").filter(Boolean);
  return tokens.filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
}

function splitGamesFromText(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n\n(?=\[Event|\[Site|\[Date|\[Round|\[White|\[Black|\[Result)/g)
    .filter((g) => g.trim().length > 0);
}

function sanToMove(san, chess) {
  let clean = san.replace(/[+#!?]/g, "");
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

  const chess = new Chess(Chess.START_FEN);
  for (let ply = 0; ply <= candidate.ply; ply += 1) {
    const san = sanMoves[ply];
    const move = sanToMove(san, chess);
    if (!move) return null;

    if (ply === candidate.ply) {
      const moverColor = chess.turn;
      if (moverColor !== candidate.playerColor) return null;

      const before = chess.clone();
      const moveNumber = Math.floor(ply / 2) + 1;
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

async function findNextMistake(ctx, extraStatusPrefix = "") {
  if (!ctx || STATE.analysisInProgress) return null;
  STATE.analysisInProgress = true;
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
    while (ctx.cursor < ctx.candidates.length) {
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

    if (ctx.repeatMistakes.length > 0) {
      const deferredRepeat = ctx.repeatMistakes.shift();
      const usedGames = ctx.usedGameIndices instanceof Set ? ctx.usedGameIndices : null;
      if (usedGames && Number.isInteger(deferredRepeat.gameIdx)) usedGames.add(deferredRepeat.gameIdx);
      ctx.detected += 1;
      updateAnalysisProgress(ctx.analyzed, ctx.total, ctx.detected, t("analysis.extra.detectedRepeated"));
      analysisStatusEl.textContent = t("analysis.status.noFresh", { prefix: extraStatusPrefix, count: ctx.detected });
      if (isNextSearch) updateNextSearchStatus(ctx, "Posición detectada (repetida)");
      return deferredRepeat;
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
    buildBoard();
  }
}

function buildBoard() {
  boardEl.innerHTML = "";
  const ranks = STATE.boardPerspective === "b" ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const orderedFiles = STATE.boardPerspective === "b" ? [...files].reverse() : files;
  const leftEdgeFile = STATE.boardPerspective === "b" ? "h" : "a";
  const bottomEdgeRank = STATE.boardPerspective === "b" ? 8 : 1;

  for (const rank of ranks) {
    for (const fileLetter of orderedFiles) {
      const fileNum = files.indexOf(fileLetter) + 1;
      const square = document.createElement("div");
      square.className = `square ${(rank + fileNum) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.square = `${fileLetter}${rank}`;
      square.addEventListener("click", () => onSquareClick(square.dataset.square));

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

      boardEl.appendChild(square);
    }
  }
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
      image.alt = piece;
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
  if (soloProgressLineEl) soloProgressLineEl.textContent = soloProgressText();
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
  if (isDuelMode()) {
    const activePlayer = duelPlayerName(STATE.duel.currentPlayer);
    const turnNumber = STATE.duel.currentPlayer + 1;
    roundStatusEl.textContent = t("game.roundDuel", { current: STATE.index + 1, target: totalTarget, player: activePlayer, turn: turnNumber });
  } else {
    roundStatusEl.textContent = t("game.roundSolo", { current: STATE.index + 1, target: totalTarget });
  }
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
  if (STATE.ui.blockBoardInput) return;
  if (!STATE.board || !STATE.positions.length) return;
  const isAnalysisMode = STATE.ui.phase === "result_analysis";
  if (!isAnalysisMode && nextBtn.disabled === false) return;
  if (!isAnalysisMode && (STATE.roundSubmitted || STATE.isResolvingRound)) return;

  const index = Chess.squareToIndex(square);
  const piece = STATE.board.pieceAt(index);

  if (STATE.selection) {
    const move = STATE.legalMoves.find((candidate) => candidate.to === index);
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
    if (!noMove) {
      userNodes.push({
        label: t("evaluation.yourMove"),
        san: userSan,
        meta: qualityLabel(scored.qualityCode),
        qualityCode: scored.qualityCode,
        diff: Number.isFinite(scored.diff) ? scored.diff : null,
        authorClass: "node-p1", // You are Player 1 (Blue)
        noMove: false
      });
    }

    roundResultEl.innerHTML = ""; // No extra summary line for solo mode, as header handles points
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

  renderVerticalInfographic({ bestNode: null, gameNode: null, userNodes });
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
  stopRoundTimer();
  STATE.roundSubmitted = true;
  STATE.isResolvingRound = true;
  const duelFirstTurn = isDuelMode() && STATE.duel.currentPlayer === 0;
  try {
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

    if (duelFirstTurn) {
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
      updateCompetitiveStatus();
      setScoringInfoVisible(false);
      return;
    }

    roundResultEl.textContent = noMoveReason === "timeout"
      ? t("overlay.timeoutEvaluating")
      : (noMove ? t("overlay.closingWithoutMove") : t("overlay.evaluatingMove"));

    if (move) {
      STATE.board.makeMove(move);
      STATE.revealed = { ...STATE.revealed, user: move };
      renderBoard();
    }

    const evaluationTitle = isDuelMode()
      ? t("overlay.evaluatingBoth")
      : t("overlay.evaluatingYours");

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

    if (!isDuelMode()) {
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
      showResultOverlay(t("game.result.yourMove"), soloRoundSummary);
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
      return;
    }

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
    showResultOverlay(
      t("game.result.positionSolved"),
      `R${STATE.index + 1}: ${p1} ${formatSigned(r1.points)} · ${p2} ${formatSigned(r2.points)}`
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
  } catch (error) {
    hidePositionSearchOverlay();
    hideHandoffOverlay();
    hideResultOverlay();
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

async function nextPosition() {
  if (STATE.ui.phase !== "result" && STATE.ui.phase !== "result_analysis") return;
  if (STATE.resultView.analysisMode) {
    applyResultSnapshotToBoard();
    STATE.resultView.analysisMode = false;
    updateResultAnalysisControls();
  }
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
    if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = `${formatPoints(STATE.score)} pts`;
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
    STATE.resultView.visible = true;
    if (resultOverlayEl) resultOverlayEl.classList.remove("hidden");
    if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
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
      if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = `${formatPoints(STATE.score)} pts`;
      if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = finalSessionSummaryText();
      if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");

      roundStatusEl.textContent = t("game.sessionDone");
      skipBtn.disabled = true;
      stopRoundTimer();
      setThinkingMode(false);
      setScoringInfoVisible(true);
      setUiPhase("result", true);

      // Show only the summary card overlay
      STATE.resultView.visible = true;
      if (resultOverlayEl) resultOverlayEl.classList.remove("hidden");
      if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
      renderBoardArrows();
      return;
    }

    nextBtn.disabled = true;
    skipBtn.disabled = true;
    // Do not show a duplicate loading message on the top bar
    roundStatusEl.textContent = "";
    showPositionSearchOverlay(t("overlay.searchingNext"));
    setUiPhase("loading_next_position", true);
    const nextMistake = await findNextMistake(ctx, "Siguiente: ");
    if (!nextMistake) {
      hidePositionSearchOverlay();
      if (roundResultEl) roundResultEl.classList.add("hidden");
      if (resultAnalysisBtn) resultAnalysisBtn.classList.add("hidden");
      if (nextBtn) nextBtn.classList.add("hidden");

      if (sessionSummaryResultEl) sessionSummaryResultEl.classList.remove("hidden");
      STATE.resultView.context = { kind: "session_summary", noMorePositions: true };
      if (summaryScoreDisplayEl) summaryScoreDisplayEl.textContent = `${formatPoints(STATE.score)} pts`;
      if (summaryDetailsTextEl) summaryDetailsTextEl.textContent = `${finalSessionSummaryText()} ${t("game.noMorePositions")}`;
      if (summaryMenuBtn) summaryMenuBtn.classList.remove("hidden");

      roundStatusEl.textContent = t("game.sessionDone");
      skipBtn.disabled = true;
      stopRoundTimer();
      setThinkingMode(false);
      setScoringInfoVisible(true);
      setUiPhase("result", true);

      // Show only the summary card overlay
      STATE.resultView.visible = true;
      if (resultOverlayEl) resultOverlayEl.classList.remove("hidden");
      if (resultOverlayInnerEl) resultOverlayInnerEl.classList.add("hidden"); // Hide normal layout
      renderBoardArrows();
      return;
    }
    showPositionSearchOverlay(t("game.positionFound"), formatPositionSearchMeta(nextMistake));
    await sleepMs(1200);
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
  stopRoundTimer();
  STATE.ui.setupAnalyzing = false;
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
  return STATE.remotePgnSources.map((entry) => ({ name: entry.name, text: entry.text }));
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
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/x-chess-pgn" },
    });
    if (!response.ok) {
      throw new Error(t("provider.lichessResponse", { status: response.status }));
    }
    const text = await response.text();
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
    STATE.remotePgnSources = [{
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
    }];

    setSourceMode("lichess");
    updatePgnSelectionUi();
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

  const loadArchiveGames = async (archiveUrl) => {
    if (monthGamesCache.has(archiveUrl)) return monthGamesCache.get(archiveUrl);
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(t("provider.chesscomReadArchiveError", { status: response.status, url: archiveUrl }));
    }
    const payload = await response.json();
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

  try {
    const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(rawUser.toLowerCase())}/games/archives`;
    const archivesResponse = await fetch(archivesUrl);
    if (!archivesResponse.ok) {
      if (archivesResponse.status === 404) {
        throw new Error(t("provider.userNotFoundOrPrivate"));
      }
      throw new Error(t("provider.chesscomResponse", { status: archivesResponse.status }));
    }
    const archivesPayload = await archivesResponse.json();
    const archives = (Array.isArray(archivesPayload?.archives) ? archivesPayload.archives : [])
      .map(parseChessComArchiveUrl)
      .filter(Boolean)
      .filter((archive) => isArchiveInLastTwelveMonths(archive.year, archive.month))
      .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

    if (archives.length === 0) {
      throw new Error(t("provider.noMonthlyArchives"));
    }

    const slowClasses = new Set(settings.preferredSlowClasses);
    let slowGames = 0;
    let blitzGames = 0;
    let bulletGames = 0;
    let totalGames = 0;
    let qualityWarning = "";

    for (const archive of archives) {
      if (totalGames >= settings.maxGames) break;
      const games = await loadArchiveGames(archive.url);
      const added = takeGamesFromArchive(games, slowClasses, settings.maxGames - totalGames);
      slowGames += added;
      totalGames += added;
    }

    if (settings.fallbackBlitz && totalGames < settings.minSlowGames && totalGames < settings.maxGames) {
      const remaining = settings.maxGames - totalGames;
      if (onlineStatusEl) {
        onlineStatusEl.textContent = t("provider.completingBlitz", { count: totalGames, preferred: preferredLabel, remaining });
      }
      await sleepMs(220);
      const blitzClass = new Set(["blitz"]);
      for (const archive of archives) {
        if (totalGames >= settings.maxGames) break;
        const games = await loadArchiveGames(archive.url);
        const added = takeGamesFromArchive(games, blitzClass, settings.maxGames - totalGames);
        blitzGames += added;
        totalGames += added;
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
      const bulletClass = new Set(["bullet"]);
      for (const archive of archives) {
        if (totalGames >= settings.maxGames) break;
        const games = await loadArchiveGames(archive.url);
        const added = takeGamesFromArchive(games, bulletClass, settings.maxGames - totalGames);
        bulletGames += added;
        totalGames += added;
      }
      if (bulletGames > 0) {
        qualityWarning = t("provider.bulletCompleted", { context: warningContext });
      }
    }

    if (totalGames <= 0 || selectedPgn.length === 0) {
      throw new Error(t("provider.noGamesForFilters"));
    }

    const safeUser = rawUser.replace(/[^a-z0-9_-]+/gi, "") || "user";
    const today = new Date().toISOString().slice(0, 10);
    STATE.remotePgnSources = [{
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
    }];

    setSourceMode("chesscom");
    updatePgnSelectionUi();
    if (onlineStatusEl) {
      if (bulletGames > 0) {
        onlineStatusEl.textContent = t("provider.readyBullet", {
          warning: `${qualityWarning} `,
          total: totalGames,
          user: rawUser,
          slow: slowGames,
          preferred: preferredLabel,
          blitz: blitzGames,
          bullet: bulletGames,
        });
      } else if (blitzGames > 0) {
        onlineStatusEl.textContent = t("provider.readyBlitz", {
          total: totalGames,
          user: rawUser,
          slow: slowGames,
          preferred: preferredLabel,
          blitz: blitzGames,
        });
      } else {
        onlineStatusEl.textContent = t("provider.readyPreferred", { total: totalGames, user: rawUser, preferred: preferredLabel });
      }
    }
    return true;
  } catch (error) {
    const message = t("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
    if (onlineStatusEl) onlineStatusEl.textContent = message;
    showWizardSourceError("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
    return false;
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

  clearWizardSourceError();
  STATE.ui.setupAnalyzing = true;
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
  const effectiveConfig = getEffectiveAnalysisConfig();
  STATE.scoringSystem = effectiveConfig.scoringSystem;
  updateCompetitiveStatus();

  try {
  if (!hasAnyPgnSource(true)) {
      analysisStatusEl.textContent = t("analysis.status.prepareBase", { provider: providerLabel(STATE.sourceMode) });
      const downloaded = STATE.sourceMode === "chesscom"
        ? await fetchChessComPgn()
        : await fetchLichessPgn();
      if (!downloaded || !hasAnyPgnSource(true)) {
        sendWizardBackToSourceStep("common.sourceError");
        return;
      }
    }

    const sources = await getActivePgnTextSources();
    const allGames = sources.flatMap(({ text }) => splitGamesFromText(text).map((gameText) => ({
      tags: parseTags(gameText),
      sanMoves: tokenizeSanMoves(gameText),
    })));

    if (allGames.length === 0) {
      sendWizardBackToSourceStep("provider.noPublicValidGames");
      return;
    }

    const playerName = inferPlayerName(allGames);
    playerNameDetectedEl.textContent = playerName || t("players.notDetected");

    if (!playerName) {
      sendWizardBackToSourceStep("provider.playerNotDetected");
      return;
    }

    const depth = INTERNAL_ANALYSIS_DEPTH;
    const moveTimeMs = effectiveConfig.moveTimeMs;
    const threshold = effectiveConfig.thresholdCp;
    const candidates = buildRandomCandidateQueue(allGames, playerName);
    const uniqueGameCount = new Set(candidates.map((c) => c.gameIdx)).size;
    if (candidates.length === 0) {
      sendWizardBackToSourceStep("provider.noAnalyzablePositions");
      return;
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

    const firstMistake = await findNextMistake(ctx, "Inicio: ");
    if (!firstMistake) {
      sendWizardBackToSourceStep("provider.noUsefulMistakes", { analyzed: ctx.analyzed, total: ctx.total });
      return;
    }

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
    analysisStatusEl.textContent = t("analysis.status.firstReady");
    setupPanelEl.classList.add("hidden");
    document.body.classList.add("playing-mode");
    gameLayoutEl.classList.remove("hidden");
    startRound();
  } catch (error) {
    const message = t("analysis.status.error", { error: error.message || t("common.unknown") });
    analysisStatusEl.textContent = message;
    analysisProgressWrapEl.classList.add("hidden");
    analysisMetricsEl.classList.add("hidden");
    sendWizardBackToSourceStep("common.sourceErrorWithDetail", { error: error.message || t("common.unknown") });
  } finally {
    STATE.ui.setupAnalyzing = false;
    updateAnalyzeButtonState();
  }
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
      if (analysisStatusEl) analysisStatusEl.textContent = validation.reason;
      if (current === 2) showWizardSourceError(validation.reason);
      return;
    }
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
    renderWizardStep();
    if (STATE.setupWizard.step === 1) {
      clearWizardSourceError();
      goToWizardStep(2);
      if (analysisStatusEl) analysisStatusEl.textContent = t("wizard.status.sourceStep");
    }
  });
}

if (wizardModeDuelBtn) {
  wizardModeDuelBtn.addEventListener("click", () => {
    STATE.setupWizard.mode = "duel";
    if (gameFormatEl) gameFormatEl.value = "duel";
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
if (restartBtn) restartBtn.addEventListener("click", () => restartToSetup());
if (handoffOverlayEl) {
  handoffOverlayEl.addEventListener("click", () => {
    revealDuelSecondTurn();
  });
}

window.addEventListener("resize", () => {
  renderBoardArrows();
});

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
void setupStockfish();
buildBoard();
renderBoard();
refreshLocalizedUi();
