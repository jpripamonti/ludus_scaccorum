// Optional Google sign-in and cross-device sync through the user's own Drive.
// Contract: docs/ARCHITECTURE.md section 13; one-time owner setup: docs/GOOGLE_SIGNIN.md.
//
// Nothing here talks to Google until the user presses "Sign in with Google":
//   * the Google Identity Services script (https://accounts.google.com/gsi/client)
//     is injected on demand, never at page load;
//   * one OAuth *token client* popup asks for "openid email profile" (who you
//     are, for display) plus drive.appdata (one hidden file only this app can
//     see). That is a single consent step, not an ID-token + token-client pair,
//     because a second popup opened after an await is blocked by browsers. The
//     identity is read from the OpenID userinfo endpoint with that access token
//     and is used for display and to link the local profile to the account. We
//     never treat it as proof of identity: the Drive scope is what authorises
//     the data, and everything downloaded goes through Profile's strict
//     sanitizers before it touches local storage;
//   * access tokens live in memory only. The only thing persisted is a small,
//     non-secret hint under "ludus.auth.v1" ({ v, signedIn, sub, name, picture,
//     lastSyncAt }) so the account chip can be drawn after a reload. Getting a
//     token again after a reload needs an explicit click (signIn() acts as
//     "Reconnect"); there is never an automatic popup.
//
// Sync = download -> Profile.merge -> Profile.importJSON (only when the merge
// brought something new) -> upload (only when the file changed). Scope: profiles
// linked to the signed-in account (Profile.setGoogleSub). The active profile is
// linked automatically when none is, so two people sharing a device never leak
// each other's progress into the wrong Drive. Merge is a union (see
// Profile.merge), so it is last-write-merge and best effort: a deletion made on
// one device does not propagate.
//
// Status machine: signed_out | signing_in | signed_in | syncing | error. The
// account is "remembered" (user() answers, needsReconnect() is true) while the
// status is signed_out and only the hint exists.
//
// Everything is injectable for Node tests through Auth.createInstance(env):
// { config, fetch, getGoogle, document, storage, bus, profile, now, setTimeout,
//   clearTimeout, i18n, AbortController }.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Auth = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // ---------- Constants ----------

  const STORAGE_KEY = "ludus.auth.v1";
  const HINT_VERSION = 1;
  const GIS_URL = "https://accounts.google.com/gsi/client";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const SIGN_IN_SCOPE = `openid email profile ${DRIVE_SCOPE}`;
  const FILE_NAME = "ludus-progress-v1.json";
  const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
  const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
  const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

  const STATUSES = ["signed_out", "signing_in", "signed_in", "syncing", "error"];

  const AUTO_DEBOUNCE_MS = 4000;
  const MIN_AUTO_INTERVAL_MS = 45000;
  const MAX_BACKOFF_MS = 10 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 30000;
  const GIS_LOAD_TIMEOUT_MS = 15000;
  const TOKEN_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
  const REVOKE_TIMEOUT_MS = 5000;
  const TOKEN_SKEW_MS = 60 * 1000;
  const DEFAULT_TOKEN_LIFETIME_S = 3600;

  const FALLBACK_EXPORT_KIND = "ludus-progress";
  const FALLBACK_EXPORT_VERSION = 1;
  const FALLBACK_MAX_DOC_CHARS = 5 * 1024 * 1024;
  const MAX_REMOTE_FILES = 5;
  const SMALL_BODY_CHARS = 256 * 1024;

  const CLIENT_ID_RE = /^[A-Za-z0-9._-]{1,200}\.apps\.googleusercontent\.com$/;
  const SUB_RE = /^[A-Za-z0-9_.-]{1,64}$/;
  const FILE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
  const PICTURE_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com(\/[^\s"'<>\\]*)?$/i;
  const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"'.]{1,63}(\.[^\s@<>"'.]{1,63}){1,8}$/;
  // Every code Auth can hand to the UI (results, state().error). Each one has
  // an "auth.error.<code>" string below.
  const ERROR_CODES = [
    "not-configured", "not-signed-in", "reconnect-required", "cancelled", "popup-blocked",
    "scope-denied", "gis-load-failed", "auth-failed", "identity", "busy",
    "network", "timeout", "unauthorized", "forbidden", "rate-limited", "quota-full", "server",
    "not-found", "bad-request", "http-error",
    "bad-remote", "remote-newer", "too-large", "import-failed", "profile-unavailable",
    "signed-out", "unknown",
  ];

  // Statuses that keep a session alive.
  const SESSION_STATUSES = ["signed_in", "syncing", "error"];

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const noop = () => {};

  // ---------- Pure helpers ----------

  class AuthError extends Error {
    constructor(code, extra) {
      super(code);
      this.name = "AuthError";
      this.code = code;
      if (extra) Object.assign(this, extra);
    }
  }

  function toAuthError(error, fallbackCode) {
    if (error instanceof AuthError) return error;
    return new AuthError(fallbackCode || "unknown");
  }

  // Control characters, line/paragraph separators and the bidi override/isolate
  // marks are turned into spaces (names are shown in the UI as text).
  function isUnsafeCode(code) {
    return code < 0x20
      || (code >= 0x7f && code <= 0x9f)
      || code === 0x2028 || code === 0x2029
      || code === 0x200e || code === 0x200f
      || (code >= 0x202a && code <= 0x202e)
      || (code >= 0x2066 && code <= 0x2069);
  }

  function cleanText(value, max) {
    if (typeof value !== "string") return "";
    let out = "";
    for (const char of value) out += isUnsafeCode(char.codePointAt(0)) ? " " : char;
    return out.replace(/\s+/g, " ").trim().slice(0, max);
  }

  function sanitizeSub(value) {
    return typeof value === "string" && SUB_RE.test(value) ? value : "";
  }

  // Only Google's image host is accepted (it is also the only one the CSP allows).
  function sanitizePicture(value) {
    return typeof value === "string" && value.length <= 512 && PICTURE_RE.test(value) ? value : "";
  }

  // The userinfo answer -> { sub, name, email, picture } or null. Defensive on
  // every field: this is display data, never trusted for anything else.
  function sanitizeIdentity(raw) {
    if (!isObject(raw)) return null;
    const sub = sanitizeSub(raw.sub);
    if (!sub) return null;
    const emailText = cleanText(raw.email, 254);
    const email = EMAIL_RE.test(emailText) ? emailText : "";
    const name = cleanText(raw.name, 80) || cleanText(raw.given_name, 80) || email.split("@")[0] || "";
    return { sub, name, email, picture: sanitizePicture(raw.picture) };
  }

  // The persisted hint -> { sub, name, picture, lastSyncAt } or null.
  function sanitizeHint(raw) {
    if (!isObject(raw) || raw.v !== HINT_VERSION || raw.signedIn !== true) return null;
    const sub = sanitizeSub(raw.sub);
    if (!sub) return null;
    const last = Number(raw.lastSyncAt);
    return {
      sub,
      name: cleanText(raw.name, 80),
      picture: sanitizePicture(raw.picture),
      lastSyncAt: Number.isFinite(last) && last > 0 && last < 8.64e15 ? Math.floor(last) : 0,
    };
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.keys(value).sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(",")}}`;
    }
    const text = JSON.stringify(value);
    return text === undefined ? "null" : text;
  }

  // What "the same progress" means when deciding whether to import or upload:
  // profile id, account link and data, without the bookkeeping that legitimately
  // differs between two devices holding identical content (updatedAt, createdAt,
  // exportedAt, the display name). Comparing those would make two devices
  // re-upload the same content back and forth forever.
  function docSignature(doc) {
    if (!isObject(doc) || !Array.isArray(doc.profiles) || doc.profiles.length === 0) return "";
    const items = doc.profiles.filter(isObject).map((entry) => {
      const data = Object.create(null);
      if (isObject(entry.data)) {
        Object.keys(entry.data).forEach((key) => {
          if (key !== "updatedAt") data[key] = entry.data[key];
        });
      }
      return { id: String(entry.id || ""), sub: String(entry.googleSub || ""), data };
    });
    items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return stableStringify(items);
  }

  // Two devices give the same account's profile different local ids. Rewrites
  // every entry linked to `sub` so they share one id, which is what
  // Profile.merge (it matches by id) needs to fold them into a single profile.
  function normalizeLinkedIds(doc, sub, canonicalId) {
    if (!isObject(doc) || !Array.isArray(doc.profiles) || !canonicalId) return doc;
    doc.profiles.forEach((entry) => {
      if (isObject(entry) && entry.googleSub === sub) entry.id = canonicalId;
    });
    return doc;
  }

  function firstLinkedId(doc, sub) {
    if (!isObject(doc) || !Array.isArray(doc.profiles)) return "";
    const entry = doc.profiles.find((item) => isObject(item) && item.googleSub === sub && typeof item.id === "string" && item.id);
    return entry ? entry.id : "";
  }

  // multipart/related body for the Drive "create file" upload: metadata part,
  // then the media part.
  function buildMultipart(metadata, content, boundary) {
    return `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
      + `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  }

  // A boundary that does not occur in the payload (the payload is arbitrary JSON).
  function pickBoundary(content, seed) {
    const base = `ludus_${seed || "b"}`;
    let candidate = base;
    let n = 0;
    while (content.includes(candidate)) {
      n += 1;
      candidate = `${base}_${n}`;
    }
    return candidate;
  }

  function googleErrorReason(bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const error = parsed && parsed.error;
      if (isObject(error)) {
        const first = Array.isArray(error.errors) && isObject(error.errors[0]) ? error.errors[0].reason : "";
        return String(first || error.status || "");
      }
    } catch (error) {
      // Not JSON: the status code alone decides.
    }
    return "";
  }

  // HTTP status (+ Google's error reason) -> one of ERROR_CODES.
  function classifyHttpError(status, bodyText) {
    const reason = googleErrorReason(bodyText);
    if (status === 401) return "unauthorized";
    if (status === 403) {
      if (/storageQuotaExceeded/i.test(reason)) return "quota-full";
      if (/rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded|quotaExceeded|RESOURCE_EXHAUSTED/i.test(reason)) return "rate-limited";
      return "forbidden";
    }
    if (status === 404) return "not-found";
    if (status === 408) return "timeout";
    if (status === 429) return "rate-limited";
    if (status >= 500) return "server";
    if (status === 400) return "bad-request";
    return "http-error";
  }

  // "Retry-After" is seconds or an HTTP date; anything else is ignored.
  function parseRetryAfter(value, nowMs) {
    if (typeof value !== "string" || !value.trim()) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, Math.min(seconds * 1000, MAX_BACKOFF_MS));
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, Math.min(date - nowMs, MAX_BACKOFF_MS)) : 0;
  }

  // ---------- UI text ----------

  const TEXT = {
    es: {
      "auth.status.signed_out": "Sin sesión",
      "auth.status.signing_in": "Conectando con Google…",
      "auth.status.signed_in": "Sesión iniciada",
      "auth.status.syncing": "Sincronizando…",
      "auth.status.error": "Error de sincronización",
      "auth.error.not-configured": "El inicio de sesión con Google no está configurado en este sitio.",
      "auth.error.not-signed-in": "Iniciá sesión con Google para sincronizar.",
      "auth.error.reconnect-required": "Tu conexión con Google venció. Tocá «Reconectar» para seguir sincronizando.",
      "auth.error.cancelled": "Cancelaste el inicio de sesión.",
      "auth.error.popup-blocked": "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes y probá de nuevo.",
      "auth.error.scope-denied": "Para sincronizar hace falta el permiso de guardar tu progreso en tu Drive (una carpeta oculta de esta app). Volvé a intentarlo y dejá esa casilla tildada.",
      "auth.error.gis-load-failed": "No pudimos cargar el servicio de Google. Revisá tu conexión o el bloqueador de contenido.",
      "auth.error.auth-failed": "Google rechazó el inicio de sesión. Probá de nuevo.",
      "auth.error.identity": "No pudimos leer los datos de tu cuenta de Google.",
      "auth.error.busy": "Ya hay un pedido a Google en curso. Esperá un momento.",
      "auth.error.network": "No hay conexión con Google. Se reintenta más tarde.",
      "auth.error.timeout": "Google tardó demasiado en responder. Se reintenta más tarde.",
      "auth.error.unauthorized": "Google no aceptó la sesión. Reconectá tu cuenta.",
      "auth.error.forbidden": "Google negó el acceso a Drive. Reconectá y aceptá el permiso de Drive.",
      "auth.error.rate-limited": "Google pidió esperar un rato. Se reintenta más tarde.",
      "auth.error.quota-full": "Tu Google Drive está lleno, no hay lugar para guardar el progreso.",
      "auth.error.server": "Google tuvo un problema temporal. Se reintenta más tarde.",
      "auth.error.not-found": "El archivo de progreso no está en Drive. Se vuelve a crear en la próxima sincronización.",
      "auth.error.bad-request": "Google no entendió el pedido de sincronización.",
      "auth.error.http-error": "Google respondió con un error inesperado.",
      "auth.error.bad-remote": "El archivo de progreso en Drive no tiene un formato válido. No lo tocamos.",
      "auth.error.remote-newer": "El progreso en Drive viene de una versión más nueva de la app. Recargá la página para actualizar.",
      "auth.error.too-large": "El progreso es demasiado grande para sincronizarlo.",
      "auth.error.import-failed": "No pudimos guardar en este dispositivo el progreso descargado.",
      "auth.error.profile-unavailable": "Los perfiles todavía no están disponibles.",
      "auth.error.signed-out": "Se cerró la sesión mientras se sincronizaba.",
      "auth.error.unknown": "Algo salió mal al sincronizar.",
    },
    en: {
      "auth.status.signed_out": "Signed out",
      "auth.status.signing_in": "Connecting to Google…",
      "auth.status.signed_in": "Signed in",
      "auth.status.syncing": "Syncing…",
      "auth.status.error": "Sync error",
      "auth.error.not-configured": "Google sign-in is not configured on this site.",
      "auth.error.not-signed-in": "Sign in with Google to sync.",
      "auth.error.reconnect-required": "Your Google connection expired. Press “Reconnect” to keep syncing.",
      "auth.error.cancelled": "Sign-in was cancelled.",
      "auth.error.popup-blocked": "The browser blocked the Google window. Allow pop-ups and try again.",
      "auth.error.scope-denied": "Syncing needs permission to store your progress in your Drive (a hidden folder of this app). Try again and leave that box ticked.",
      "auth.error.gis-load-failed": "Could not load the Google service. Check your connection or content blocker.",
      "auth.error.auth-failed": "Google rejected the sign-in. Try again.",
      "auth.error.identity": "Could not read your Google account details.",
      "auth.error.busy": "A Google request is already in progress. Wait a moment.",
      "auth.error.network": "Cannot reach Google. Will retry later.",
      "auth.error.timeout": "Google took too long to respond. Will retry later.",
      "auth.error.unauthorized": "Google did not accept the session. Reconnect your account.",
      "auth.error.forbidden": "Google denied access to Drive. Reconnect and accept the Drive permission.",
      "auth.error.rate-limited": "Google asked us to slow down. Will retry later.",
      "auth.error.quota-full": "Your Google Drive is full, there is no room to store the progress.",
      "auth.error.server": "Google had a temporary problem. Will retry later.",
      "auth.error.not-found": "The progress file is not in Drive. It will be created again on the next sync.",
      "auth.error.bad-request": "Google did not understand the sync request.",
      "auth.error.http-error": "Google answered with an unexpected error.",
      "auth.error.bad-remote": "The progress file in Drive has an invalid format. We leave it untouched.",
      "auth.error.remote-newer": "The progress in Drive comes from a newer version of the app. Reload the page to update.",
      "auth.error.too-large": "The progress is too large to sync.",
      "auth.error.import-failed": "Could not save the downloaded progress on this device.",
      "auth.error.profile-unavailable": "Profiles are not available yet.",
      "auth.error.signed-out": "You were signed out while syncing.",
      "auth.error.unknown": "Something went wrong while syncing.",
    },
  };

  function registerText(i18n) {
    try {
      const target = i18n || (root.Ludus && root.Ludus.i18n);
      if (target && typeof target.register === "function") target.register(TEXT);
    } catch (error) {
      // Text is cosmetic: the app keeps working with raw keys.
    }
  }

  function errorKey(code) {
    return ERROR_CODES.includes(code) ? `auth.error.${code}` : "auth.error.unknown";
  }

  // ---------- Instance ----------

  function createInstance(env) {
    const options = env || {};

    // ----- environment (resolved at call time, never at load time) -----

    const getLudus = () => root.Ludus || {};
    const getConfig = () => options.config || getLudus().config || {};
    const getBus = () => options.bus || getLudus().bus || null;
    const getStorage = () => options.storage || getLudus().storage || null;
    const getProfile = () => options.profile || getLudus().Profile || null;
    const getDocument = () => options.document || root.document || null;
    const getGoogle = () => {
      try {
        return typeof options.getGoogle === "function" ? options.getGoogle() : root.google;
      } catch (error) {
        return undefined;
      }
    };
    const nowMs = () => {
      if (typeof options.now === "function") return options.now();
      const util = getLudus().util;
      return util && typeof util.now === "function" ? util.now() : Date.now();
    };
    const setT = (fn, ms) => {
      const impl = options.setTimeout || root.setTimeout;
      return typeof impl === "function" ? impl.call(root, fn, ms) : null;
    };
    const clearT = (id) => {
      const impl = options.clearTimeout || root.clearTimeout;
      if (id !== null && id !== undefined && typeof impl === "function") impl.call(root, id);
    };
    const logError = (...args) => {
      try {
        (root.console || console).error(...args);
      } catch (error) {
        // Nothing sensible left to do.
      }
    };

    function safeGet(key) {
      try {
        const storage = getStorage();
        return storage ? storage.get(key, null) : null;
      } catch (error) {
        return null;
      }
    }

    function safeSet(key, value) {
      try {
        const storage = getStorage();
        return storage ? Boolean(storage.set(key, value)) : false;
      } catch (error) {
        return false;
      }
    }

    function safeRemove(key) {
      try {
        const storage = getStorage();
        if (storage) storage.remove(key);
      } catch (error) {
        // Nothing stored, nothing to clean.
      }
    }

    const isConfigured = () => {
      const id = getConfig().googleClientId;
      return typeof id === "string" && CLIENT_ID_RE.test(id.trim());
    };
    const clientId = () => String(getConfig().googleClientId || "").trim();

    // ----- state -----

    let loaded = false;
    let status = "signed_out";
    let user = null;            // { sub, name, email, picture }; email is "" when restored from the hint
    let token = null;           // { value, expiresAt } (memory only, never persisted)
    let lastError = "";
    let lastSyncAt = 0;
    let session = 0;            // bumped by signOut(): work started before it must stop
    let silentRefreshFailed = false;
    let inflightSync = null;
    let inflightSignIn = null;
    let dirty = false;          // the profile changed while a sync was running
    let applying = false;       // true while WE write to the profile (its events are not "user changes")
    let failures = 0;
    let backoffUntil = 0;
    let lastSyncStartedAt = 0;
    let autoTimer = null;
    let offBus = null;
    let lastPublished = "";
    let boundaryCounter = 0;
    const listeners = [];

    let gisPromise = null;
    let tokenClient = null;
    let tokenClientFor = null;
    let tokenWaiter = null;

    function ensureLoaded() {
      if (loaded) return;
      loaded = true;
      if (!isConfigured()) return;
      const hint = sanitizeHint(safeGet(STORAGE_KEY));
      if (hint) {
        user = { sub: hint.sub, name: hint.name, email: "", picture: hint.picture };
        lastSyncAt = hint.lastSyncAt;
      }
    }

    const publicUser = () => (user ? { name: user.name, email: user.email, picture: user.picture, sub: user.sub } : null);
    const needsReconnectNow = () => Boolean(user) && !token;

    function snapshot() {
      return {
        status,
        user: publicUser(),
        error: lastError,
        needsReconnect: needsReconnectNow(),
        lastSyncAt,
      };
    }

    // Notifies Auth.onChange listeners and the bus once per distinct state.
    function publish() {
      const snap = snapshot();
      const key = JSON.stringify(snap);
      if (key === lastPublished) return;
      lastPublished = key;
      listeners.slice().forEach((fn) => {
        try {
          fn(snap);
        } catch (error) {
          logError("[Ludus.Auth] listener threw", error);
        }
      });
      const bus = getBus();
      if (bus && typeof bus.emit === "function") {
        try {
          bus.emit("auth:changed", snap);
        } catch (error) {
          logError("[Ludus.Auth] bus handler threw", error);
        }
      }
    }

    function setStatus(next, errorCode) {
      status = next;
      lastError = errorCode || "";
      publish();
    }

    function persistHint() {
      if (!user) return;
      safeSet(STORAGE_KEY, {
        v: HINT_VERSION,
        signedIn: true,
        sub: user.sub,
        name: user.name,
        picture: user.picture,
        lastSyncAt,
      });
    }

    const failure = (code, extra) => Object.assign({ ok: false, error: code }, extra);

    // ----- Google Identity Services -----

    function getOauth2() {
      const google = getGoogle();
      const oauth2 = google && google.accounts && google.accounts.oauth2;
      return oauth2 && typeof oauth2.initTokenClient === "function" ? oauth2 : null;
    }

    // Dedicated injector: the script is an external URL, so it must not get
    // Ludus.util.loadScript's "?v=" and is not versioned or cached by us.
    function loadGis() {
      if (getOauth2()) return Promise.resolve();
      if (gisPromise) return gisPromise;
      const attempt = new Promise((resolve, reject) => {
        const doc = getDocument();
        if (!doc || typeof doc.createElement !== "function") {
          reject(new AuthError("gis-load-failed"));
          return;
        }
        const script = doc.createElement("script");
        let timer = null;
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearT(timer);
          if (ok && getOauth2()) {
            resolve();
            return;
          }
          try {
            if (typeof script.remove === "function") script.remove();
          } catch (error) {
            // Leaving a dead script tag behind is harmless.
          }
          reject(new AuthError("gis-load-failed"));
        };
        script.src = GIS_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => finish(true);
        script.onerror = () => finish(false);
        timer = setT(() => finish(false), GIS_LOAD_TIMEOUT_MS);
        const parent = doc.head || doc.documentElement || doc.body;
        if (!parent || typeof parent.appendChild !== "function") {
          finish(false);
          return;
        }
        parent.appendChild(script);
      });
      gisPromise = attempt;
      attempt.catch(() => {
        if (gisPromise === attempt) gisPromise = null; // a later click may retry
      });
      return attempt;
    }

    // ----- OAuth token client (promise wrapper) -----

    function settleToken(waiter, grant, error) {
      if (!waiter) return;
      clearT(waiter.timer);
      if (tokenWaiter === waiter) tokenWaiter = null;
      if (error) waiter.reject(error);
      else waiter.resolve(grant);
    }

    function onTokenResponse(response) {
      const waiter = tokenWaiter;
      if (!waiter) return;
      if (!isObject(response)) {
        settleToken(waiter, null, new AuthError("auth-failed"));
        return;
      }
      if (response.error) {
        const reason = String(response.error);
        const code = reason === "access_denied" ? "cancelled" : "auth-failed";
        settleToken(waiter, null, new AuthError(code, { reason }));
        return;
      }
      const value = typeof response.access_token === "string" ? response.access_token : "";
      if (!value || value.length > 4096 || /\s/.test(value)) {
        settleToken(waiter, null, new AuthError("auth-failed"));
        return;
      }
      // Granular consent lets the user untick the Drive box: without that scope
      // there is nothing to sync, so say so instead of failing later with a 403.
      if (typeof response.scope === "string" && !response.scope.split(/\s+/).includes(DRIVE_SCOPE)) {
        settleToken(waiter, null, new AuthError("scope-denied"));
        return;
      }
      const seconds = Number(response.expires_in);
      const lifetime = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 24 * 3600) : DEFAULT_TOKEN_LIFETIME_S;
      settleToken(waiter, { value, expiresAt: nowMs() + lifetime * 1000 }, null);
    }

    function onTokenError(error) {
      const waiter = tokenWaiter;
      if (!waiter) return;
      const type = isObject(error) ? String(error.type || "") : "";
      const code = type === "popup_failed_to_open" ? "popup-blocked" : type === "popup_closed" ? "cancelled" : "auth-failed";
      settleToken(waiter, null, new AuthError(code, { reason: type }));
    }

    function getTokenClient(oauth2) {
      if (tokenClient && tokenClientFor === oauth2) return tokenClient;
      tokenClient = oauth2.initTokenClient({
        client_id: clientId(),
        scope: SIGN_IN_SCOPE,
        callback: onTokenResponse,
        error_callback: onTokenError,
      });
      tokenClientFor = oauth2;
      return tokenClient;
    }

    function requestToken(oauth2, prompt, hint) {
      return new Promise((resolve, reject) => {
        if (tokenWaiter) {
          reject(new AuthError("busy"));
          return;
        }
        const waiter = { resolve, reject, timer: null };
        try {
          const client = getTokenClient(oauth2);
          tokenWaiter = waiter;
          waiter.timer = setT(() => settleToken(waiter, null, new AuthError("timeout")), TOKEN_REQUEST_TIMEOUT_MS);
          const overrides = { prompt };
          if (hint) overrides.hint = hint;
          client.requestAccessToken(overrides);
        } catch (error) {
          settleToken(waiter, null, new AuthError("auth-failed"));
        }
      });
    }

    // Always returns a promise. When GIS is already loaded, requestAccessToken
    // runs synchronously inside the caller (the click handler), which is what
    // keeps the popup from being blocked.
    function acquireToken(prompt, hint) {
      try {
        const oauth2 = getOauth2();
        if (oauth2) return requestToken(oauth2, prompt, hint);
        return loadGis().then(() => {
          const loadedOauth2 = getOauth2();
          if (!loadedOauth2) throw new AuthError("gis-load-failed");
          return requestToken(loadedOauth2, prompt, hint);
        });
      } catch (error) {
        return Promise.reject(toAuthError(error, "auth-failed"));
      }
    }

    function tokenIsFresh() {
      return Boolean(token) && token.expiresAt - TOKEN_SKEW_MS > nowMs();
    }

    // The access token to use right now. An expired/rejected token is re-requested
    // silently ("prompt: none") at most once per session: when Google cannot do it
    // without the user, the account has to be reconnected with a click.
    async function ensureToken() {
      if (tokenIsFresh()) return token.value;
      if (!user || silentRefreshFailed) throw new AuthError("reconnect-required");
      const runId = session;
      let grant;
      try {
        grant = await acquireToken("none", user.sub);
      } catch (error) {
        silentRefreshFailed = true;
        throw new AuthError("reconnect-required");
      }
      if (runId !== session) throw new AuthError("signed-out");
      token = grant;
      return grant.value;
    }

    // ----- HTTP -----

    // One request, body fully read inside the timeout. Resolves { ok, status, text,
    // retryAfter } for any HTTP status; rejects with network / timeout / too-large.
    async function rawRequest(method, url, extra, bearer, maxChars) {
      const fetchImpl = options.fetch || root.fetch;
      if (typeof fetchImpl !== "function") throw new AuthError("network");
      const Controller = options.AbortController || root.AbortController;
      const controller = typeof Controller === "function" ? new Controller() : null;
      let timedOut = false;
      const timer = setT(() => {
        timedOut = true;
        if (controller) controller.abort();
      }, REQUEST_TIMEOUT_MS);
      try {
        const init = {
          method,
          headers: Object.assign({ Authorization: `Bearer ${bearer}` }, extra && extra.headers),
          cache: "no-store",
          credentials: "omit",
        };
        if (extra && extra.body !== undefined) init.body = extra.body;
        if (controller) init.signal = controller.signal;
        const response = await fetchImpl.call(root, url, init);
        const header = (name) => (response.headers && typeof response.headers.get === "function" ? response.headers.get(name) : null);
        const declared = Number(header("content-length"));
        if (Number.isFinite(declared) && declared > maxChars) {
          if (controller) controller.abort();
          throw new AuthError("too-large");
        }
        const text = typeof response.text === "function" ? String(await response.text()) : "";
        if (text.length > maxChars) throw new AuthError("too-large");
        return { ok: Boolean(response.ok), status: Number(response.status) || 0, text, retryAfter: header("retry-after") };
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(timedOut || (error && error.name === "AbortError") ? "timeout" : "network");
      } finally {
        clearT(timer);
      }
    }

    function httpError(res) {
      return new AuthError(classifyHttpError(res.status, res.text), {
        status: res.status,
        retryAfterMs: parseRetryAfter(res.retryAfter, nowMs()),
      });
    }

    // An authorized Drive call. A 401 drops the token and retries once with a
    // silently re-requested one.
    async function driveRequest(ctx, method, url, extra, maxChars) {
      let refreshed = false;
      for (;;) {
        const bearer = await ensureToken();
        ctx.check();
        const res = await rawRequest(method, url, extra, bearer, maxChars || SMALL_BODY_CHARS);
        ctx.check();
        if (res.status === 401 && !refreshed) {
          refreshed = true;
          token = null;
          continue;
        }
        if (!res.ok) throw httpError(res);
        return res;
      }
    }

    async function fetchIdentity(accessToken) {
      let res;
      try {
        res = await rawRequest("GET", USERINFO_URL, null, accessToken, SMALL_BODY_CHARS);
      } catch (error) {
        throw error.code === "network" || error.code === "timeout" ? error : new AuthError("identity");
      }
      if (!res.ok) throw new AuthError("identity");
      let parsed = null;
      try {
        parsed = JSON.parse(res.text);
      } catch (error) {
        parsed = null;
      }
      const identity = sanitizeIdentity(parsed);
      if (!identity) throw new AuthError("identity");
      return identity;
    }

    // ----- Profile glue -----

    const maxDocChars = () => {
      const profile = getProfile();
      const value = profile && profile.constants && profile.constants.MAX_IMPORT_CHARS;
      return Number.isFinite(value) && value > 0 ? value : FALLBACK_MAX_DOC_CHARS;
    };

    function exportKind() {
      const profile = getProfile();
      return (profile && profile.constants && profile.constants.EXPORT_KIND) || FALLBACK_EXPORT_KIND;
    }

    function exportVersion() {
      const profile = getProfile();
      const value = profile && profile.constants && profile.constants.EXPORT_VERSION;
      return Number.isInteger(value) ? value : FALLBACK_EXPORT_VERSION;
    }

    // Links the active profile to the account when nothing is linked yet, so the
    // first sign-in on any device joins the same cloud profile.
    function linkProfiles(profile, sub) {
      if (typeof profile.list !== "function" || typeof profile.setGoogleSub !== "function") return;
      try {
        const all = profile.list() || [];
        if (all.some((entry) => entry && entry.googleSub === sub)) return;
        const active = typeof profile.active === "function" ? profile.active() : null;
        if (!active || !active.id || active.googleSub) return;
        applying = true;
        profile.setGoogleSub(active.id, sub);
      } catch (error) {
        logError("[Ludus.Auth] could not link the profile", error);
      } finally {
        applying = false;
      }
    }

    // The local document restricted to profiles linked to this account, or null.
    function readLocalDoc(profile, sub) {
      let text = "";
      try {
        text = profile.exportJSON("all", { sync: true });
      } catch (error) {
        text = "";
      }
      if (typeof text !== "string" || !text) return null;
      let doc = null;
      try {
        doc = JSON.parse(text);
      } catch (error) {
        return null;
      }
      if (!isObject(doc) || !Array.isArray(doc.profiles)) return null;
      doc.profiles = doc.profiles.filter((entry) => isObject(entry) && entry.googleSub === sub);
      return doc.profiles.length ? doc : null;
    }

    // Downloaded text -> { doc } | { empty } | { error }. Only shape checks here;
    // Profile.merge / importJSON do the strict validation.
    function parseDocumentText(text) {
      let doc = null;
      try {
        doc = JSON.parse(text);
      } catch (error) {
        return { error: "bad-remote" };
      }
      if (!isObject(doc) || doc.kind !== exportKind() || !Array.isArray(doc.profiles)) return { error: "bad-remote" };
      if (Number.isInteger(doc.v) && doc.v > exportVersion()) return { error: "remote-newer" };
      if (!Number.isInteger(doc.v) || doc.v < 1) return { error: "bad-remote" };
      if (doc.profiles.length === 0) return { empty: true };
      return { doc };
    }

    // ----- Drive file -----

    async function fetchRemote(ctx) {
      const query = `name='${FILE_NAME}' and trashed=false`;
      const listUrl = `${DRIVE_FILES}?spaces=appDataFolder&q=${encodeURIComponent(query)}`
        + `&orderBy=createdTime&pageSize=${MAX_REMOTE_FILES}&fields=${encodeURIComponent("files(id,name,createdTime)")}`;
      const listRes = await driveRequest(ctx, "GET", listUrl);
      let listBody = null;
      try {
        listBody = JSON.parse(listRes.text);
      } catch (error) {
        throw new AuthError("bad-request");
      }
      const files = (isObject(listBody) && Array.isArray(listBody.files) ? listBody.files : [])
        .filter((file) => isObject(file) && typeof file.id === "string" && FILE_ID_RE.test(file.id))
        .slice(0, MAX_REMOTE_FILES);

      // The oldest file is the source of truth (every device picks the same one).
      const remote = { primaryId: files.length ? files[0].id : "", primaryDoc: null, extraDocs: [], extraIds: [] };
      const skippable = ["bad-remote", "remote-newer", "too-large", "not-found"];
      for (let i = 0; i < files.length; i += 1) {
        try {
          const res = await driveRequest(ctx, "GET", `${DRIVE_FILES}/${encodeURIComponent(files[i].id)}?alt=media`, null, maxDocChars());
          const parsed = parseDocumentText(res.text);
          if (parsed.error) throw new AuthError(parsed.error);
          if (i === 0) {
            remote.primaryDoc = parsed.doc || null;
          } else {
            remote.extraIds.push(files[i].id);
            if (parsed.doc) remote.extraDocs.push(parsed.doc);
          }
        } catch (error) {
          // A problem with the oldest file stops the sync (never overwrite what we
          // cannot read). A broken duplicate is simply left alone.
          if (i === 0 || !(error instanceof AuthError) || !skippable.includes(error.code)) throw error;
        }
      }
      return remote;
    }

    async function uploadDocument(ctx, primaryId, text) {
      if (primaryId) {
        const url = `${DRIVE_UPLOAD}/${encodeURIComponent(primaryId)}?uploadType=media&fields=id`;
        await driveRequest(ctx, "PATCH", url, { headers: { "Content-Type": "application/json" }, body: text });
        return { created: false };
      }
      boundaryCounter += 1;
      const boundary = pickBoundary(text, `${nowMs().toString(36)}_${boundaryCounter}`);
      const metadata = { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
      await driveRequest(ctx, "POST", `${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: buildMultipart(metadata, text, boundary),
      });
      return { created: true };
    }

    // ----- Sync -----

    async function performSync(runId) {
      const profile = getProfile();
      if (!profile || typeof profile.exportJSON !== "function" || typeof profile.importJSON !== "function" || typeof profile.merge !== "function") {
        throw new AuthError("profile-unavailable");
      }
      const ctx = {
        check() {
          if (runId !== session) throw new AuthError("signed-out");
        },
      };
      const sub = user.sub;
      await ensureToken();
      ctx.check();

      linkProfiles(profile, sub);
      const localDoc = readLocalDoc(profile, sub);
      const remote = await fetchRemote(ctx);

      // One shared id per account, then let Profile.merge (which sanitizes) do the folding.
      const remoteDocs = [remote.primaryDoc].concat(remote.extraDocs).filter(Boolean);
      const canonicalId = firstLinkedId(remote.primaryDoc || remoteDocs[0], sub) || firstLinkedId(localDoc, sub);
      remoteDocs.forEach((doc) => normalizeLinkedIds(doc, sub, canonicalId));
      normalizeLinkedIds(localDoc, sub, canonicalId);

      const merge = (a, b) => {
        const out = profile.merge(a, b);
        if (!isObject(out) || !Array.isArray(out.profiles)) throw new AuthError("bad-remote");
        return out;
      };
      const clean = (doc) => (doc ? merge(doc, doc) : null);
      const localClean = clean(localDoc);
      const primaryClean = clean(remote.primaryDoc);
      const remoteAll = remoteDocs.map(clean).reduce((a, b) => (a && b ? merge(a, b) : a || b), null);
      const merged = localClean && remoteAll ? merge(localClean, remoteAll) : localClean || remoteAll;

      if (!merged) return { ok: true, imported: false, uploaded: false, created: false, empty: true };

      // The upload is judged against the oldest file alone: it has to end up holding
      // everything, including what the duplicates held.
      const mergedSig = docSignature(merged);
      const importNeeded = mergedSig !== docSignature(localClean);
      const uploadNeeded = mergedSig !== docSignature(primaryClean);
      const mergedText = JSON.stringify(merged);
      if (mergedText.length > maxDocChars()) throw new AuthError("too-large");

      if (importNeeded) {
        let result = null;
        applying = true;
        try {
          result = profile.importJSON(mergedText, { mode: "merge" });
        } catch (error) {
          result = null;
        } finally {
          applying = false;
        }
        if (!result || result.ok !== true) throw new AuthError("import-failed", { detail: result && result.error ? String(result.error) : "" });
      }
      ctx.check();

      let created = false;
      if (uploadNeeded) {
        created = (await uploadDocument(ctx, remote.primaryId, mergedText)).created;
      }
      // Two devices that first-synced at the same moment leave duplicate files. The
      // oldest one now holds everything, so the extra copies can go (best effort).
      for (const id of remote.extraIds) {
        try {
          await driveRequest(ctx, "DELETE", `${DRIVE_FILES}/${encodeURIComponent(id)}`);
        } catch (error) {
          if (error instanceof AuthError && error.code === "signed-out") throw error;
        }
      }
      return { ok: true, imported: importNeeded, uploaded: uploadNeeded, created };
    }

    function markNeedsReconnect(code) {
      token = null;
      silentRefreshFailed = true;
      detachAutoSync();
      setStatus("signed_out", code);
    }

    function onSyncFailure(error) {
      const err = toAuthError(error, "unknown");
      const code = err.code;
      if (code === "signed-out") return failure(code);
      if (code === "reconnect-required" || code === "unauthorized") {
        markNeedsReconnect(code);
        return failure(code);
      }
      failures += 1;
      const wait = Math.min(MIN_AUTO_INTERVAL_MS * Math.pow(2, failures - 1), MAX_BACKOFF_MS);
      backoffUntil = nowMs() + Math.max(wait, err.retryAfterMs || 0);
      setStatus("error", code);
      const extra = {};
      if (err.status) extra.status = err.status;
      if (err.detail) extra.detail = err.detail;
      return failure(code, extra);
    }

    function onSyncSuccess(result) {
      failures = 0;
      backoffUntil = 0;
      lastSyncAt = nowMs();
      persistHint();
      setStatus("signed_in");
      return result;
    }

    // Never rejects. Concurrent callers share one run.
    function syncNow() {
      if (!isConfigured()) return Promise.resolve(failure("not-configured"));
      ensureLoaded();
      if (inflightSync) return inflightSync;
      if (!user) return Promise.resolve(failure("not-signed-in"));
      if (!token) return Promise.resolve(failure(status === "signing_in" ? "busy" : "reconnect-required"));

      const runId = session;
      lastSyncStartedAt = nowMs();
      clearAutoTimer();
      dirty = false;
      setStatus("syncing");
      const run = performSync(runId)
        .then(
          (result) => (runId === session ? onSyncSuccess(result) : failure("signed-out")),
          (error) => (runId === session ? onSyncFailure(error) : failure("signed-out")),
        )
        .then((result) => {
          if (inflightSync === run) inflightSync = null;
          if (runId === session && dirty && canSyncAuto()) scheduleAuto();
          return result;
        });
      inflightSync = run;
      return run;
    }

    // ----- Automatic sync -----

    const canSyncAuto = () => Boolean(user) && Boolean(token) && SESSION_STATUSES.includes(status);

    function clearAutoTimer() {
      if (autoTimer !== null) {
        clearT(autoTimer);
        autoTimer = null;
      }
    }

    // Debounced after the last change, never sooner than MIN_AUTO_INTERVAL_MS
    // after the previous sync started, and pushed back while failures back off.
    function scheduleAuto() {
      clearAutoTimer();
      const now = nowMs();
      const earliest = Math.max(now + AUTO_DEBOUNCE_MS, lastSyncStartedAt + MIN_AUTO_INTERVAL_MS, backoffUntil);
      autoTimer = setT(() => {
        autoTimer = null;
        if (canSyncAuto() && !inflightSync) syncNow();
        else if (inflightSync) dirty = true;
      }, Math.max(0, earliest - now));
    }

    function onProfileChanged() {
      if (applying || !canSyncAuto()) return;
      if (inflightSync) {
        dirty = true;
        return;
      }
      scheduleAuto();
    }

    function attachAutoSync() {
      if (offBus) return;
      const bus = getBus();
      if (bus && typeof bus.on === "function") offBus = bus.on("profile:changed", onProfileChanged);
    }

    function detachAutoSync() {
      clearAutoTimer();
      if (typeof offBus === "function") {
        try {
          offBus();
        } catch (error) {
          // Already detached.
        }
      }
      offBus = null;
      dirty = false;
    }

    // ----- Sign in / out -----

    async function completeSignIn(grant, runId) {
      const identity = await fetchIdentity(grant.value);
      if (runId !== session) throw new AuthError("cancelled");
      const sameAccount = Boolean(user) && user.sub === identity.sub;
      user = identity;
      token = grant;
      silentRefreshFailed = false;
      failures = 0;
      backoffUntil = 0;
      lastSyncAt = sameAccount ? lastSyncAt : 0;
      persistHint();
      attachAutoSync();
      setStatus("signed_in");
      syncNow(); // first sync right away; never rejects, so it is fine not to await it
      return { ok: true, user: publicUser() };
    }

    function signIn() {
      if (!isConfigured()) return Promise.resolve(failure("not-configured"));
      ensureLoaded();
      if (inflightSignIn) return inflightSignIn;
      if (user && token && SESSION_STATUSES.includes(status)) {
        return Promise.resolve({ ok: true, already: true, user: publicUser() });
      }
      const runId = session;
      setStatus("signing_in");
      const run = acquireToken("", user ? user.sub : "")
        .then((grant) => completeSignIn(grant, runId))
        .catch((error) => {
          const err = toAuthError(error, "auth-failed");
          if (runId !== session) return failure("cancelled");
          token = null;
          if (err.code === "cancelled") {
            setStatus("signed_out");
            return failure("cancelled");
          }
          setStatus("error", err.code);
          return failure(err.code);
        })
        .then((result) => {
          if (inflightSignIn === run) inflightSignIn = null;
          return result;
        });
      inflightSignIn = run;
      return run;
    }

    function revokeToken(value) {
      return new Promise((resolve) => {
        const timer = setT(() => resolve(false), REVOKE_TIMEOUT_MS);
        try {
          const google = getGoogle();
          const oauth2 = google && google.accounts && google.accounts.oauth2;
          if (!value || !oauth2 || typeof oauth2.revoke !== "function") {
            clearT(timer);
            resolve(false);
            return;
          }
          oauth2.revoke(value, () => {
            clearT(timer);
            resolve(true);
          });
        } catch (error) {
          clearT(timer);
          resolve(false);
        }
      });
    }

    // Clears the session (memory + hint) immediately. { revoke: true } also asks
    // Google to revoke the access token, which removes the Drive permission so
    // the next sign-in shows the consent screen again.
    function signOut(opts) {
      const revoke = Boolean(opts && opts.revoke === true);
      const previousToken = token ? token.value : "";
      session += 1;
      settleToken(tokenWaiter, null, new AuthError("cancelled"));
      detachAutoSync();
      user = null;
      token = null;
      silentRefreshFailed = false;
      lastSyncAt = 0;
      failures = 0;
      backoffUntil = 0;
      inflightSync = null;
      inflightSignIn = null;
      loaded = true;
      safeRemove(STORAGE_KEY);
      setStatus("signed_out");
      return revoke ? revokeToken(previousToken).then((revoked) => ({ ok: true, revoked })) : Promise.resolve({ ok: true });
    }

    // Optional: lets the sign-in button pre-load the Google script when the user
    // is about to press it (hover/focus), so the popup opens inside the click.
    // Nothing calls this on its own.
    function preload() {
      if (!isConfigured()) return Promise.resolve(false);
      return loadGis().then(() => true, () => false);
    }

    function onChange(fn) {
      if (typeof fn !== "function") return noop;
      listeners.push(fn);
      return function off() {
        const index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    registerText(options.i18n);

    return {
      isConfigured,
      status() {
        ensureLoaded();
        return status;
      },
      user() {
        ensureLoaded();
        return publicUser();
      },
      state() {
        ensureLoaded();
        return snapshot();
      },
      needsReconnect() {
        ensureLoaded();
        return needsReconnectNow();
      },
      lastError() {
        return lastError;
      },
      signIn,
      signOut,
      syncNow,
      onChange,
      preload,
      errorKey,
      errorMessage(code, lang) {
        const i18n = options.i18n || getLudus().i18n;
        return i18n && typeof i18n.t === "function" ? i18n.t(errorKey(code), null, lang) : errorKey(code);
      },
    };
  }

  // The shared instance follows the real environment (Ludus.config / bus /
  // storage / Profile, window.google, fetch). Loading this file has no side
  // effect besides registering its UI text: no network, no script, no storage.
  const api = createInstance({});
  api.createInstance = createInstance;
  api.registerText = registerText;
  api.constants = Object.freeze({
    STORAGE_KEY,
    GIS_URL,
    DRIVE_SCOPE,
    SIGN_IN_SCOPE,
    FILE_NAME,
    STATUSES: Object.freeze(STATUSES.slice()),
    ERROR_CODES: Object.freeze(ERROR_CODES.slice()),
    AUTO_DEBOUNCE_MS,
    MIN_AUTO_INTERVAL_MS,
    MAX_BACKOFF_MS,
    REQUEST_TIMEOUT_MS,
  });
  // Pure building blocks, exposed for tests.
  api.internals = Object.freeze({
    sanitizeIdentity,
    sanitizeHint,
    sanitizePicture,
    sanitizeSub,
    cleanText,
    stableStringify,
    docSignature,
    normalizeLinkedIds,
    firstLinkedId,
    buildMultipart,
    pickBoundary,
    classifyHttpError,
    parseRetryAfter,
    isValidClientId: (value) => typeof value === "string" && CLIENT_ID_RE.test(value.trim()),
  });
  return api;
});
