// Screen "account": profiles, your data, optional Google sync, installing the app and "about".
//   Profiles     up to four local profiles as cards (avatar, name, level, positions played, active marker):
//                create (name + colour), rename, switch, delete with a typed-name confirmation. Two people
//                can share a device and pick their own profile in a Duel.
//   Your data    export (a JSON file through a Blob and a[download], dated file name), import (a drop area or
//                the file picker; a dry run shows what is in the file, then merge or replace), delete
//                everything (typed confirmation) and how much storage is used.
//   Google sync  only when Ludus.Auth.isConfigured(): sign in, status, last sync, sync now, reconnect, sign
//                out (and revoke). When it is not configured the screen says so quietly, with no dead button.
//   Install      the beforeinstallprompt event captured at load, an iOS hint, "already installed".
//   About        version, licence, Stockfish and other credits, privacy, keyboard shortcuts, source.
// Contract: docs/ARCHITECTURE.md sections 11, 13, 15 and 20; styles in css/account.css (prefix .account-).
//
//   Ludus.Screens.account.mount(el)    el = #screen-account. Idempotent and cheap: it only prepares the
//                                      container and the subscriptions; data is read in show().
//   Ludus.Screens.account.show(params) reads the profiles, the storage and the auth state and draws.
//   Ludus.Screens.account.hide()
//   Ludus.Screens.account.render()     repaints (also on language:changed, profile:changed, auth changes).
//   Ludus.Screens.account.titleKey     "account.title", the i18n key of document.title.
//
// Everything is built with Ludus.util.h (a name or a picture URL from Google is text or a validated
// googleusercontent.com https URL, never markup). A missing module (Profile, Auth, kit ...) removes the
// part that needs it and never breaks the rest. Pure helpers are exported under `helpers` for
// scripts/tests/account-ui.test.js.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.account = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const L = () => root.Ludus || {};
  const getDoc = () => {
    try {
      return root.document || null;
    } catch (error) {
      return null;
    }
  };

  function h(tag, attrs, ...children) {
    return L().util.h(tag, attrs, ...children);
  }

  function t(key, params) {
    const i18n = L().i18n;
    return i18n && typeof i18n.t === "function" ? i18n.t(key, params) : String(key);
  }

  function lang() {
    const i18n = L().i18n;
    try {
      return i18n && typeof i18n.lang === "function" && i18n.lang() === "en" ? "en" : "es";
    } catch (error) {
      return "es";
    }
  }

  function icon(name, options) {
    const ui = L().ui;
    return ui && typeof ui.icon === "function" ? ui.icon(name, options) : null;
  }

  function logError(...args) {
    if (root.console && typeof root.console.error === "function") root.console.error(...args);
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const cls = (...names) => names.filter(Boolean).join(" ");
  const REPO_URL = "https://github.com/jpripamonti/ludus_scaccorum";
  const REPO_BLOB = `${REPO_URL}/blob/main`;
  const LICENCE = "GPL-3.0-or-later";
  const STORAGE_PREFIX = "ludus.";
  const KEEP_KEYS = ["ludus.language"];
  // The cache of downloaded games lives in IndexedDB (app.js owns the name).
  const REMOTE_CACHE_DB = "ludus.remotePgnCache.v1";
  // Browsers give a page about 5 MB of localStorage (in UTF-16 units of 2 bytes per character).
  const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

  // ---------- Text ----------

  const TEXT = {
    es: {
      "account.title": "Cuenta y datos",
      "account.eyebrow": "Tu cuenta",
      "account.heading": "Cuenta",
      "account.sub": "Tus perfiles, tu progreso y, si querés, la sincronización entre dispositivos. Todo vive en este dispositivo salvo que vos decidas otra cosa.",
      "account.unavailable": "Esta parte no está disponible en este momento.",

      "account.profiles.title": "Perfiles de este dispositivo",
      "account.profiles.lead": "Dos personas pueden compartir este dispositivo: cada perfil guarda su propio progreso, nivel y cuaderno. En un Duelo, cada jugador elige su perfil.",
      "account.profiles.private": "Los perfiles ordenan el progreso de cada persona, pero no lo protegen: quien use este dispositivo puede abrir cualquier perfil y descargar sus datos.",
      "account.profiles.count": "{n} de {max} perfiles",
      "account.profiles.list": "Perfiles",
      "account.profile.active": "Activo",
      "account.profile.use": "Usar este perfil",
      "account.profile.use.aria": "Jugar como {name}",
      "account.profile.rename": "Renombrar",
      "account.profile.rename.aria": "Renombrar el perfil de {name}",
      "account.profile.delete": "Borrar",
      "account.profile.delete.aria": "Borrar el perfil de {name}",
      "account.profile.positions": "{n} posiciones jugadas",
      "account.profile.positions.one": "1 posición jugada",
      "account.profile.positions.none": "Sin posiciones jugadas todavía",
      "account.profile.add": "Agregar un perfil",
      "account.profile.add.hint": "Para otra persona, o para separar tu práctica.",
      "account.profile.full": "Llegaste al máximo de {max} perfiles. Borrá uno para crear otro.",
      "account.profile.duel": "Armar un duelo",
      "account.profile.switched": "Ahora jugás como {name}",
      "account.create.title": "Nuevo perfil",
      "account.create.name": "Nombre",
      "account.create.name.hint": "Hasta {max} letras. Se muestra en el encabezado y en los duelos.",
      "account.create.color": "Color",
      "account.create.color.aria": "Color {n}",
      "account.create.switch": "Jugar con este perfil ahora",
      "account.create.submit": "Crear perfil",
      "account.create.done": "Perfil creado: {name}",
      "account.rename.title": "Renombrar el perfil",
      "account.rename.submit": "Guardar nombre",
      "account.rename.done": "Ahora se llama {name}",
      "account.delete.title": "¿Borrar el perfil de {name}?",
      "account.delete.body": "Se borran para siempre de este dispositivo sus {positions} y sus {cards}, con su nivel y sus logros. No se puede deshacer.",
      "account.delete.positions": "{n} posiciones jugadas",
      "account.delete.positions.one": "1 posición jugada",
      "account.delete.cards": "{n} tarjetas del cuaderno",
      "account.delete.cards.one": "1 tarjeta del cuaderno",
      "account.delete.last": "Es el único perfil: después vas a empezar con uno nuevo y vacío.",
      "account.delete.export": "Descargar una copia antes",
      "account.delete.type": "Para confirmar, escribí el nombre del perfil: {name}",
      "account.delete.hint": "El botón se activa cuando el nombre coincide.",
      "account.delete.confirm": "Borrar el perfil",
      "account.delete.done": "Perfil borrado: {name}",
      "account.error.limit": "Ya hay {max} perfiles. Borrá uno para crear otro.",
      "account.error.invalid-name": "Escribí un nombre para el perfil.",
      "account.error.storage": "No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.",
      "account.error.read-only": "Estos datos vienen de una versión más nueva de la app y no se pueden modificar.",
      "account.error.generic": "No se pudo completar la acción.",

      "account.data.title": "Tus datos",
      "account.data.lead": "Tu progreso está en este dispositivo. Descargalo cuando quieras: es un archivo que podés cargar en otro dispositivo o guardar como copia de seguridad.",
      "account.storage.title": "Espacio usado",
      "account.storage.used": "Usás {used} de unos {limit} que da el navegador.",
      "account.storage.aria": "Espacio de almacenamiento usado por Ludus Scaccorum",
      "account.storage.unavailable": "El almacenamiento del navegador no está disponible (por ejemplo, en una ventana privada): el progreso no se puede guardar.",
      "account.export.title": "Descargar tu progreso",
      "account.export.hint": "El archivo lleva tus jugadas, sesiones, cuaderno y logros. De las partidas que analizaste con tus cuentas de Lichess o Chess.com guarda también los nombres de los jugadores (el tuyo y el de tu rival) y el enlace a cada partida; pensalo antes de compartirlo. No incluye tu cuenta de Google.",
      "account.export.active": "Descargar el perfil de {name}",
      "account.export.all": "Descargar todos los perfiles",
      "account.export.done": "Descargamos {file}.",
      "account.export.error": "No se pudo generar el archivo.",
      "account.import.title": "Cargar un archivo",
      "account.import.hint": "Solo archivos .json descargados desde Ludus Scaccorum. Se revisan antes de tocar nada.",
      "account.import.drop": "Soltá acá tu archivo de progreso",
      "account.import.drop.or": "o elegilo desde tu dispositivo",
      "account.import.choose": "Elegir un archivo",
      "account.import.reading": "Revisando el archivo…",
      "account.import.review": "Esto hay en {file}",
      "account.import.found.profiles": "{n} perfiles",
      "account.import.found.profiles.one": "1 perfil",
      "account.import.found.rounds": "{n} posiciones",
      "account.import.found.rounds.one": "1 posición",
      "account.import.found.sessions": "{n} sesiones",
      "account.import.found.sessions.one": "1 sesión",
      "account.import.found.cards": "{n} tarjetas del cuaderno",
      "account.import.found.cards.one": "1 tarjeta del cuaderno",
      "account.import.dropped": "{n} entradas se descartaron porque estaban dañadas o eran inválidas.",
      "account.import.dropped.one": "1 entrada se descartó porque estaba dañada o era inválida.",
      "account.import.mode": "¿Cómo querés cargarlo?",
      "account.import.merge": "Combinar con lo que ya tengo",
      "account.import.merge.hint": "Recomendado: junta las dos versiones y no se pierde nada.",
      "account.import.replace": "Reemplazar los perfiles que coincidan",
      "account.import.replace.hint": "Los perfiles del archivo pisan a los que tengan el mismo identificador.",
      "account.import.run": "Cargar el progreso",
      "account.import.cancel": "Cancelar",
      "account.import.done": "Listo: se cargaron {profiles} y {rounds}.",
      "account.import.readError": "No pudimos leer ese archivo.",
      "account.danger.title": "Borrar todo",
      "account.danger.lead": "Borra de este dispositivo todos los perfiles, el progreso, los ajustes y las partidas guardadas. La copia de Google Drive, si la hay, no se toca.",
      "account.danger.button": "Borrar todos mis datos",
      "account.danger.modal.title": "¿Borrar todos los datos?",
      "account.danger.modal.body": "Se borra para siempre, solo de este dispositivo: todos los perfiles y su progreso, los ajustes y las partidas descargadas. Si sincronizaste con Google, la copia de Drive sigue ahí y se puede quitar desde tu cuenta de Google.",
      "account.danger.type": "Para confirmar, escribí {word}",
      "account.danger.word": "BORRAR",
      "account.danger.confirm": "Borrar todo",
      "account.danger.done": "Borramos todos los datos de este dispositivo.",

      "account.sync.title": "Sincronizar con Google",
      "account.sync.lead": "Llevá tu progreso a otros dispositivos a través de tu propio Google Drive. No hay ningún servidor nuestro en el medio.",
      "account.sync.signin": "Iniciar sesión con Google",
      "account.sync.connecting": "Conectando…",
      "account.sync.now": "Sincronizar ahora",
      "account.sync.syncing": "Sincronizando…",
      "account.sync.retry": "Reintentar",
      "account.sync.reconnect": "Reconectar",
      "account.sync.signout": "Cerrar sesión",
      "account.sync.revoke": "Cerrar sesión y revocar el acceso",
      "account.sync.revoke.hint": "Quita el permiso de Drive: la próxima vez Google vuelve a pedirlo.",
      "account.link.title": "Elegí qué perfil guardar en tu Drive",
      "account.link.lead": "Todavía no se guardó nada en tu Drive. Solo el perfil que elijas se sube, y solo ese se baja en tus otros dispositivos: los demás perfiles de este dispositivo se quedan acá.",
      "account.link.choose": "Perfil para tu Drive",
      "account.link.option.meta": "{positions} · {level}",
      "account.link.save": "Guardar este perfil en mi Drive",
      "account.link.save.aria": "Guardar el perfil de {name} en mi Drive",
      "account.link.remote.loading": "Mirando qué hay en tu Drive…",
      "account.link.remote.exists": "Tu Drive ya tiene el progreso de «{name}» ({positions}). Podés traerlo a este dispositivo o combinarlo con un perfil de acá.",
      "account.link.remote.empty": "Tu Drive todavía no tiene progreso guardado: elegí el perfil que querés empezar a guardar.",
      "account.link.remote.error": "No pudimos mirar tu Drive: {reason}",
      "account.link.remote.retry": "Mirar de nuevo",
      "account.link.confirm.title": "¿Subir el perfil de {name} a tu Drive?",
      "account.link.confirm.body": "Se sube todo su historial (posiciones jugadas, cuaderno, logros y nivel) a tu propio Google Drive, en un archivo oculto que solo esta app puede leer. Si analizaste partidas de tus cuentas de Lichess o Chess.com, también van los nombres de los jugadores y los enlaces a esas partidas.",
      "account.link.confirm.merge": "Tu Drive ya tiene progreso guardado de «{name}»: se combina con este perfil y no se borra nada.",
      "account.link.confirm.yes": "Subir a mi Drive",
      "account.profile.synced": "Sincronizado con Google",
      "account.link.import": "Traer mi progreso de Drive a este dispositivo",
      "account.link.import.hint": "Si ya sincronizaste antes en otro dispositivo: lo baja y no sube nada.",
      "account.link.working": "Un momento…",
      "account.link.imported": "Listo: trajimos tu progreso desde Drive.",
      "account.link.empty": "Tu Drive todavía no tiene progreso guardado. Elegí un perfil para empezar.",
      "account.link.synced": "Sincronizás el perfil de {name}. Los demás perfiles de este dispositivo no se suben.",
      "account.link.unlink": "Dejar de sincronizar este perfil",
      "account.link.unlink.aria": "Dejar de sincronizar el perfil de {name}",
      "account.link.unlinked": "Listo: {name} ya no se sincroniza. Su copia en Drive y su progreso en este dispositivo siguen como estaban.",
      "account.sync.as": "Conectado como {name}",
      "account.sync.remembered": "Iniciaste sesión como {name} en este dispositivo. Reconectá para seguir sincronizando.",
      "account.sync.last": "Última sincronización: {when}",
      "account.sync.never": "Todavía no se sincronizó",
      "account.sync.now.text": "hace un momento",
      "account.sync.ago.min": "hace {n} min",
      "account.sync.ago.hour": "hace {n} h",
      "account.sync.statusLabel": "Estado de la sincronización",
      "account.sync.signedOut": "Sin sesión",
      "account.sync.storedTitle": "Qué se guarda y dónde",
      "account.sync.stored.device": "En este dispositivo: tus perfiles, tu progreso y tus ajustes, en el almacenamiento del navegador.",
      "account.sync.stored.drive": "En tu Google Drive: un solo archivo oculto (ludus-progress-v1.json) en la carpeta privada de esta app, con el progreso del perfil que elijas. Solo esta app puede verlo y no aparece entre tus archivos. Si analizaste partidas de tus cuentas de Lichess o Chess.com, el archivo incluye los nombres de los jugadores (también los de tus rivales) y los enlaces a esas partidas.",
      "account.sync.stored.nothing": "No se envía nada más a ningún lado: no hay servidor de Ludus Scaccorum, y el permiso de acceso vive solo en la memoria de esta pestaña.",
      "account.sync.stored.merge": "La sincronización une el progreso de tus dispositivos: borrar algo en uno no lo borra en los otros.",
      "account.sync.off.title": "Sincronización con Google",
      "account.sync.off.body": "La sincronización con Google no está disponible en esta versión. Mientras tanto, descargar tu progreso y cargarlo en el otro dispositivo (en «Tus datos», más arriba) lo lleva de un lado al otro.",
      "account.sync.off.owner": "¿Administrás este sitio? Los pasos para activarla están en docs/GOOGLE_SIGNIN.md del repositorio.",
      "account.sync.off.link": "Abrir la guía de configuración",

      "account.install.title": "Instalar la app",
      "account.install.lead": "Instalada se abre como cualquier app, en su propia ventana y con acceso directo. Después de la primera vez también funciona sin conexión.",
      "account.install.button": "Instalar Ludus Scaccorum",
      "account.install.installed": "Ya estás usando la app instalada.",
      "account.install.ios": "En iPhone o iPad: tocá el botón Compartir y elegí «Agregar a pantalla de inicio».",
      "account.install.other": "Tu navegador puede instalarla desde su menú («Instalar app» o «Agregar a la pantalla de inicio») cuando esté disponible.",
      "account.install.accepted": "Listo, se está instalando.",
      "account.install.dismissed": "Sin problema: podés instalarla cuando quieras.",

      "account.about.title": "Acerca de Ludus Scaccorum",
      "account.about.lead": "Un entrenador de ajedrez para aprender de tus errores y de las partidas clásicas. Gratis, de código abierto y sin servidor.",
      "account.about.version": "Versión",
      "account.about.version.dev": "desarrollo",
      "account.about.licence": "Licencia",
      "account.about.engine": "Motor de análisis",
      "account.about.engine.value": "Stockfish 18 (GPL-3.0), que corre en tu navegador con WebAssembly.",
      "account.about.credits": "Créditos",
      "account.about.credits.pieces": "Piezas de ajedrez de Colin M. L. Burnett (cburnett), usadas bajo la licencia GPL, versión 2 o posterior: la opción que elegimos entre las que ofrece su autor (también las publica como CC BY-SA 3.0, GFDL y BSD).",
      "account.about.credits.fonts": "Tipografías Inter y Cormorant, con licencia SIL Open Font.",
      "account.about.links": "Más información",
      "account.about.notices": "Avisos de terceros",
      "account.about.licenceText": "Texto de la licencia",
      "account.about.source": "Código fuente en GitHub",
      "account.about.newTab": "(se abre en otra pestaña)",
      "account.privacy.title": "Privacidad",
      "account.privacy.1": "Tu progreso y tus ajustes se guardan solo en este navegador.",
      "account.privacy.2": "Las partidas de Lichess o Chess.com se descargan directo a tu navegador, y solo después de que lo confirmes.",
      "account.privacy.3": "Google se carga únicamente si tocás «Iniciar sesión con Google».",
      "account.privacy.4": "No hay cuentas propias, servidor de la app, publicidad ni seguimiento.",
      "account.keys.title": "Atajos de teclado",
      "account.keys.play": "Al jugar",
      "account.keys.hint": "Pedir una pista, mientras pensás",
      "account.keys.next": "Siguiente posición",
      "account.keys.explore": "Explorar el tablero",
      "account.keys.best": "Ver la mejor jugada",
      "account.keys.master": "Ver la jugada de la partida",
      "account.keys.board": "En el tablero",
      "account.keys.arrows": "Moverte entre casillas",
      "account.keys.edges": "Ir al borde del tablero",
      "account.keys.select": "Elegir una pieza y jugarla",
      "account.keys.cancel": "Cancelar la selección",
      "account.keys.replay": "En la repetición de una partida clásica",
      "account.keys.replay.step": "Jugada anterior o siguiente",
      "account.keys.replay.play": "Reproducir o pausar",
      "account.keys.general": "En cualquier pantalla",
      "account.keys.tab": "Pasar de un control al siguiente",
      "account.keys.esc": "Cerrar un cuadro de diálogo",
    },
    en: {
      "account.title": "Account and data",
      "account.eyebrow": "Your account",
      "account.heading": "Account",
      "account.sub": "Your profiles, your progress and, if you want it, sync between devices. Everything lives on this device unless you decide otherwise.",
      "account.unavailable": "This part is not available right now.",

      "account.profiles.title": "Profiles on this device",
      "account.profiles.lead": "Two people can share this device: each profile keeps its own progress, level and notebook. In a Duel, each player picks their own profile.",
      "account.profiles.private": "Profiles keep each person's progress apart, but they do not protect it: anyone using this device can open any profile and download its data.",
      "account.profiles.count": "{n} of {max} profiles",
      "account.profiles.list": "Profiles",
      "account.profile.active": "Active",
      "account.profile.use": "Use this profile",
      "account.profile.use.aria": "Play as {name}",
      "account.profile.rename": "Rename",
      "account.profile.rename.aria": "Rename {name}'s profile",
      "account.profile.delete": "Delete",
      "account.profile.delete.aria": "Delete {name}'s profile",
      "account.profile.positions": "{n} positions played",
      "account.profile.positions.one": "1 position played",
      "account.profile.positions.none": "No positions played yet",
      "account.profile.add": "Add a profile",
      "account.profile.add.hint": "For another person, or to keep your practice apart.",
      "account.profile.full": "You have reached the limit of {max} profiles. Delete one to create another.",
      "account.profile.duel": "Set up a duel",
      "account.profile.switched": "You are now playing as {name}",
      "account.create.title": "New profile",
      "account.create.name": "Name",
      "account.create.name.hint": "Up to {max} characters. Shown in the header and in duels.",
      "account.create.color": "Colour",
      "account.create.color.aria": "Colour {n}",
      "account.create.switch": "Play as this profile now",
      "account.create.submit": "Create profile",
      "account.create.done": "Profile created: {name}",
      "account.rename.title": "Rename the profile",
      "account.rename.submit": "Save name",
      "account.rename.done": "Now called {name}",
      "account.delete.title": "Delete {name}'s profile?",
      "account.delete.body": "Its {positions} and {cards} are erased from this device for good, with its level and achievements. This cannot be undone.",
      "account.delete.positions": "{n} positions played",
      "account.delete.positions.one": "1 position played",
      "account.delete.cards": "{n} notebook cards",
      "account.delete.cards.one": "1 notebook card",
      "account.delete.last": "This is the only profile: afterwards you will start with a new, empty one.",
      "account.delete.export": "Download a copy first",
      "account.delete.type": "To confirm, type the profile's name: {name}",
      "account.delete.hint": "The button turns on when the name matches.",
      "account.delete.confirm": "Delete the profile",
      "account.delete.done": "Profile deleted: {name}",
      "account.error.limit": "There are already {max} profiles. Delete one to create another.",
      "account.error.invalid-name": "Type a name for the profile.",
      "account.error.storage": "Could not save: browser storage is full or blocked.",
      "account.error.read-only": "This data comes from a newer version of the app and cannot be changed.",
      "account.error.generic": "The action could not be completed.",

      "account.data.title": "Your data",
      "account.data.lead": "Your progress is on this device. Download it whenever you like: it is a file you can load on another device or keep as a backup.",
      "account.storage.title": "Space used",
      "account.storage.used": "You use {used} of about {limit} that the browser allows.",
      "account.storage.aria": "Storage space used by Ludus Scaccorum",
      "account.storage.unavailable": "Browser storage is not available (for example in a private window): progress cannot be saved.",
      "account.export.title": "Download your progress",
      "account.export.hint": "The file holds your moves, sessions, notebook and achievements. For the games you analysed from your Lichess or Chess.com accounts it also keeps the players' usernames (yours and your opponent's) and a link to each game, so think before sharing it. It does not include your Google account.",
      "account.export.active": "Download {name}'s profile",
      "account.export.all": "Download all profiles",
      "account.export.done": "Downloaded {file}.",
      "account.export.error": "The file could not be created.",
      "account.import.title": "Load a file",
      "account.import.hint": "Only .json files downloaded from Ludus Scaccorum. They are checked before anything is touched.",
      "account.import.drop": "Drop your progress file here",
      "account.import.drop.or": "or pick it from your device",
      "account.import.choose": "Choose a file",
      "account.import.reading": "Checking the file…",
      "account.import.review": "This is what {file} holds",
      "account.import.found.profiles": "{n} profiles",
      "account.import.found.profiles.one": "1 profile",
      "account.import.found.rounds": "{n} positions",
      "account.import.found.rounds.one": "1 position",
      "account.import.found.sessions": "{n} sessions",
      "account.import.found.sessions.one": "1 session",
      "account.import.found.cards": "{n} notebook cards",
      "account.import.found.cards.one": "1 notebook card",
      "account.import.dropped": "{n} entries were skipped because they were damaged or invalid.",
      "account.import.dropped.one": "1 entry was skipped because it was damaged or invalid.",
      "account.import.mode": "How do you want to load it?",
      "account.import.merge": "Merge with what I already have",
      "account.import.merge.hint": "Recommended: it joins both versions and nothing is lost.",
      "account.import.replace": "Replace the matching profiles",
      "account.import.replace.hint": "Profiles in the file overwrite the ones with the same identifier.",
      "account.import.run": "Load the progress",
      "account.import.cancel": "Cancel",
      "account.import.done": "Done: {profiles} and {rounds} loaded.",
      "account.import.readError": "We could not read that file.",
      "account.danger.title": "Delete everything",
      "account.danger.lead": "Erases every profile, the progress, the settings and the saved games from this device. The copy in Google Drive, if any, is not touched.",
      "account.danger.button": "Delete all my data",
      "account.danger.modal.title": "Delete all data?",
      "account.danger.modal.body": "This erases, for good and only from this device: every profile and its progress, the settings and the downloaded games. If you synced with Google, the copy in Drive stays there and can be removed from your Google account.",
      "account.danger.type": "To confirm, type {word}",
      "account.danger.word": "DELETE",
      "account.danger.confirm": "Delete everything",
      "account.danger.done": "All data on this device was deleted.",

      "account.sync.title": "Sync with Google",
      "account.sync.lead": "Take your progress to other devices through your own Google Drive. There is no server of ours in between.",
      "account.sync.signin": "Sign in with Google",
      "account.sync.connecting": "Connecting…",
      "account.sync.now": "Sync now",
      "account.sync.syncing": "Syncing…",
      "account.sync.retry": "Try again",
      "account.sync.reconnect": "Reconnect",
      "account.sync.signout": "Sign out",
      "account.sync.revoke": "Sign out and revoke access",
      "account.sync.revoke.hint": "Removes the Drive permission: Google asks for it again next time.",
      "account.link.title": "Choose which profile to save to your Drive",
      "account.link.lead": "Nothing has been saved to your Drive yet. Only the profile you choose is uploaded, and only that one comes down on your other devices: the other profiles on this device stay here.",
      "account.link.choose": "Profile for your Drive",
      "account.link.option.meta": "{positions} · {level}",
      "account.link.save": "Save this profile to my Drive",
      "account.link.save.aria": "Save {name}'s profile to my Drive",
      "account.link.remote.loading": "Looking at what is in your Drive…",
      "account.link.remote.exists": "Your Drive already holds the progress of “{name}” ({positions}). You can bring it to this device or combine it with a profile from here.",
      "account.link.remote.empty": "Your Drive has no saved progress yet: choose the profile you want to start saving.",
      "account.link.remote.error": "We could not look at your Drive: {reason}",
      "account.link.remote.retry": "Look again",
      "account.link.confirm.title": "Upload {name}'s profile to your Drive?",
      "account.link.confirm.body": "Its whole history (positions played, notebook, achievements and level) goes to your own Google Drive, in a hidden file only this app can read. If you analysed games from your Lichess or Chess.com accounts, the players' usernames and the links to those games go too.",
      "account.link.confirm.merge": "Your Drive already holds saved progress for “{name}”: it is combined with this profile and nothing is deleted.",
      "account.link.confirm.yes": "Upload to my Drive",
      "account.profile.synced": "Synced with Google",
      "account.link.import": "Bring my Drive progress to this device",
      "account.link.import.hint": "If you already synced on another device: it downloads and uploads nothing.",
      "account.link.working": "One moment…",
      "account.link.imported": "Done: your progress came down from Drive.",
      "account.link.empty": "Your Drive has no saved progress yet. Choose a profile to start.",
      "account.link.synced": "You are syncing {name}'s profile. The other profiles on this device are not uploaded.",
      "account.link.unlink": "Stop syncing this profile",
      "account.link.unlink.aria": "Stop syncing {name}'s profile",
      "account.link.unlinked": "Done: {name} is no longer synced. Its copy on Drive and its progress on this device stay as they were.",
      "account.sync.as": "Signed in as {name}",
      "account.sync.remembered": "You signed in as {name} on this device. Reconnect to keep syncing.",
      "account.sync.last": "Last sync: {when}",
      "account.sync.never": "Not synced yet",
      "account.sync.now.text": "just now",
      "account.sync.ago.min": "{n} min ago",
      "account.sync.ago.hour": "{n} h ago",
      "account.sync.statusLabel": "Sync status",
      "account.sync.signedOut": "Signed out",
      "account.sync.storedTitle": "What is stored, and where",
      "account.sync.stored.device": "On this device: your profiles, progress and settings, in the browser's storage.",
      "account.sync.stored.drive": "In your Google Drive: a single hidden file (ludus-progress-v1.json) in this app's private folder, with the progress of the profile you choose. Only this app can see it and it does not show among your files. If you analysed games from your Lichess or Chess.com accounts, the file includes the players' usernames (your opponents' too) and links to those games.",
      "account.sync.stored.nothing": "Nothing else is sent anywhere: there is no Ludus Scaccorum server, and the access permission lives only in this tab's memory.",
      "account.sync.stored.merge": "Sync joins the progress of your devices: deleting something on one does not delete it on the others.",
      "account.sync.off.title": "Sync with Google",
      "account.sync.off.body": "Sync with Google is not available in this version. Meanwhile, downloading your progress and loading it on the other device (under “Your data”, above) moves it from one to the other.",
      "account.sync.off.owner": "Do you run this site? The steps to turn it on are in docs/GOOGLE_SIGNIN.md in the repository.",
      "account.sync.off.link": "Open the setup guide",

      "account.install.title": "Install the app",
      "account.install.lead": "Installed, it opens like any app, in its own window with a shortcut. After the first visit it also works without a connection.",
      "account.install.button": "Install Ludus Scaccorum",
      "account.install.installed": "You are already using the installed app.",
      "account.install.ios": "On iPhone or iPad: tap the Share button and choose “Add to Home Screen”.",
      "account.install.other": "Your browser can install it from its menu (“Install app” or “Add to Home screen”) when it is available.",
      "account.install.accepted": "Done, it is being installed.",
      "account.install.dismissed": "No problem: you can install it whenever you like.",

      "account.about.title": "About Ludus Scaccorum",
      "account.about.lead": "A chess trainer for learning from your mistakes and from classic games. Free, open source and serverless.",
      "account.about.version": "Version",
      "account.about.version.dev": "development",
      "account.about.licence": "Licence",
      "account.about.engine": "Analysis engine",
      "account.about.engine.value": "Stockfish 18 (GPL-3.0), running in your browser with WebAssembly.",
      "account.about.credits": "Credits",
      "account.about.credits.pieces": "Chess pieces by Colin M. L. Burnett (cburnett), used under the GPL, version 2 or later: the option we chose among those their author offers (he also publishes them as CC BY-SA 3.0, GFDL and BSD).",
      "account.about.credits.fonts": "Inter and Cormorant typefaces, under the SIL Open Font License.",
      "account.about.links": "More information",
      "account.about.notices": "Third-party notices",
      "account.about.licenceText": "Licence text",
      "account.about.source": "Source code on GitHub",
      "account.about.newTab": "(opens in a new tab)",
      "account.privacy.title": "Privacy",
      "account.privacy.1": "Your progress and settings are stored only in this browser.",
      "account.privacy.2": "Games from Lichess or Chess.com are downloaded straight to your browser, and only after you confirm.",
      "account.privacy.3": "Google is loaded only if you press “Sign in with Google”.",
      "account.privacy.4": "There are no accounts of our own, no app server, no ads and no tracking.",
      "account.keys.title": "Keyboard shortcuts",
      "account.keys.play": "While playing",
      "account.keys.hint": "Ask for a hint, while you think",
      "account.keys.next": "Next position",
      "account.keys.explore": "Explore the board",
      "account.keys.best": "Show the best move",
      "account.keys.master": "Show the move of the game",
      "account.keys.board": "On the board",
      "account.keys.arrows": "Move between squares",
      "account.keys.edges": "Jump to an edge of the board",
      "account.keys.select": "Pick up a piece and play it",
      "account.keys.cancel": "Cancel the selection",
      "account.keys.replay": "In a classic game replay",
      "account.keys.replay.step": "Previous or next move",
      "account.keys.replay.play": "Play or pause",
      "account.keys.general": "On any screen",
      "account.keys.tab": "Move from one control to the next",
      "account.keys.esc": "Close a dialog",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    try {
      if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
    } catch (error) {
      // Text is cosmetic: the screen keeps working with raw keys.
    }
  }

  // ---------- Pure helpers ----------

  // A count with the singular form when there is one ("{n} sessions" / "1 session").
  function tCount(key, n, params) {
    return t(n === 1 && t(`${key}.one`) !== `${key}.one` ? `${key}.one` : key, Object.assign({ n }, params || {}));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // Local calendar date, YYYY-MM-DD (what a person expects to read in a file name).
  function dateStamp(ts) {
    const date = new Date(Number.isFinite(ts) ? ts : Date.now());
    if (Number.isNaN(date.getTime())) return "0000-00-00";
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function slugify(text, max) {
    let value = String(text === undefined || text === null ? "" : text);
    try {
      value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
    } catch (error) {
      // no normalize: keep as is
    }
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max || 24).replace(/-+$/g, "");
  }

  // "ludus-scaccorum-ana-2026-09-30.json" or "...-all-profiles-...".
  function exportFileName(scope, profileName, ts) {
    const middle = scope === "all" ? "all-profiles" : slugify(profileName) || "progress";
    return `ludus-scaccorum-${middle}-${dateStamp(ts)}.json`;
  }

  function formatBytes(bytes, language) {
    const n = Math.max(0, Number(bytes) || 0);
    const number = (value, digits) => {
      try {
        return new Intl.NumberFormat(language === "en" ? "en" : "es", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
      } catch (error) {
        return value.toFixed(digits);
      }
    };
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${number(n / 1024, n < 10 * 1024 ? 1 : 0)} KB`;
    return `${number(n / (1024 * 1024), 1)} MB`;
  }

  // Bytes the app's own keys take in localStorage (UTF-16: two bytes per character).
  function storageUsage(store) {
    const target = store === undefined ? (() => {
      try {
        return root.localStorage || null;
      } catch (error) {
        return null;
      }
    })() : store;
    if (!target) return { available: false, bytes: 0, keys: 0, limit: STORAGE_LIMIT_BYTES };
    let bytes = 0;
    let keys = 0;
    try {
      const count = Number(target.length) || 0;
      for (let i = 0; i < count; i += 1) {
        const key = target.key(i);
        if (typeof key !== "string" || !key.startsWith(STORAGE_PREFIX)) continue;
        const value = target.getItem(key);
        bytes += (key.length + (typeof value === "string" ? value.length : 0)) * 2;
        keys += 1;
      }
    } catch (error) {
      return { available: false, bytes: 0, keys: 0, limit: STORAGE_LIMIT_BYTES };
    }
    return { available: true, bytes, keys, limit: STORAGE_LIMIT_BYTES };
  }

  // The words a person types to confirm a deletion must match, ignoring case,
  // accents, surrounding spaces and repeated inner spaces.
  function normalizeTyped(text) {
    let value = String(text === undefined || text === null ? "" : text);
    try {
      value = value.normalize("NFC");
    } catch (error) {
      // keep as is
    }
    return value.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function confirmationMatches(typed, expected) {
    const wanted = normalizeTyped(expected);
    return wanted !== "" && normalizeTyped(typed) === wanted;
  }

  // "just now", "5 min ago", "3 h ago", or a date after a day.
  function formatAgo(ts, now, language) {
    const at = Number(ts);
    if (!Number.isFinite(at) || at <= 0) return "";
    const diff = Math.max(0, (Number.isFinite(now) ? now : Date.now()) - at);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("account.sync.now.text");
    if (minutes < 60) return t("account.sync.ago.min", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("account.sync.ago.hour", { n: hours });
    const util = L().util;
    return util && typeof util.formatDate === "function" ? util.formatDate(at, language) : dateStamp(at);
  }

  // Only Google's image host is ever used for a picture (the CSP allows nothing else).
  const PICTURE_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com(\/[^\s"'<>\\]*)?$/i;
  function safePictureUrl(url) {
    return typeof url === "string" && url.length <= 512 && PICTURE_RE.test(url) ? url : "";
  }

  // What the summary of a dry-run import says, as [{ key, n }] in reading order.
  function importCounts(summary) {
    const s = summary && typeof summary === "object" ? summary : {};
    const n = (value) => Math.max(0, Math.floor(Number(value) || 0));
    return [
      { key: "account.import.found.profiles", n: n(s.profiles) },
      { key: "account.import.found.rounds", n: n(s.rounds) },
      { key: "account.import.found.sessions", n: n(s.sessions) },
      { key: "account.import.found.cards", n: n(s.cards) },
    ];
  }

  function importSummaryText(summary) {
    return importCounts(summary).map((item) => tCount(item.key, item.n)).join(" · ");
  }

  // The message of a failed import / profile action. `code` is a Profile error
  // code; unknown codes get the generic sentence, never a raw key.
  function profileErrorText(code) {
    const profile = L().Profile;
    const max = profile && profile.constants ? profile.constants.MAX_PROFILES : 4;
    if (profile && typeof profile.errorKey === "function" && code) {
      const key = profile.errorKey(code);
      const text = t(key, { max });
      if (text !== key) return text;
    }
    const own = `account.error.${code}`;
    const text = t(own, { max });
    return text !== own ? text : t("account.error.generic");
  }

  // How the install card should read.
  function installState(env) {
    const e = env || {};
    let standalone = false;
    try {
      standalone = Boolean(e.standalone) || Boolean(e.matchMedia && e.matchMedia("(display-mode: standalone)").matches);
    } catch (error) {
      standalone = Boolean(e.standalone);
    }
    const ua = String(e.userAgent || "");
    const touchMac = /Macintosh/.test(ua) && Number(e.maxTouchPoints) > 1;
    const ios = /iPad|iPhone|iPod/.test(ua) || touchMac;
    if (standalone) return "installed";
    if (e.canPrompt) return "prompt";
    if (ios) return "ios";
    return "other";
  }

  // The view of the sync card for one Auth.state(): everything the renderer
  // needs to decide, with no DOM. status: signed_out | signing_in | signed_in |
  // syncing | error; needsReconnect is true while the account is only remembered.
  function syncModel(state) {
    const s = state && typeof state === "object" ? state : {};
    const status = ["signed_out", "signing_in", "signed_in", "syncing", "error"].includes(s.status) ? s.status : "signed_out";
    const user = s.user && typeof s.user === "object" ? s.user : null;
    const reconnect = Boolean(s.needsReconnect) && Boolean(user);
    const busy = status === "signing_in" || status === "syncing";
    let tone = "neutral";
    if (status === "signed_in") tone = "success";
    else if (status === "error") tone = "danger";
    else if (busy) tone = "info";
    else if (reconnect) tone = "warn";
    return {
      status,
      user,
      error: typeof s.error === "string" ? s.error : "",
      lastSyncAt: Number(s.lastSyncAt) || 0,
      busy,
      tone,
      remembered: status === "signed_out" && reconnect,
      showSignIn: !user && status !== "signing_in",
      canSync: Boolean(user) && !reconnect && !busy && s.linkRequired !== true,
      canReconnect: reconnect && !busy,
      canSignOut: Boolean(user),
      // Which local profile goes to this Drive is the person's explicit choice (QA SEC-005): a first sign-in links and uploads
      // nothing. `linked` is [{ id, name }] (an Auth without the link step gives none and never asks).
      linkRequired: Boolean(user) && s.linkRequired === true,
      linked: Array.isArray(s.linkedProfiles) ? s.linkedProfiles.filter((item) => item && typeof item.id === "string") : [],
    };
  }

  // The four levels of the shortcut cheat sheet (keys as they are drawn).
  const SHORTCUTS = [
    { id: "play", rows: [[["H"], "account.keys.hint"], [["N", "Enter"], "account.keys.next"], [["E"], "account.keys.explore"], [["B"], "account.keys.best"], [["M"], "account.keys.master"]] },
    { id: "board", rows: [[["←", "↑", "→", "↓"], "account.keys.arrows"], [["Home", "End", "PgUp", "PgDn"], "account.keys.edges"], [["Enter", "Space"], "account.keys.select"], [["Esc"], "account.keys.cancel"]] },
    { id: "replay", rows: [[["←", "→"], "account.keys.replay.step"], [["Space"], "account.keys.replay.play"]] },
    { id: "general", rows: [[["Tab"], "account.keys.tab"], [["Esc"], "account.keys.esc"]] },
  ];

  // ---------- The install prompt (captured at load: the event fires early, once) ----------

  const install = { deferred: null, installed: false, listeners: [] };

  function notifyInstall() {
    install.listeners.slice().forEach((fn) => {
      try {
        fn();
      } catch (error) {
        logError("[Ludus.Screens.account] install listener threw", error);
      }
    });
  }

  (function captureInstallPrompt() {
    try {
      if (typeof root.addEventListener !== "function") return;
      root.addEventListener("beforeinstallprompt", (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        install.deferred = event || null;
        notifyInstall();
      });
      root.addEventListener("appinstalled", () => {
        install.deferred = null;
        install.installed = true;
        notifyInstall();
      });
    } catch (error) {
      // No window events (Node): nothing to capture.
    }
  })();

  function currentInstallState() {
    const nav = root.navigator || {};
    return installState({
      standalone: install.installed || nav.standalone === true,
      matchMedia: typeof root.matchMedia === "function" ? root.matchMedia.bind(root) : null,
      userAgent: nav.userAgent,
      maxTouchPoints: nav.maxTouchPoints,
      canPrompt: Boolean(install.deferred && typeof install.deferred.prompt === "function"),
    });
  }

  // ---------- Small builders ----------

  let idSeq = 0;
  const nextId = (prefix) => {
    idSeq += 1;
    return `${prefix}-${idSeq}`;
  };

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
    el.hidden = Boolean(hidden);
  }

  function setDisabled(el, disabled) {
    if (!el) return;
    el.disabled = Boolean(disabled);
    if (disabled) el.setAttribute("disabled", "");
    else el.removeAttribute("disabled");
  }

  // Puts `next` where `old` is (no replaceChild: it works on any DOM, including the test one).
  function swap(old, next) {
    if (!old || !next || !old.parentNode) return false;
    old.parentNode.insertBefore(next, old);
    old.remove();
    return true;
  }

  function toast(message, options) {
    const ui = L().ui;
    if (ui && typeof ui.toast === "function") {
      try {
        return ui.toast(message, options);
      } catch (error) {
        logError("[Ludus.Screens.account] toast failed", error);
      }
    }
    return null;
  }

  function button(label, options) {
    const opts = options || {};
    const attrs = {
      type: "button",
      class: cls("btn", `btn-${opts.kind || "secondary"}`, opts.size && `btn-${opts.size}`, opts.className),
      onclick: opts.onClick,
    };
    if (opts.ariaLabel) attrs["aria-label"] = opts.ariaLabel;
    // data-* as real attributes (selectors and tests read them; dataset alone does not write them everywhere).
    if (opts.dataset) Object.keys(opts.dataset).forEach((key) => { attrs[`data-${key}`] = opts.dataset[key]; });
    if (opts.id) attrs.id = opts.id;
    if (opts.busy) attrs["aria-busy"] = "true";
    if (opts.disabled) attrs.disabled = true;
    return h("button", attrs, opts.icon ? icon(opts.icon, { size: opts.size === "sm" ? 16 : 18 }) : null, h("span", { class: "btn-label" }, label));
  }

  function externalLink(href, label, className) {
    return h("a", { class: className || "account-link", href, target: "_blank", rel: "noopener noreferrer" },
      h("span", null, label), icon("external", { size: 14 }), h("span", { class: "sr-only" }, ` ${t("account.about.newTab")}`));
  }

  function card(titleText, leadText, body, options) {
    const opts = options || {};
    const headingId = nextId("account-h");
    return h("section", { class: cls("card", "account-card", opts.className), "aria-labelledby": headingId, "data-card": opts.id || "" },
      h("header", { class: "account-card-head" },
        opts.icon ? h("span", { class: "account-card-icon", "aria-hidden": "true" }, icon(opts.icon, { size: 22 })) : null,
        h("div", { class: "account-card-titles" },
          h(opts.level === 3 ? "h3" : "h2", { class: "account-h2", id: headingId, tabindex: "-1" }, titleText),
          leadText ? h("p", { class: "account-lead" }, leadText) : null),
        opts.aside || null),
      body);
  }

  // ---------- The screen ----------

  const state = {
    el: null,
    mounted: false,
    visible: false,
    dirty: true,
    offs: [],
    offAuth: null,
    profilesEl: null,
    dataEl: null,
    syncEl: null,
    installEl: null,
    aboutEl: null,
    importState: null, // { fileName, text, summary }
    messages: { data: null, install: null, link: null },
    remote: { sub: "", status: "idle", summary: null, error: "" }, // what the Drive already holds (Auth.remoteSummary), per signed-in account
    linkChoice: "", // the profile picked in the "which profile goes to your Drive" step
    linkBusy: false,
    linkedKey: "",
    refocus: null,
  };

  const profileApi = () => L().Profile || null;
  const authApi = () => L().Auth || null;

  function authConfigured() {
    const auth = authApi();
    try {
      return Boolean(auth && typeof auth.isConfigured === "function" && auth.isConfigured());
    } catch (error) {
      return false;
    }
  }

  // A dialog that is closing (its fade-out still runs) does not count as open.
  function modalOpen() {
    const doc = getDoc();
    try {
      return Boolean(doc && doc.querySelectorAll && Array.from(doc.querySelectorAll(".modal-backdrop")).some((el) => !el.classList.contains("is-closing")));
    } catch (error) {
      return false;
    }
  }

  // Focus goes back to a control that still exists after a repaint (the one that was
  // used has been rebuilt). While a dialog is open it is left alone: the dialog owns
  // focus, and this runs again when it closes.
  function applyRefocus() {
    if (modalOpen()) return;
    const wanted = state.refocus;
    state.refocus = null;
    if (!wanted || !state.el || typeof state.el.querySelector !== "function") return;
    let target = null;
    try {
      target = state.el.querySelector(wanted);
    } catch (error) {
      target = null;
    }
    if (target && typeof target.focus === "function") target.focus();
  }

  // ----- profiles -----

  // The ids of the local profiles linked to the signed-in Google account (none without Google, or without a link step in Auth).
  function linkedIds() {
    if (!authConfigured()) return [];
    const snapshot = authState();
    if (!snapshot || !snapshot.user || !Array.isArray(snapshot.linkedProfiles)) return [];
    return snapshot.linkedProfiles.filter((item) => item && typeof item.id === "string").map((item) => item.id);
  }

  function profileRows() {
    const profile = profileApi();
    if (!profile || typeof profile.list !== "function") return [];
    const synced = linkedIds();
    let list = [];
    try {
      list = profile.list();
    } catch (error) {
      return [];
    }
    return list.map((entry) => {
      let stats = null;
      try {
        stats = typeof profile.stats === "function" ? profile.stats(entry.id) : null;
      } catch (error) {
        stats = null;
      }
      return {
        id: entry.id,
        name: entry.name,
        color: entry.color,
        active: Boolean(entry.active),
        level: stats && stats.level ? stats.level : null,
        positions: stats ? Number(stats.totalPositions) || 0 : 0,
        cards: stats && stats.notebook ? Number(stats.notebook.total) || 0 : 0,
        sessions: stats ? Number(stats.sessions) || 0 : 0,
        synced: synced.includes(entry.id),
      };
    });
  }

  function maxProfiles() {
    const profile = profileApi();
    return profile && profile.constants && Number.isFinite(profile.constants.MAX_PROFILES) ? profile.constants.MAX_PROFILES : 4;
  }

  function profileCard(row) {
    const ui = L().ui;
    const positionsText = row.positions === 0 ? t("account.profile.positions.none") : tCount("account.profile.positions", row.positions);
    const actions = [];
    if (!row.active) {
      actions.push(button(t("account.profile.use"), {
        kind: "primary", size: "sm", ariaLabel: t("account.profile.use.aria", { name: row.name }), dataset: { action: "use", id: row.id },
        onClick: () => useProfile(row),
      }));
    }
    actions.push(button(t("account.profile.rename"), {
      kind: "ghost", size: "sm", icon: "user", ariaLabel: t("account.profile.rename.aria", { name: row.name }), dataset: { action: "rename", id: row.id },
      onClick: () => openRename(row),
    }));
    actions.push(button(t("account.profile.delete"), {
      kind: "ghost", size: "sm", className: "account-danger-text", ariaLabel: t("account.profile.delete.aria", { name: row.name }), dataset: { action: "delete", id: row.id },
      onClick: () => openDelete(row),
    }));
    return h("li", { class: cls("card", "card-flat", "account-profile", row.active && "is-active"), "data-profile-id": row.id, "data-active": row.active ? "true" : "false" },
      h("div", { class: "account-profile-top" },
        ui && typeof ui.avatar === "function" ? ui.avatar({ name: row.name, color: row.color }, { size: 52 }) : null,
        h("div", { class: "account-profile-id" },
          h("h3", { class: "account-profile-name", tabindex: "-1" }, row.name),
          row.level && ui && typeof ui.levelBadge === "function" ? ui.levelBadge(row.level) : null)),
      h("p", { class: "account-profile-meta" }, positionsText),
      row.active
        ? h("p", { class: "account-active" }, icon("check", { size: 14 }), h("span", null, t("account.profile.active")))
        : null,
      row.synced ? h("p", { class: "account-synced", "data-synced": "true" }, icon("cloud", { size: 14 }), h("span", null, t("account.profile.synced"))) : null,
      h("div", { class: "account-profile-actions" }, actions));
  }

  function buildProfiles() {
    const profile = profileApi();
    const holder = h("div", { class: "account-profiles-body" });
    if (!profile || typeof profile.list !== "function") {
      holder.appendChild(h("p", { class: "account-note" }, t("account.unavailable")));
      return card(t("account.profiles.title"), t("account.profiles.lead"), holder, { id: "profiles", icon: "users", className: "account-profiles" });
    }
    const rows = profileRows();
    state.linkedKey = linkedIds().join("|");
    const max = maxProfiles();
    const list = h("ul", { class: "account-profile-list", "aria-label": t("account.profiles.list") }, rows.map(profileCard));
    if (rows.length < max) {
      list.appendChild(h("li", { class: "account-profile-add-item" },
        h("button", { type: "button", class: "card card-interactive account-add", "data-action": "add", onclick: openCreate },
          h("span", { class: "account-add-icon", "aria-hidden": "true" }, icon("plus", { size: 22 })),
          h("span", { class: "account-add-text" },
            h("span", { class: "account-add-title" }, t("account.profile.add")),
            h("span", { class: "account-add-hint" }, t("account.profile.add.hint"))))));
    }
    holder.appendChild(list);
    if (rows.length >= max) holder.appendChild(h("p", { class: "account-note" }, t("account.profile.full", { max })));
    // Nothing separates two profiles on one device: say so plainly (QA UX-023).
    holder.appendChild(h("p", { class: "account-note account-profiles-private" }, icon("info", { size: 16 }), h("span", null, t("account.profiles.private"))));
    const home = L().Screens && L().Screens.home;
    const duel = home && typeof home.openDuelSetup === "function"
      ? button(t("account.profile.duel"), { kind: "secondary", size: "sm", icon: "swords", onClick: () => {
        try {
          home.openDuelSetup();
        } catch (error) {
          logError("[Ludus.Screens.account] duel setup failed", error);
        }
      } })
      : null;
    return card(t("account.profiles.title"), t("account.profiles.lead"), holder, {
      id: "profiles",
      icon: "users",
      className: "account-profiles",
      aside: h("div", { class: "account-card-aside" }, h("span", { class: "chip" }, t("account.profiles.count", { n: rows.length, max })), duel),
    });
  }

  function useProfile(row) {
    const profile = profileApi();
    if (!profile) return;
    state.refocus = `[data-profile-id="${row.id}"] .account-profile-name`;
    if (!profile.setActive(row.id)) {
      state.refocus = null;
      return;
    }
    toast(t("account.profile.switched", { name: row.name }), { kind: "success" });
  }

  function paletteColors() {
    const profile = profileApi();
    const list = profile && profile.constants && Array.isArray(profile.constants.PALETTE) ? profile.constants.PALETTE : [];
    return list.length ? list.slice() : ["#2f6f4f", "#8a4b2a", "#2b5f8a", "#7a3b8f"];
  }

  // The swatches are named by colour, not "Colour 3" (QA A11Y-026); a colour the list does not know keeps its number.
  const COLOR_NAMES = {
    "#2f6f4f": { es: "Verde", en: "Green" },
    "#8a4b2a": { es: "Marrón", en: "Brown" },
    "#2b5f8a": { es: "Azul", en: "Blue" },
    "#7a3b8f": { es: "Violeta", en: "Purple" },
    "#b3541e": { es: "Naranja", en: "Orange" },
    "#1f7a7a": { es: "Turquesa", en: "Teal" },
    "#8a2f45": { es: "Bordó", en: "Burgundy" },
    "#5a6b1f": { es: "Oliva", en: "Olive" },
  };

  function colorLabel(value, index) {
    const entry = COLOR_NAMES[String(value).toLowerCase()];
    return entry ? entry[lang() === "en" ? "en" : "es"] : t("account.create.color.aria", { n: index + 1 });
  }

  const NAME_MAX = 24; // the same limit Profile enforces

  function nameField(initial, id, errorId) {
    return h("input", {
      type: "text", class: "input", id, name: "profile-name", maxlength: String(NAME_MAX), value: initial || "", autocomplete: "off", autocapitalize: "words",
      "aria-describedby": errorId, spellcheck: "false",
    });
  }

  function openCreate() {
    const ui = L().ui;
    const profile = profileApi();
    if (!ui || typeof ui.modal !== "function" || !profile) return;
    const used = new Set(profileRows().map((row) => row.color));
    const palette = paletteColors();
    let color = palette.find((value) => !used.has(value)) || palette[0];
    const nameId = nextId("account-name");
    const hintId = nextId("account-name-hint");
    const errorId = nextId("account-name-error");
    const input = nameField("", nameId, `${hintId} ${errorId}`);
    const error = h("p", { class: "field-error account-error", id: errorId, role: "alert" });
    setHidden(error, true);
    const groupName = nextId("account-color");
    const swatches = palette.map((value, index) => {
      const radio = h("input", {
        type: "radio", class: "account-swatch-input", name: groupName, value, "aria-label": colorLabel(value, index),
        onchange: () => {
          color = value;
        },
      });
      if (value === color) {
        radio.checked = true;
        radio.setAttribute("checked", "");
      }
      return h("label", { class: "account-swatch" }, radio,
        h("span", { class: "account-swatch-face", style: { "--swatch": value } }, icon("check", { size: 16 })));
    });
    const switchInput = h("input", { type: "checkbox", checked: true });
    switchInput.checked = true;
    const body = h("form", { class: "account-form", novalidate: "", onsubmit: (event) => { if (event && event.preventDefault) event.preventDefault(); } },
      h("div", { class: "field" },
        h("label", { for: nameId }, t("account.create.name")),
        input,
        h("p", { class: "field-hint", id: hintId }, t("account.create.name.hint", { max: NAME_MAX })),
        error),
      h("fieldset", { class: "account-fieldset" },
        h("legend", { class: "account-legend" }, t("account.create.color")),
        h("div", { class: "account-swatches", role: "radiogroup", "aria-label": t("account.create.color") }, swatches)),
      h("label", { class: "check account-check" }, switchInput, h("span", { class: "check-box", "aria-hidden": "true" }), h("span", { class: "check-text" }, t("account.create.switch"))));
    const showError = (text) => {
      error.textContent = text || "";
      setHidden(error, !text);
      if (text) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    };
    const handle = ui.modal({
      className: "account-modal",
      title: t("account.create.title"),
      body,
      size: "sm",
      initialFocus: input,
      onClose: () => applyRefocus(),
      actions: [
        { label: t("ui.cancel"), kind: "secondary", value: false },
        {
          label: t("account.create.submit"),
          kind: "primary",
          value: true,
          onClick: () => {
            const name = String(input.value || "").trim();
            if (!name) {
              showError(t("account.error.invalid-name"));
              input.focus();
              return false;
            }
            const made = profile.create({ name, color });
            if (!made) {
              showError(profileErrorText(typeof profile.lastError === "function" ? profile.lastError() : ""));
              return false;
            }
            if (switchInput.checked) profile.setActive(made.id);
            state.refocus = `[data-profile-id="${made.id}"] .account-profile-name`;
            toast(t("account.create.done", { name: made.name }), { kind: "success" });
            return true;
          },
        },
      ],
    });
    // Enter in the name field creates the profile.
    input.addEventListener("keydown", (event) => {
      if (event && event.key === "Enter") {
        if (typeof event.preventDefault === "function") event.preventDefault();
        const submit = handle.el && handle.el.querySelector ? handle.el.querySelector(".modal-actions .btn-primary") : null;
        if (submit && typeof submit.click === "function") submit.click();
      }
    });
    return handle;
  }

  function openRename(row) {
    const ui = L().ui;
    const profile = profileApi();
    if (!ui || typeof ui.modal !== "function" || !profile) return null;
    const nameId = nextId("account-name");
    const errorId = nextId("account-name-error");
    const input = nameField(row.name, nameId, errorId);
    const error = h("p", { class: "field-error account-error", id: errorId, role: "alert" });
    setHidden(error, true);
    const body = h("form", { class: "account-form", novalidate: "", onsubmit: (event) => { if (event && event.preventDefault) event.preventDefault(); } },
      h("div", { class: "field" }, h("label", { for: nameId }, t("account.create.name")), input, error));
    const handle = ui.modal({
      className: "account-modal",
      title: t("account.rename.title"),
      body,
      size: "sm",
      initialFocus: input,
      onClose: () => applyRefocus(),
      actions: [
        { label: t("ui.cancel"), kind: "secondary", value: false },
        {
          label: t("account.rename.submit"),
          kind: "primary",
          value: true,
          onClick: () => {
            const name = String(input.value || "").trim();
            if (!name) {
              error.textContent = t("account.error.invalid-name");
              setHidden(error, false);
              input.setAttribute("aria-invalid", "true");
              return false;
            }
            if (!profile.rename(row.id, name)) {
              error.textContent = profileErrorText(typeof profile.lastError === "function" ? profile.lastError() : "");
              setHidden(error, false);
              return false;
            }
            state.refocus = `[data-action="rename"][data-id="${row.id}"]`;
            toast(t("account.rename.done", { name }), { kind: "success" });
            return true;
          },
        },
      ],
    });
    input.addEventListener("keydown", (event) => {
      if (event && event.key === "Enter") {
        if (typeof event.preventDefault === "function") event.preventDefault();
        const submit = handle.el && handle.el.querySelector ? handle.el.querySelector(".modal-actions .btn-primary") : null;
        if (submit && typeof submit.click === "function") submit.click();
      }
    });
    return handle;
  }

  function openDelete(row) {
    const ui = L().ui;
    const profile = profileApi();
    if (!ui || typeof ui.modal !== "function" || !profile) return null;
    const rows = profileRows();
    const only = rows.length <= 1;
    const inputId = nextId("account-confirm");
    const hintId = nextId("account-confirm-hint");
    const input = h("input", {
      type: "text", class: "input", id: inputId, autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-describedby": hintId,
    });
    // The dialog is described by the consequence (and the "last profile" note), not by the whole form: a screen reader that read the typed-name field
    // and the export button as the description would bury what is about to be lost.
    const consequence = h("p", { class: "modal-text" }, t("account.delete.body", {
      positions: tCount("account.delete.positions", row.positions),
      cards: tCount("account.delete.cards", row.cards),
    }));
    const lastNote = only ? h("p", { class: "modal-text account-note" }, t("account.delete.last")) : null;
    const body = h("div", { class: "account-form" },
      consequence,
      lastNote,
      button(t("account.delete.export"), { kind: "ghost", size: "sm", icon: "download", onClick: () => exportProfiles(row.id, row.name) }),
      h("div", { class: "field" },
        h("label", { for: inputId }, t("account.delete.type", { name: row.name })),
        input,
        h("p", { class: "field-hint", id: hintId }, t("account.delete.hint"))));
    const handle = ui.modal({
      className: "account-modal",
      title: t("account.delete.title", { name: row.name }),
      body,
      size: "sm",
      role: "alertdialog",
      describedBy: [consequence, lastNote].filter(Boolean),
      initialFocus: input,
      onClose: () => applyRefocus(),
      actions: [
        { label: t("ui.cancel"), kind: "secondary", value: false },
        {
          label: t("account.delete.confirm"),
          kind: "danger",
          value: true,
          onClick: () => {
            if (!confirmationMatches(input.value, row.name)) return false;
            state.refocus = "[data-action=\"add\"], .account-profile .account-profile-name";
            if (!profile.remove(row.id)) {
              state.refocus = null;
              toast(profileErrorText(typeof profile.lastError === "function" ? profile.lastError() : ""), { kind: "error" });
              return false;
            }
            try {
              if (typeof profile.ensureActive === "function") profile.ensureActive();
            } catch (error) {
              logError("[Ludus.Screens.account] ensureActive failed", error);
            }
            toast(t("account.delete.done", { name: row.name }), { kind: "success" });
            return true;
          },
        },
      ],
    });
    const confirmBtn = handle.el && handle.el.querySelector ? handle.el.querySelector(".modal-actions .btn-danger") : null;
    if (confirmBtn) {
      setDisabled(confirmBtn, true);
      input.addEventListener("input", () => setDisabled(confirmBtn, !confirmationMatches(input.value, row.name)));
    }
    return handle;
  }

  // ----- data -----

  function downloadText(fileName, text) {
    const doc = getDoc();
    if (!doc || typeof root.Blob !== "function" || !root.URL || typeof root.URL.createObjectURL !== "function") return false;
    try {
      const blob = new root.Blob([text], { type: "application/json" });
      const url = root.URL.createObjectURL(blob);
      const link = h("a", { href: url, download: fileName, class: "sr-only", tabindex: "-1" });
      doc.body.appendChild(link);
      link.click();
      link.remove();
      const later = typeof root.setTimeout === "function" ? root.setTimeout : (fn) => fn();
      later(() => {
        try {
          root.URL.revokeObjectURL(url);
        } catch (error) {
          // already gone
        }
      }, 4000);
      return true;
    } catch (error) {
      logError("[Ludus.Screens.account] download failed", error);
      return false;
    }
  }

  function setMessage(area, kind, text) {
    state.messages[area] = text ? { kind, text } : null;
    const host = state.el && state.el.querySelector ? state.el.querySelector(`[data-msg="${area}"]`) : null;
    if (!host) return;
    paintMessage(host, state.messages[area]);
  }

  function paintMessage(host, message) {
    host.textContent = "";
    if (!message) return;
    host.appendChild(h("p", { class: cls("account-msg", message.kind === "error" ? "is-error" : "is-ok"), role: message.kind === "error" ? "alert" : "status" },
      icon(message.kind === "error" ? "alert" : "check", { size: 16 }), h("span", null, message.text)));
  }

  // which: a profile id, or "all". Returns true when a file was offered.
  function exportProfiles(which, name) {
    const profile = profileApi();
    if (!profile || typeof profile.exportJSON !== "function") return false;
    let text = "";
    try {
      text = profile.exportJSON(which === "all" ? "all" : which);
    } catch (error) {
      text = "";
    }
    if (!text) {
      setMessage("data", "error", t("account.export.error"));
      return false;
    }
    const fileName = exportFileName(which === "all" ? "all" : "one", name, Date.now());
    if (!downloadText(fileName, text)) {
      setMessage("data", "error", t("account.export.error"));
      return false;
    }
    setMessage("data", "ok", t("account.export.done", { file: fileName }));
    toast(t("account.export.done", { file: fileName }), { kind: "success" });
    return true;
  }

  function readFileText(file) {
    if (file && typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      if (typeof root.FileReader !== "function") {
        reject(new Error("no-reader"));
        return;
      }
      const reader = new root.FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read-failed"));
      reader.readAsText(file);
    });
  }

  // Reads a chosen / dropped file and shows what is in it (a dry run: nothing is written yet).
  function reviewFile(file) {
    const profile = profileApi();
    if (!file || !profile || typeof profile.importJSON !== "function") return Promise.resolve(false);
    const max = profile.constants && profile.constants.MAX_IMPORT_CHARS ? profile.constants.MAX_IMPORT_CHARS : 5 * 1024 * 1024;
    setMessage("data", "ok", "");
    if (Number(file.size) > max) {
      state.importState = null;
      paintImport();
      setMessage("data", "error", profileErrorText("too-large"));
      return Promise.resolve(false);
    }
    return readFileText(file).then((text) => {
      const result = profile.importJSON(text, { dryRun: true });
      if (!result || !result.ok) {
        state.importState = null;
        paintImport();
        setMessage("data", "error", profileErrorText(result && result.error));
        return false;
      }
      state.importState = { fileName: String(file.name || ""), text, summary: result };
      paintImport();
      const focus = state.el.querySelector ? state.el.querySelector("[data-import-review]") : null;
      if (focus && typeof focus.focus === "function") focus.focus();
      return true;
    }).catch((error) => {
      logError("[Ludus.Screens.account] could not read the file", error);
      state.importState = null;
      paintImport();
      setMessage("data", "error", t("account.import.readError"));
      return false;
    });
  }

  function runImport(mode) {
    const profile = profileApi();
    const pending = state.importState;
    if (!profile || !pending) return null;
    const result = profile.importJSON(pending.text, { mode: mode === "replace" ? "replace" : "merge" });
    if (!result || !result.ok) {
      setMessage("data", "error", profileErrorText(result && result.error));
      return result || null;
    }
    state.importState = null;
    paintImport();
    setMessage("data", "ok", t("account.import.done", { profiles: tCount("account.import.found.profiles", result.profiles), rounds: tCount("account.import.found.rounds", result.rounds) }));
    toast(t("account.import.done", { profiles: tCount("account.import.found.profiles", result.profiles), rounds: tCount("account.import.found.rounds", result.rounds) }), { kind: "success" });
    return result;
  }

  function cancelImport() {
    state.importState = null;
    paintImport();
    const pick = state.el && state.el.querySelector ? state.el.querySelector("[data-import-pick]") : null;
    if (pick && typeof pick.focus === "function") pick.focus();
  }

  function paintImport() {
    const host = state.el && state.el.querySelector ? state.el.querySelector("[data-import-host]") : null;
    if (!host) return;
    host.textContent = "";
    host.appendChild(buildImportBody());
  }

  function buildImportBody() {
    const pending = state.importState;
    if (!pending) return buildDropZone();
    const modeName = nextId("account-mode");
    let mode = "merge";
    const option = (value, labelKey, hintKey) => {
      const input = h("input", {
        type: "radio", name: modeName, value, class: "account-mode-input",
        onchange: () => {
          mode = value;
        },
      });
      if (value === mode) {
        input.checked = true;
        input.setAttribute("checked", "");
      }
      return h("label", { class: "account-mode" }, input,
        h("span", { class: "account-mode-face" },
          h("span", { class: "account-mode-label" }, t(labelKey)),
          h("span", { class: "account-mode-hint" }, t(hintKey))));
    };
    const counts = importCounts(pending.summary);
    const dropped = Number(pending.summary.dropped) || 0;
    return h("div", { class: "account-import-review" },
      h("h4", { class: "account-h4", tabindex: "-1", "data-import-review": "" }, t("account.import.review", { file: pending.fileName || "…" })),
      h("ul", { class: "account-found" }, counts.map((item) => h("li", { class: "chip account-found-chip", "data-found": item.key.split(".").pop() }, tCount(item.key, item.n)))),
      dropped > 0 ? h("p", { class: "account-note" }, tCount("account.import.dropped", dropped)) : null,
      h("div", { class: "account-modes", role: "radiogroup", "aria-label": t("account.import.mode") },
        h("p", { class: "account-legend" }, t("account.import.mode")),
        option("merge", "account.import.merge", "account.import.merge.hint"),
        option("replace", "account.import.replace", "account.import.replace.hint")),
      h("div", { class: "account-actions" },
        button(t("account.import.run"), { kind: "primary", icon: "upload", dataset: { action: "import-run" }, onClick: () => runImport(mode) }),
        button(t("account.import.cancel"), { kind: "ghost", dataset: { action: "import-cancel" }, onClick: cancelImport })));
  }

  function buildDropZone() {
    const inputId = nextId("account-file");
    const input = h("input", {
      type: "file", class: "account-file-input", id: inputId, accept: ".json,application/json", "data-import-pick": "",
      onchange: () => {
        const file = input.files && input.files[0];
        if (file) reviewFile(file);
        try {
          input.value = "";
        } catch (error) {
          // some hosts refuse to reset a file input
        }
      },
    });
    const zone = h("label", { class: "account-drop", for: inputId },
      input,
      h("span", { class: "account-drop-face" },
        h("span", { class: "account-drop-icon", "aria-hidden": "true" }, icon("upload", { size: 26 })),
        h("span", { class: "account-drop-title" }, t("account.import.drop")),
        h("span", { class: "account-drop-or" }, t("account.import.drop.or")),
        h("span", { class: "btn btn-secondary btn-sm account-drop-btn", "aria-hidden": "true" }, t("account.import.choose"))));
    const setOver = (on) => zone.classList.toggle("is-over", on);
    zone.addEventListener("dragenter", (event) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      setOver(true);
    });
    zone.addEventListener("dragover", (event) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      setOver(true);
    });
    zone.addEventListener("dragleave", () => setOver(false));
    zone.addEventListener("drop", (event) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      setOver(false);
      const files = event && event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) reviewFile(files[0]);
    });
    return zone;
  }

  // "Delete all data": every profile, the settings, every other key of the app and
  // the cache of downloaded games. The interface language is kept.
  function wipeEverything() {
    const profile = profileApi();
    if (profile && typeof profile.wipe === "function") profile.wipe("all");
    const storage = L().storage;
    try {
      if (storage && typeof storage.keys === "function") {
        storage.keys(STORAGE_PREFIX).forEach((key) => {
          if (!KEEP_KEYS.includes(key)) storage.remove(key);
        });
      }
    } catch (error) {
      logError("[Ludus.Screens.account] clearing keys failed", error);
    }
    try {
      const settings = L().Settings;
      if (settings) {
        if (typeof settings.reload === "function") settings.reload();
        if (typeof settings.applyToDocument === "function") settings.applyToDocument();
      }
    } catch (error) {
      logError("[Ludus.Screens.account] settings reload failed", error);
    }
    try {
      const auth = authApi();
      if (auth && typeof auth.signOut === "function" && authConfigured()) auth.signOut();
    } catch (error) {
      logError("[Ludus.Screens.account] sign out failed", error);
    }
    try {
      if (root.indexedDB && typeof root.indexedDB.deleteDatabase === "function") root.indexedDB.deleteDatabase(REMOTE_CACHE_DB);
    } catch (error) {
      // the cache is a convenience: a refusal here changes nothing
    }
    try {
      if (profile && typeof profile.ensureActive === "function") profile.ensureActive();
    } catch (error) {
      logError("[Ludus.Screens.account] ensureActive failed", error);
    }
  }

  function openDeleteAll() {
    const ui = L().ui;
    if (!ui || typeof ui.modal !== "function") return null;
    const word = t("account.danger.word");
    const inputId = nextId("account-confirm");
    const input = h("input", { type: "text", class: "input", id: inputId, autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const consequence = h("p", { class: "modal-text" }, t("account.danger.modal.body"));
    const body = h("div", { class: "account-form" },
      consequence,
      h("div", { class: "field" },
        h("label", { for: inputId }, t("account.danger.type", { word })),
        input));
    const handle = ui.modal({
      className: "account-modal",
      title: t("account.danger.modal.title"),
      body,
      size: "sm",
      role: "alertdialog",
      describedBy: consequence,
      initialFocus: input,
      onClose: () => applyRefocus(),
      actions: [
        { label: t("ui.cancel"), kind: "secondary", value: false },
        {
          label: t("account.danger.confirm"),
          kind: "danger",
          value: true,
          onClick: () => {
            if (!confirmationMatches(input.value, word)) return false;
            state.importState = null;
            state.refocus = "[data-action=\"delete-all\"]";
            wipeEverything();
            toast(t("account.danger.done"), { kind: "success" });
            return true;
          },
        },
      ],
    });
    const confirmBtn = handle.el && handle.el.querySelector ? handle.el.querySelector(".modal-actions .btn-danger") : null;
    if (confirmBtn) {
      setDisabled(confirmBtn, true);
      input.addEventListener("input", () => setDisabled(confirmBtn, !confirmationMatches(input.value, word)));
    }
    return handle;
  }

  function buildStorageMeter() {
    const usage = storageUsage();
    if (!usage.available) return h("p", { class: "account-note", "data-storage": "unavailable" }, t("account.storage.unavailable"));
    const ui = L().ui;
    const ratio = clamp(usage.bytes / usage.limit, 0, 1);
    const tone = ratio > 0.85 ? "danger" : ratio > 0.6 ? "warn" : null;
    const meter = ui && typeof ui.progress === "function"
      ? ui.progress(Math.max(ratio, usage.bytes > 0 ? 0.01 : 0), { label: t("account.storage.aria"), size: "sm", tone })
      : null;
    return h("div", { class: "account-storage", "data-storage": "ok" },
      h("h4", { class: "account-h4" }, t("account.storage.title")),
      meter,
      h("p", { class: "account-note" }, t("account.storage.used", { used: formatBytes(usage.bytes, lang()), limit: formatBytes(usage.limit, lang()) })));
  }

  function buildData() {
    const profile = profileApi();
    if (!profile) return card(t("account.data.title"), t("account.data.lead"), h("p", { class: "account-note" }, t("account.unavailable")), { id: "data", icon: "download", className: "account-data" });
    const rows = profileRows();
    const active = rows.find((row) => row.active) || rows[0] || null;

    const exportButtons = h("div", { class: "account-actions" });
    if (active) {
      exportButtons.appendChild(button(t("account.export.active", { name: active.name }), {
        kind: "primary", icon: "download", dataset: { action: "export-active" }, onClick: () => exportProfiles(active.id, active.name),
      }));
    }
    if (rows.length > 1) {
      exportButtons.appendChild(button(t("account.export.all"), { kind: "secondary", icon: "download", dataset: { action: "export-all" }, onClick: () => exportProfiles("all", "") }));
    }

    const msg = h("div", { class: "account-msg-host", "data-msg": "data", "aria-live": "polite" });
    paintMessage(msg, state.messages.data);
    const importHost = h("div", { class: "account-import-host", "data-import-host": "" }, buildImportBody());

    const body = h("div", { class: "account-data-body" },
      h("div", { class: "account-block" },
        h("h3", { class: "account-h3" }, t("account.export.title")),
        h("p", { class: "account-note" }, t("account.export.hint")),
        exportButtons),
      h("div", { class: "account-block" },
        h("h3", { class: "account-h3" }, t("account.import.title")),
        h("p", { class: "account-note" }, t("account.import.hint")),
        importHost),
      msg,
      buildStorageMeter(),
      h("div", { class: "account-block account-danger" },
        h("h3", { class: "account-h3" }, t("account.danger.title")),
        h("p", { class: "account-note" }, t("account.danger.lead")),
        button(t("account.danger.button"), { kind: "ghost", icon: "alert", className: "account-danger-btn", dataset: { action: "delete-all" }, onClick: openDeleteAll })));
    return card(t("account.data.title"), t("account.data.lead"), body, { id: "data", icon: "download", className: "account-data" });
  }

  // ----- sync with Google -----

  function authState() {
    const auth = authApi();
    try {
      if (auth && typeof auth.state === "function") return auth.state();
    } catch (error) {
      // fall through
    }
    return { status: "signed_out", user: null, error: "", needsReconnect: false, lastSyncAt: 0 };
  }

  function errorMessage(code) {
    const auth = authApi();
    try {
      if (auth && typeof auth.errorMessage === "function") return auth.errorMessage(code, lang());
    } catch (error) {
      // fall through
    }
    return t("auth.error.unknown");
  }

  function doSignIn() {
    const auth = authApi();
    if (!auth || typeof auth.signIn !== "function") return;
    Promise.resolve(auth.signIn()).catch((error) => logError("[Ludus.Screens.account] sign-in failed", error));
  }

  function doSync() {
    const auth = authApi();
    if (!auth || typeof auth.syncNow !== "function") return;
    Promise.resolve(auth.syncNow()).catch((error) => logError("[Ludus.Screens.account] sync failed", error));
  }

  function doSignOut(revoke) {
    const auth = authApi();
    if (!auth || typeof auth.signOut !== "function") return;
    Promise.resolve(auth.signOut(revoke ? { revoke: true } : undefined)).then(() => {
      state.refocus = "[data-action=\"signin\"]";
      if (state.visible) paintSync();
    }).catch((error) => logError("[Ludus.Screens.account] sign-out failed", error));
  }

  function userBlock(user) {
    const ui = L().ui;
    const picture = safePictureUrl(user && user.picture);
    const name = user && user.name ? String(user.name) : "";
    const fallback = ui && typeof ui.avatar === "function" ? ui.avatar({ name: name || "G", color: "#2b5f8a" }, { size: 44 }) : null;
    let face = fallback;
    if (picture) {
      const img = h("img", {
        class: "account-photo", src: picture, alt: "", width: 44, height: 44, referrerpolicy: "no-referrer", decoding: "async",
        onerror: () => {
          if (fallback) swap(img, fallback);
        },
      });
      face = img;
    }
    return h("div", { class: "account-user" },
      face,
      h("div", { class: "account-user-text" },
        h("p", { class: "account-user-name" }, name ? t("account.sync.as", { name }) : t("auth.status.signed_in")),
        user && user.email ? h("p", { class: "account-user-email" }, String(user.email)) : null));
  }

  // ----- which profile goes to the Drive (QA SEC-005 / SEC-006) -----

  function authResultMessage(result) {
    return result && result.error ? errorMessage(result.error) : errorMessage("unknown");
  }

  function doLink(profileId, name) {
    const auth = authApi();
    if (!auth || typeof auth.linkProfile !== "function" || state.linkBusy) return;
    state.linkBusy = true;
    state.messages.link = { kind: "info", text: t("account.link.working") };
    state.refocus = "[data-action=\"link-save\"]";
    paintSync();
    Promise.resolve(auth.linkProfile(profileId)).then((result) => {
      state.messages.link = result && result.ok ? null : { kind: "error", text: authResultMessage(result) };
      // A link that was made but could not sync yet (the session has to reconnect) is not an error of the choice: Auth says so in its own state.
      if (result && !result.ok && result.linked) state.messages.link = null;
    }).catch((error) => {
      logError("[Ludus.Screens.account] linking the profile failed", error);
      state.messages.link = { kind: "error", text: errorMessage("unknown") };
    }).then(() => {
      state.linkBusy = false;
      if (state.visible) paintSync();
    });
  }

  function doImportFromDrive() {
    const auth = authApi();
    if (!auth || typeof auth.importFromDrive !== "function" || state.linkBusy) return;
    state.linkBusy = true;
    state.messages.link = { kind: "info", text: t("account.link.working") };
    state.refocus = "[data-action=\"link-import\"]";
    paintSync();
    Promise.resolve(auth.importFromDrive()).then((result) => {
      if (result && result.ok) state.messages.link = { kind: "ok", text: result.empty ? t("account.link.empty") : t("account.link.imported") };
      else state.messages.link = { kind: "error", text: authResultMessage(result) };
    }).catch((error) => {
      logError("[Ludus.Screens.account] importing from Drive failed", error);
      state.messages.link = { kind: "error", text: errorMessage("unknown") };
    }).then(() => {
      state.linkBusy = false;
      if (state.visible) paintSync();
    });
  }

  function doUnlink(row) {
    const auth = authApi();
    if (!auth || typeof auth.unlinkProfile !== "function") return;
    let result = null;
    try {
      result = auth.unlinkProfile(row.id);
    } catch (error) {
      logError("[Ludus.Screens.account] unlinking failed", error);
    }
    state.messages.link = result && result.ok ? { kind: "ok", text: t("account.link.unlinked", { name: row.name }) } : { kind: "error", text: authResultMessage(result) };
    state.refocus = "[data-msg=\"link\"]";
    paintSync();
  }

  function linkMessage() {
    const host = h("div", { class: "account-msg-host", "data-msg": "link", role: "status", "aria-live": "polite", tabindex: "-1" });
    paintMessage(host, state.messages.link);
    return host;
  }

  // What the account's Drive already holds (Auth.remoteSummary: a read-only look), asked once per signed-in account while the choice is open. An Auth
  // without it (an older one, a stand-in) is treated as "unknown": the import stays on offer, as before.
  function canProbeRemote() {
    const auth = authApi();
    return Boolean(auth && typeof auth.remoteSummary === "function");
  }

  function loadRemoteSummary(user) {
    const auth = authApi();
    if (!canProbeRemote() || !user) return;
    const sub = String(user.sub || user.email || user.name || "account");
    if (state.remote.sub === sub && state.remote.status !== "idle") return;
    state.remote = { sub, status: "loading", summary: null, error: "" };
    Promise.resolve().then(() => auth.remoteSummary()).then((result) => {
      if (state.remote.sub !== sub) return;
      state.remote = result && result.ok
        ? { sub, status: "done", summary: result, error: "" }
        : { sub, status: "error", summary: null, error: result && result.error ? result.error : "unknown" };
    }).catch((error) => {
      logError("[Ludus.Screens.account] looking at the Drive failed", error);
      if (state.remote.sub === sub) state.remote = { sub, status: "error", summary: null, error: "unknown" };
    }).then(() => {
      if (state.visible && state.remote.sub === sub) paintSync();
    });
  }

  function remoteProfileName() {
    const summary = state.remote.summary;
    const first = summary && Array.isArray(summary.profiles) ? summary.profiles[0] : null;
    return first && first.name ? String(first.name) : "";
  }

  function remoteNote() {
    const remote = state.remote;
    if (remote.status === "loading") return h("p", { class: "account-note account-link-remote", "data-remote": "loading" }, t("account.link.remote.loading"));
    if (remote.status === "error") {
      return h("div", { class: "account-link-remote", "data-remote": "error" },
        h("p", { class: "field-error account-error", role: "alert" }, icon("alert", { size: 16 }), h("span", null, t("account.link.remote.error", { reason: errorMessage(remote.error) }))),
        button(t("account.link.remote.retry"), {
          kind: "ghost", size: "sm", icon: "refresh", dataset: { action: "remote-retry" },
          onClick: () => {
            state.remote = { sub: "", status: "idle", summary: null, error: "" };
            state.refocus = "[data-action=\"link-save\"]";
            paintSync();
          },
        }));
    }
    if (remote.status === "done" && remote.summary) {
      const first = remote.summary.profiles && remote.summary.profiles[0];
      return remote.summary.exists && first
        ? h("p", { class: "account-note account-link-remote", "data-remote": "exists" }, icon("cloud", { size: 16 }),
          h("span", null, t("account.link.remote.exists", { name: first.name || "", positions: tCount("account.profile.positions", Number(first.rounds) || 0) })))
        : h("p", { class: "account-note account-link-remote", "data-remote": "empty" }, t("account.link.remote.empty"));
    }
    return null;
  }

  // First sign-in: pick the profile that will be saved to the Drive, or bring the Drive's progress here. Nothing has been uploaded yet.
  function linkPanel(model) {
    const rows = profileRows();
    if (!rows.length) return null;
    if (!rows.some((row) => row.id === state.linkChoice)) state.linkChoice = (rows.find((row) => row.active) || rows[0]).id;
    loadRemoteSummary(model && model.user);
    const groupName = nextId("account-link");
    const options = rows.map((row) => {
      const radio = h("input", {
        type: "radio", class: "account-link-radio", name: groupName, value: row.id, "data-profile-id": row.id,
        onchange: () => { state.linkChoice = row.id; },
      });
      if (row.id === state.linkChoice) {
        radio.checked = true;
        radio.setAttribute("checked", "");
      }
      const positions = row.positions ? tCount("account.profile.positions", row.positions) : t("account.profile.positions.none");
      return h("label", { class: "account-link-option" }, radio,
        h("span", { class: "account-link-dot", "aria-hidden": "true" }),
        h("span", { class: "account-link-text" },
          h("span", { class: "account-link-name" }, row.name),
          h("span", { class: "account-link-meta" }, row.level && row.level.title ? t("account.link.option.meta", { positions, level: row.level.title }) : positions)));
    });
    const chosen = () => rows.find((row) => row.id === state.linkChoice) || rows[0];
    const save = button(t("account.link.save"), {
      kind: "primary", icon: "cloud", dataset: { action: "link-save" }, busy: state.linkBusy, disabled: state.linkBusy,
      onClick: () => { const row = chosen(); confirmLink(row); },
    });
    // The import is an explicit choice that only makes sense when the Drive holds a profile (or when nobody can tell: an Auth that cannot look).
    const showImport = !canProbeRemote() || (state.remote.status === "done" && state.remote.summary && state.remote.summary.exists);
    const importButton = showImport
      ? button(t("account.link.import"), { kind: "secondary", icon: "download", dataset: { action: "link-import" }, disabled: state.linkBusy, onClick: doImportFromDrive })
      : null;
    return h("div", { class: "account-link", "data-link": "required" },
      h("h3", { class: "account-h3" }, t("account.link.title")),
      h("p", { class: "account-note" }, t("account.link.lead")),
      remoteNote(),
      h("fieldset", { class: "account-fieldset account-link-fieldset" },
        h("legend", { class: "sr-only" }, t("account.link.choose")),
        h("div", { class: "account-link-options", role: "radiogroup", "aria-label": t("account.link.choose") }, options)),
      h("div", { class: "account-actions" }, save, importButton),
      importButton ? h("p", { class: "account-note" }, t("account.link.import.hint")) : null);
  }

  // "Save this profile to my Drive" asks first: its whole history goes to the person's Drive (QA SEC-005), and what the Drive already holds is named.
  function confirmLink(row) {
    const ui = L().ui;
    const remoteName = state.remote.status === "done" && state.remote.summary && state.remote.summary.exists ? remoteProfileName() : "";
    const body = remoteName
      ? h("div", null, h("p", { class: "modal-text" }, t("account.link.confirm.body")), h("p", { class: "modal-text account-note" }, t("account.link.confirm.merge", { name: remoteName })))
      : h("p", { class: "modal-text" }, t("account.link.confirm.body"));
    if (!ui || typeof ui.confirm !== "function") {
      doLink(row.id, row.name);
      return;
    }
    ui.confirm({
      title: t("account.link.confirm.title", { name: row.name }),
      body,
      confirmLabel: t("account.link.confirm.yes"),
      cancelLabel: t("ui.cancel"),
    }).then((yes) => {
      if (yes) doLink(row.id, row.name);
      else {
        state.refocus = "[data-action=\"link-save\"]";
        applyRefocus();
      }
    });
  }

  // After the choice: which profile is synced, and a way to stop.
  function linkedNote(model) {
    const row = model.linked[0];
    return h("div", { class: "account-link", "data-link": "done" },
      h("p", { class: "account-note account-link-synced" }, icon("check", { size: 16 }), h("span", null, t("account.link.synced", { name: row.name }))),
      button(t("account.link.unlink"), {
        kind: "ghost", size: "sm", ariaLabel: t("account.link.unlink.aria", { name: row.name }), dataset: { action: "unlink", id: row.id },
        onClick: () => doUnlink(row),
      }));
  }

  function storedList() {
    return h("div", { class: "account-stored" },
      h("h3", { class: "account-h3" }, t("account.sync.storedTitle")),
      h("ul", { class: "account-stored-list" },
        ["device", "drive", "nothing", "merge"].map((id) => h("li", null, icon(id === "drive" ? "cloud" : id === "device" ? "lock" : id === "merge" ? "refresh" : "shield", { size: 16 }), h("span", null, t(`account.sync.stored.${id}`))))));
  }

  function buildSyncBody() {
    const auth = authApi();
    const model = syncModel(authState());
    const statusText = model.remembered ? t("account.sync.signedOut") : t(`auth.status.${model.status}`);
    const badgeTone = model.tone === "neutral" ? null : model.tone === "danger" ? "danger" : model.tone === "success" ? "success" : model.tone === "warn" ? "warn" : "info";
    const glyph = model.status === "signed_in" ? "check" : model.status === "error" ? "alert" : model.busy ? "refresh" : model.remembered ? "alert" : "lock";
    const status = h("div", { class: "account-sync-status", "data-status": model.status, role: "status", "aria-live": "polite", "aria-label": t("account.sync.statusLabel") },
      h("span", { class: cls("badge", badgeTone && `badge-${badgeTone}`, "account-status-badge") }, icon(glyph, { size: 13 }), statusText));

    const parts = [status];
    if (model.user) parts.push(userBlock(model.user));
    // After a reload the account is only remembered: say so. When the session expired while it was in
    // use, Auth keeps the reason (the same status, with an error code): the reason is the better sentence.
    if (model.remembered && !model.error) parts.push(h("p", { class: "account-note" }, t("account.sync.remembered", { name: model.user && model.user.name ? model.user.name : "" })));
    if ((model.status === "error" || model.remembered) && model.error) {
      parts.push(h("p", { class: "field-error account-error", role: "alert", "data-error": model.error }, icon("alert", { size: 16 }), h("span", null, errorMessage(model.error))));
    }
    if (model.user && model.status !== "error") {
      parts.push(h("p", { class: "account-note", "data-last-sync": String(model.lastSyncAt) },
        model.lastSyncAt ? t("account.sync.last", { when: formatAgo(model.lastSyncAt, Date.now(), lang()) }) : t("account.sync.never")));
    }

    // Choosing what goes to the Drive comes before any sync (QA SEC-005): only for a signed-in account whose session is alive.
    if (!model.user || model.linked.length) {
      // Signed out, or a profile is linked: what the Drive held is no longer news (it is asked again the next time a choice is open).
      if (state.remote.status !== "idle") state.remote = { sub: "", status: "idle", summary: null, error: "" };
    }
    if (model.user && !model.remembered && !model.busy) {
      if (model.linkRequired) {
        const panel = linkPanel(model);
        if (panel) parts.push(panel);
      } else if (model.linked.length) {
        parts.push(linkedNote(model));
      }
    }
    if (model.user) parts.push(linkMessage());

    const actions = h("div", { class: "account-actions" });
    if (model.showSignIn) {
      const signIn = button(t("account.sync.signin"), { kind: "primary", icon: "cloud", dataset: { action: "signin" }, onClick: doSignIn });
      // Google's script is only requested once the person presses the button (pointerdown is the start of that press): never on hover or
      // focus, which would tell Google about a visit that nobody chose (QA SEC-009; docs/GOOGLE_SIGNIN.md).
      const preload = () => {
        try {
          if (auth && typeof auth.preload === "function") auth.preload();
        } catch (error) {
          // the click still loads it
        }
      };
      signIn.addEventListener("pointerdown", preload);
      actions.appendChild(signIn);
    } else if (model.status === "signing_in") {
      actions.appendChild(button(t("account.sync.connecting"), { kind: "primary", busy: true, dataset: { action: "signin" }, onClick: () => {} }));
    }
    if (model.canReconnect) {
      actions.appendChild(button(t("account.sync.reconnect"), { kind: "primary", icon: "refresh", dataset: { action: "reconnect" }, onClick: doSignIn }));
    }
    if (model.status === "syncing") {
      actions.appendChild(button(t("account.sync.syncing"), { kind: "primary", busy: true, dataset: { action: "sync" }, onClick: () => {} }));
    } else if (model.canSync) {
      actions.appendChild(button(model.status === "error" ? t("account.sync.retry") : t("account.sync.now"), { kind: "primary", icon: "refresh", dataset: { action: "sync" }, onClick: doSync }));
    }
    if (model.canSignOut) {
      actions.appendChild(button(t("account.sync.signout"), { kind: "secondary", dataset: { action: "signout" }, onClick: () => doSignOut(false) }));
      actions.appendChild(button(t("account.sync.revoke"), { kind: "ghost", className: "account-danger-text", dataset: { action: "revoke" }, onClick: () => doSignOut(true) }));
    }
    if (actions.children.length) parts.push(actions);
    if (model.canSignOut) parts.push(h("p", { class: "account-note account-revoke-hint" }, t("account.sync.revoke.hint")));
    parts.push(storedList());
    return h("div", { class: "account-sync-body" }, parts);
  }

  function isOwnerContext() {
    try {
      const loc = root.location || {};
      const host = String(loc.hostname || "");
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || /[?&]debug(=|&|$)/.test(String(loc.search || ""));
    } catch (error) {
      return false;
    }
  }

  function buildSync() {
    if (!authConfigured()) {
      return h("section", { class: "card card-flat account-card account-sync-off", "aria-labelledby": "account-sync-off-title", "data-card": "sync-off" },
        h("header", { class: "account-card-head" },
          h("span", { class: "account-card-icon is-quiet", "aria-hidden": "true" }, icon("cloud", { size: 22 })),
          h("div", { class: "account-card-titles" },
            h("h2", { class: "account-h2", id: "account-sync-off-title", tabindex: "-1" }, t("account.sync.off.title")),
            h("p", { class: "account-lead" }, t("account.sync.off.body")))),
        // The site-owner instructions are noise for a player: they show on localhost or with ?debug (QA UX-030).
        isOwnerContext() ? h("p", { class: "account-note" }, t("account.sync.off.owner")) : null,
        isOwnerContext() ? externalLink(`${REPO_BLOB}/docs/GOOGLE_SIGNIN.md`, t("account.sync.off.link")) : null);
    }
    return card(t("account.sync.title"), t("account.sync.lead"), buildSyncBody(), { id: "sync", icon: "cloud", className: "account-sync" });
  }

  function paintSync() {
    const host = state.syncEl;
    if (!host || !getDoc()) return;
    const next = buildSync();
    swap(host, next);
    state.syncEl = next;
    applyRefocus();
  }

  // ----- install -----

  function buildInstall() {
    const mode = currentInstallState();
    const body = h("div", { class: "account-install-body" });
    if (mode === "installed") {
      body.appendChild(h("p", { class: "account-msg is-ok", role: "status" }, icon("check", { size: 16 }), h("span", null, t("account.install.installed"))));
    } else if (mode === "prompt") {
      body.appendChild(button(t("account.install.button"), { kind: "primary", icon: "download", dataset: { action: "install" }, onClick: doInstall }));
    } else if (mode === "ios") {
      body.appendChild(h("p", { class: "account-note account-ios" }, icon("info", { size: 16 }), h("span", null, t("account.install.ios"))));
    } else {
      body.appendChild(h("p", { class: "account-note" }, t("account.install.other")));
    }
    body.appendChild(h("div", { class: "account-msg-host", "data-msg": "install", "aria-live": "polite" }));
    const el = card(t("account.install.title"), t("account.install.lead"), body, { id: "install", icon: "download", className: "account-install" });
    const host = el.querySelector ? el.querySelector("[data-msg=\"install\"]") : null;
    if (host) paintMessage(host, state.messages.install);
    return el;
  }

  function doInstall() {
    const deferred = install.deferred;
    if (!deferred || typeof deferred.prompt !== "function") return;
    let choice;
    try {
      choice = deferred.prompt();
    } catch (error) {
      logError("[Ludus.Screens.account] install prompt failed", error);
      return;
    }
    // The browser lets each captured event be used once.
    install.deferred = null;
    Promise.resolve(deferred.userChoice || choice).then((result) => {
      const accepted = Boolean(result && result.outcome === "accepted");
      state.messages.install = { kind: "ok", text: t(accepted ? "account.install.accepted" : "account.install.dismissed") };
      paintInstall();
    }).catch(() => paintInstall());
  }

  function paintInstall() {
    const host = state.installEl;
    if (!host || !getDoc()) return;
    const next = buildInstall();
    swap(host, next);
    state.installEl = next;
  }

  // ----- about -----

  function buildAbout() {
    const version = L().version;
    const versionText = !version || version === "dev" ? t("account.about.version.dev") : String(version);
    const facts = h("dl", { class: "account-facts" },
      h("div", null, h("dt", null, t("account.about.version")), h("dd", { class: "t-num", "data-about": "version" }, versionText)),
      h("div", null, h("dt", null, t("account.about.licence")), h("dd", { "data-about": "licence" }, LICENCE)),
      h("div", null, h("dt", null, t("account.about.engine")), h("dd", null, t("account.about.engine.value"))));
    const credits = h("div", { class: "account-block" },
      h("h3", { class: "account-h3" }, t("account.about.credits")),
      h("ul", { class: "account-list" },
        h("li", null, t("account.about.credits.pieces")),
        h("li", null, t("account.about.credits.fonts"))));
    const links = h("div", { class: "account-block" },
      h("h3", { class: "account-h3" }, t("account.about.links")),
      h("ul", { class: "account-links" },
        h("li", null, externalLink(REPO_URL, t("account.about.source"))),
        h("li", null, externalLink(`${REPO_BLOB}/THIRD_PARTY_NOTICES.md`, t("account.about.notices"))),
        h("li", null, externalLink(`${REPO_BLOB}/LICENSE`, t("account.about.licenceText")))));
    const privacy = h("div", { class: "account-block" },
      h("h3", { class: "account-h3" }, t("account.privacy.title")),
      h("ul", { class: "account-list account-privacy" }, [1, 2, 3, 4].map((n) => h("li", null, icon("shield", { size: 16 }), h("span", null, t(`account.privacy.${n}`))))));
    const keys = h("div", { class: "account-block account-keys" },
      h("h3", { class: "account-h3" }, t("account.keys.title")),
      h("div", { class: "account-key-groups" }, SHORTCUTS.map((group) => h("div", { class: "account-key-group" },
        h("h4", { class: "account-h4" }, t(`account.keys.${group.id}`)),
        h("dl", { class: "account-key-list" }, group.rows.map((row) => h("div", { class: "account-key-row" },
          h("dt", null, row[0].map((key, index) => [index ? " " : null, h("kbd", { class: "kbd" }, key)])),
          h("dd", null, t(row[1])))))))));
    const body = h("div", { class: "account-about-body" },
      facts,
      h("div", { class: "account-about-grid" }, credits, links, privacy),
      keys);
    return card(t("account.about.title"), t("account.about.lead"), body, { id: "about", icon: "info", className: "account-about" });
  }

  // ---------- Lifecycle ----------

  function render() {
    const doc = getDoc();
    const el = state.el;
    if (!doc || !el || !L().util || typeof L().util.h !== "function") return;
    registerText();
    el.textContent = "";
    el.classList.add("account");
    const build = (fn, name) => {
      try {
        return fn();
      } catch (error) {
        logError(`[Ludus.Screens.account] ${name} failed`, error);
        return null;
      }
    };
    state.profilesEl = build(buildProfiles, "profiles");
    state.dataEl = build(buildData, "data");
    state.syncEl = build(buildSync, "sync");
    state.installEl = build(buildInstall, "install");
    state.aboutEl = build(buildAbout, "about");
    el.appendChild(h("div", { class: "page account-page" },
      h("header", { class: "account-head" },
        h("p", { class: "t-eyebrow account-kicker" }, t("account.eyebrow")),
        h("h1", { class: "screen-title account-title", "data-screen-title": "", tabindex: "-1" }, t("account.heading")),
        h("p", { class: "screen-sub account-sub" }, t("account.sub"))),
      h("div", { class: "account-layout" },
        h("div", { class: "account-col account-col-main" }, state.profilesEl, state.dataEl),
        h("div", { class: "account-col account-col-side" }, state.syncEl, state.installEl)),
      state.aboutEl));
    state.dirty = false;
    applyRefocus();
  }

  // Repaint what changed without losing the rest (an import under review, a message).
  function repaintProfiles() {
    if (!state.el || !getDoc()) return;
    if (!state.profilesEl || !state.profilesEl.parentNode) {
      render();
      return;
    }
    const nextProfiles = buildProfiles();
    swap(state.profilesEl, nextProfiles);
    state.profilesEl = nextProfiles;
    if (state.dataEl && state.dataEl.parentNode) {
      const nextData = buildData();
      swap(state.dataEl, nextData);
      state.dataEl = nextData;
    }
    applyRefocus();
  }

  function subscribe() {
    if (state.offs.length) return;
    const bus = L().bus;
    if (bus && typeof bus.on === "function") {
      state.offs.push(bus.on("language:changed", () => {
        if (state.visible) render();
        else state.dirty = true;
      }));
      state.offs.push(bus.on("profile:changed", () => {
        if (!state.mounted) return;
        if (state.visible) repaintProfiles();
        else state.dirty = true;
      }));
    }
    install.listeners.push(onInstallChange);
    state.offs.push(() => {
      const index = install.listeners.indexOf(onInstallChange);
      if (index >= 0) install.listeners.splice(index, 1);
    });
  }

  function onInstallChange() {
    if (state.visible) paintInstall();
  }

  function subscribeAuth() {
    if (state.offAuth) return;
    const auth = authApi();
    if (!auth || typeof auth.onChange !== "function" || !authConfigured()) return;
    try {
      state.offAuth = auth.onChange(() => {
        if (!state.visible) return;
        paintSync();
        // The "synced" mark of a profile card follows the link (linking, unlinking, signing out).
        const key = linkedIds().join("|");
        if (key !== state.linkedKey) {
          state.linkedKey = key;
          repaintProfiles();
        }
      });
    } catch (error) {
      state.offAuth = null;
    }
  }

  function mount(el) {
    if (!el) return;
    state.el = el;
    state.mounted = true;
    registerText();
    subscribe();
    if (el.classList && typeof el.classList.add === "function") el.classList.add("account");
  }

  function show() {
    state.visible = true;
    if (!state.el) return;
    subscribeAuth();
    try {
      render();
    } catch (error) {
      logError("[Ludus.Screens.account] show failed", error);
    }
  }

  function hide() {
    state.visible = false;
    if (state.offAuth) {
      try {
        state.offAuth();
      } catch (error) {
        // already detached
      }
      state.offAuth = null;
    }
  }

  function destroy() {
    hide();
    state.offs.splice(0).forEach((off) => {
      try {
        if (typeof off === "function") off();
      } catch (error) {
        // already detached
      }
    });
    state.mounted = false;
    state.dirty = true;
    state.importState = null;
    state.messages = { data: null, install: null };
    if (state.el && typeof state.el.textContent !== "undefined") state.el.textContent = "";
  }

  registerText();

  return {
    titleKey: "account.title",
    mount,
    show,
    hide,
    render,
    destroy,
    TEXT,
    helpers: {
      SHORTCUTS,
      REPO_URL,
      STORAGE_LIMIT_BYTES,
      dateStamp,
      slugify,
      exportFileName,
      formatBytes,
      storageUsage,
      normalizeTyped,
      confirmationMatches,
      formatAgo,
      safePictureUrl,
      importCounts,
      importSummaryText,
      profileErrorText,
      installState,
      syncModel,
      tCount,
    },
  };
});
