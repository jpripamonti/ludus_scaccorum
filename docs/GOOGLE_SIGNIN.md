# Google sign-in and Drive sync (optional)

Ludus Scaccorum can sync a player's progress between devices through the
player's **own** Google Drive. It is off until the site owner pastes a Google
OAuth Client ID into `config.js`. This page is the one-time setup for the owner
(jpripamonti), what is stored where, privacy notes, how to revoke, and the
honest limits.

* [English](#english)
* [Español](#español)

---

## English

### What you get

* A "Sign in with Google" button (in the account screen). Nothing is requested
  from Google before somebody presses it, and if `googleClientId` is empty the
  button is hidden and the app is fully local.
* One hidden file, `ludus-progress-v1.json`, in the user's Drive
  **appDataFolder**: a folder only this app (this OAuth client) can see. It is
  not listed in the user's normal Drive.
* Sync = download the file, merge it with the local progress, save what is new
  locally, upload the merged result if it changed. It runs right after signing
  in, and automatically (at most once every 45 seconds) after the profile
  changes while the user is signed in. There is a "Sync now" action too.
* There is **no server of ours**. The browser talks to Google directly.

The code is `js/auth.js`; the contract is section 13 of `docs/ARCHITECTURE.md`.

### One-time setup (about 15 minutes)

You need a Google account and a browser. No billing account and no credit card
are needed for any step below. The console is redesigned from time to time; the
menu names below are the current ones (the "Google Auth Platform" section), but
if a label moved, the concepts are the same.

**1. Create a Google Cloud project**

1. Go to <https://console.cloud.google.com/>.
2. Project picker (top bar) -> **New project**. Name it `Ludus Scaccorum`
   (no organization needed) -> **Create**, then select it.

**2. Enable the Google Drive API**

1. **APIs & Services -> Library**, search for **Google Drive API** -> **Enable**.
2. This step is easy to miss and is required: without it every Drive call fails
   with `403 accessNotConfigured`, even with a valid sign-in. The app then shows
   "Google denied access to Drive".

**3. Configure the consent screen (Google Auth Platform)**

1. **APIs & Services -> OAuth consent screen** (or **Google Auth Platform**).
   If asked to "Get started":
   * **App name**: `Ludus Scaccorum`. **User support email**: your address.
   * **Audience / User type**: **External** (an "Internal" type only exists for
     Google Workspace organizations).
   * **Contact information**: your address.
2. **Branding** (optional): app home page
   `https://jpripamonti.github.io/ludus_scaccorum/`. Leave the logo empty: a logo
   on an external app in production triggers a brand verification review, and
   nothing here needs one.
3. **Data Access** (scopes): add exactly these and nothing else:

   | Scope | Why |
   |---|---|
   | `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` | show the account name, e-mail and photo, and link the local profile to the account |
   | `https://www.googleapis.com/auth/drive.appdata` | read and write the app's own hidden Drive folder |

   All four are **non-sensitive** scopes. `drive.appdata` only reaches the
   app's own hidden folder; it cannot see, list or change any other file in the
   user's Drive. Non-sensitive scopes do not go through Google's sensitive-scope
   verification review.
4. **Audience -> Publishing status**:
   * **Testing** (the default): only the Google accounts listed under **Test
     users** (up to 100) can sign in; everybody else gets "Access blocked". Add
     your own account(s) and try everything first.
   * **In production**: press **Publish app** when you are happy. Any Google
     account can then sign in. Because every scope is non-sensitive there is no
     "unverified app" warning screen for the scopes above.

**4. Create the OAuth Client ID**

1. **Clients -> Create client** (older console: **Credentials -> Create
   credentials -> OAuth client ID**).
2. **Application type**: **Web application**. Name: `Ludus Scaccorum web`.
3. **Authorized JavaScript origins** -> **Add URI**, once for each:
   * `https://jpripamonti.github.io`
   * `http://localhost:5010` (what `npm start` serves; add
     `http://127.0.0.1:5010` too if you open the site that way: it is a
     different origin)

   Origins have no path and no trailing slash. **Authorized redirect URIs**:
   leave empty; the popup flow used here does not use them.
4. **Create**, then copy the **Client ID** (it ends in
   `.apps.googleusercontent.com`). The **client secret** is not needed. Never
   put it in the repository or in `config.js`.
5. New origins can take a few minutes (rarely hours) to start working.

**5. Paste the Client ID into `config.js`**

```js
window.LUDUS_CONFIG = {
  googleClientId: "1234567890-abcdefghijklmnop.apps.googleusercontent.com",
  // ...
};
```

The Client ID is a public identifier, not a secret: it is fine in a public
repository. `Ludus.Auth.isConfigured()` only accepts a value of the form
`<something>.apps.googleusercontent.com`, so a leftover placeholder such as
`YOUR_CLIENT_ID` keeps the feature hidden instead of showing a broken button.
Commit and deploy as usual (`config.js` is part of the versioned build).

**6. Check it works**

1. Open the site (or `npm start` and `http://localhost:5010`), go to the account
   screen, press **Sign in with Google**.
2. The Google window asks to choose an account and shows what the app can do:
   see your name/e-mail/photo, and "see, create and delete its own configuration
   data in your Google Drive". Leave the Drive box ticked.
3. The account chip appears and the status goes "Syncing..." -> "Signed in".
4. To see the file: Google Drive -> gear icon -> **Settings** -> **Manage apps**
   -> **Ludus Scaccorum** -> the hidden app data is listed and can be deleted
   there. (The exact wording depends on Drive's current UI.)

**If something fails**

| What you see | Cause and fix |
|---|---|
| Popup says `origin_mismatch` / "Error 400" | The site origin is not in **Authorized JavaScript origins**. Add the exact origin (scheme + host + port, no path) and wait a few minutes. |
| "Access blocked: ... has not completed the Google verification process" or "... is not registered as a test user" | The app is in **Testing** and the account is not a test user. Add it under Audience -> Test users, or publish the app. |
| App says "Google denied access to Drive" (`403 accessNotConfigured`) | The Drive API is not enabled in this project (step 2). |
| App says the permission was not granted (`scope-denied`) | The user unticked the Drive box in the consent window. Sign in again and leave it ticked. |
| Nothing opens / "browser blocked the Google window" | Pop-ups are blocked for the site. Allow them. |
| "Could not load the Google service" | A content blocker or the network blocks `accounts.google.com`. |
| The Client ID looks right but the button is hidden | It does not end in `.apps.googleusercontent.com`, or `config.js` was not deployed. |

The Content-Security-Policy in `index.html` already allows exactly the Google
origins this needs: `https://accounts.google.com/gsi/client` (script),
`https://accounts.google.com`, `https://oauth2.googleapis.com` and
`https://www.googleapis.com` (connect), `https://*.googleusercontent.com`
(profile photos) and `https://accounts.google.com/gsi/style`. If you tighten
the CSP, keep those.

### What is stored where

| Where | What | Notes |
|---|---|---|
| Browser memory (JS variable) | The Google access token | Never written to storage, gone on reload or sign-out. Lives about one hour. |
| Browser `localStorage`, key `ludus.auth.v1` | `{ v, signedIn, sub, name, picture, lastSyncAt }` | A non-secret hint so the account chip can be drawn after a reload. No token, no e-mail. |
| Browser `localStorage`, keys `ludus.profiles.v1`, `ludus.p.<id>.v1` | The learner's profiles and progress, including the Lichess / Chess.com usernames and game links of own-game rounds (see "Usernames and game links" below) | The source of truth on each device. A profile gets a `googleSub` when it is linked to the account. |
| The user's Google Drive, hidden `appDataFolder` | `ludus-progress-v1.json` | The progress export of the profiles linked to the account (names, colours, rounds with positions and moves, sessions, notebook cards, XP, achievements, daily streak, and the `googleSub`). Rounds from the learner's own Lichess / Chess.com games carry the players' usernames (opponents too) and the links to those games. No e-mail, no token. |
| Google | Sign-in and Drive requests | As with any "Sign in with Google" site, Google sees that this site was used to sign in and receives the Drive calls. |
| GitHub Pages | Ordinary web-server logs | Same as for anybody visiting the site. Nothing from Drive or the progress goes there. |

Which profiles sync: only profiles **linked to the signed-in Google account**,
in both directions. Signing in does **not** link or upload anything by itself:
the first time an account signs in on a device the app asks which local profile
to save to the Drive (or to bring the Drive's progress to the device), so on a
shared device the wrong person's progress cannot be uploaded silently. Other
profiles on the same device (for example the second player of a duel) are not
uploaded, a profile linked to one Google account is never uploaded to a
different account's Drive, and entries of the Drive file that are not linked to
the signed-in account are never imported (a file with more than 16 entries is
refused as invalid). An account has one cloud profile; the contract for the
account screen is in section 13 of `docs/ARCHITECTURE.md`.

### Privacy notes

* **Usernames and game links.** When a learner trains with their own Lichess or
  Chess.com games, every saved round keeps the players' names from the game (the
  learner's username and the opponent's) and the link to the game, and the
  session is titled with the learner's username. This is stored in the local
  profile and notebook, written into every export file, and uploaded to Drive
  in `ludus-progress-v1.json` once the profile is linked. The app has no server,
  so none of it is sent to the site owner; it is only on the learner's device,
  in files the learner downloads, and in the learner's own Drive. The Account
  screen says so too (the export note and the sync notes). To remove it: delete
  the profile (or "Delete all my data") in the Account screen, delete the Drive
  file (see below), and clear the downloaded games in Settings > Privacy.
* Nothing is requested from Google (not even its script) until the user presses
  the sign-in button. With an empty `googleClientId` the feature does not exist.
* The access token stays in memory. After a reload the account chip is shown
  from the small hint, but syncing needs an explicit **Reconnect** click; the app
  never opens a sign-in popup by itself.
* The sign-in identity (name, e-mail, photo) is read from Google and is only used
  to draw the chip and to link the local profile. It is not sent anywhere else.
* Signing out clears the token and the hint immediately and stops automatic
  sync. The Drive file stays where it is (so signing in again restores the
  progress). Signing out with revoke (`Ludus.Auth.signOut({ revoke: true })`)
  also asks Google to revoke the permission.
* If Google asks for a privacy policy URL when you publish, this text is enough
  to adapt: "Ludus Scaccorum runs entirely in your browser. If you choose to sign
  in with Google, the app reads your name, e-mail and photo to show your account,
  and stores your training progress in a hidden file in your own Google Drive that
  only this app can access; if you trained with your own Lichess or Chess.com
  games, that file also holds the usernames of the players in those games
  (yours and your opponents') and links to the games. We operate no server and
  receive none of this data.
  You can disconnect the app at any time from your Google Account permissions and
  delete the file from Google Drive settings."

### How to revoke and delete

* **A user, permission**: <https://myaccount.google.com/permissions> -> Ludus
  Scaccorum -> **Delete all connections** (wording varies). The app can no longer
  reach the Drive data.
* **A user, data**: Google Drive -> **Settings** -> **Manage apps** -> Ludus
  Scaccorum -> delete the hidden app data. Local progress on each device is not
  touched. Local data is deleted in the app: Account > delete a profile or
  "Delete all my data" (usernames and game links go with the profile).
* **The owner, switching the feature off**: empty `googleClientId` in `config.js`
  and redeploy. Existing users keep their local progress; the stale hint is
  ignored and removed the first time the app looks at it.
* **The owner, killing access completely**: delete the OAuth client (or the
  Cloud project) in the console.

### Honest limits

* **No server means we do not verify identity.** The name and photo come from
  Google over TLS, but the app does not verify a signed token, and anybody can
  edit their own `localStorage`. That only affects their own device: what
  actually protects the data is that the Drive `appdata` scope is granted to
  one Google account. Never treat the displayed identity as proof of anything.
* **Sync is best effort, last-write-merge.** The merge is a union (rounds,
  sessions, notebook cards, achievements and XP events from both sides are
  kept). Two devices syncing at the same instant can overwrite each other's
  upload because Drive offers no lock; each then merges again on its next sync,
  so nothing is lost, but it can take one more sync to converge. If two devices
  first-sync at the same moment they may create two files; the next sync merges
  them into the oldest one and deletes the extra.
* **Deletions do not propagate.** Wiping progress on one device does not wipe it
  on the others: a merge brings the data back. Delete the Drive file to reset the
  cloud copy.
* **Caps apply** (recent rounds 600, sessions 200, notebook cards 1000) and the
  file has a 5 MB ceiling; older records fall off the same way they do locally.
* **Tokens are short-lived.** After about an hour the app tries once to renew
  the token silently. Browsers that block third-party cookies or pop-ups can
  refuse that; the account then shows "Reconnect" and one click fixes it. This
  is deliberate: there is never an automatic popup.
* **Browser support**: it needs pop-ups allowed for the site and a browser that
  lets the Google script run. Strict content blockers, some privacy modes and
  in-app browsers break it. The app keeps working fully offline and locally
  either way.
* **Testing status** limits sign-in to your test users (max 100); publish the
  app to open it up.
* **One cloud file per Google account**: switching accounts on a device never
  copies progress from one account into the other.
* **Shared origin on `*.github.io`.** A GitHub Pages user site serves every
  project of the account from ONE origin (`https://<user>.github.io`), and
  browsers isolate storage, service workers and Google OAuth clients by origin,
  not by path. Any other page hosted under the same `<user>.github.io` can read
  this app's `localStorage` (`ludus.profiles.v1`, `ludus.p.<id>.v1`,
  `ludus.auth.v1` with the account's `sub`, name and photo URL) and its
  IndexedDB cache, share its Cache Storage (the service worker only ever deletes
  caches whose name starts with `ludus-scaccorum-`), and can call Google Identity
  with this public client id to get a `drive.appdata` token for the same hidden
  file, because the authorized JavaScript origin is the whole host, not a path.
  Neither the code nor the CSP can change that. Only host other projects you
  trust under that account, or (better, if the progress file matters) serve this
  app from its own origin: a custom domain, or a dedicated user or organisation
  Pages site, and register only that origin in the OAuth client.

---

## Español

### Qué obtenés

* Un botón "Iniciar sesión con Google" (en la pantalla de cuenta). No se le pide
  nada a Google antes de que alguien lo toque, y si `googleClientId` está vacío el
  botón se oculta y la app funciona 100 % en local.
* Un único archivo oculto, `ludus-progress-v1.json`, en la carpeta
  **appDataFolder** del Drive de la persona: una carpeta que solo esta app (este
  cliente OAuth) puede ver. No aparece en el Drive normal.
* Sincronizar = bajar el archivo, combinarlo con el progreso local, guardar
  localmente lo nuevo y subir el resultado combinado si cambió. Corre apenas se
  inicia sesión y, de forma automática (como máximo una vez cada 45 segundos),
  después de que cambia el perfil mientras la sesión está iniciada. También hay
  "Sincronizar ahora".
* **No hay ningún servidor nuestro.** El navegador habla directo con Google.

El código está en `js/auth.js`; el contrato, en la sección 13 de
`docs/ARCHITECTURE.md`.

### Configuración de una sola vez (unos 15 minutos)

Necesitás una cuenta de Google y un navegador. No hace falta cuenta de
facturación ni tarjeta en ningún paso. La consola se rediseña cada tanto; los
nombres de menú de abajo son los actuales (la sección "Google Auth Platform"),
pero si algún rótulo cambió de lugar, los conceptos son los mismos.

**1. Creá un proyecto de Google Cloud**

1. Entrá a <https://console.cloud.google.com/>.
2. Selector de proyecto (barra superior) -> **Proyecto nuevo**. Ponele
   `Ludus Scaccorum` (sin organización) -> **Crear**, y seleccionalo.

**2. Habilitá la API de Google Drive**

1. **APIs y servicios -> Biblioteca**, buscá **Google Drive API** -> **Habilitar**.
2. Es fácil olvidarse y es obligatorio: sin esto todas las llamadas a Drive
   fallan con `403 accessNotConfigured`, aunque el inicio de sesión sea válido. La
   app muestra entonces "Google negó el acceso a Drive".

**3. Configurá la pantalla de consentimiento (Google Auth Platform)**

1. **APIs y servicios -> Pantalla de consentimiento de OAuth** (o **Google Auth
   Platform**). Si te pide "Comenzar":
   * **Nombre de la app**: `Ludus Scaccorum`. **Correo de asistencia**: el tuyo.
   * **Público / Tipo de usuario**: **Externo** (el tipo "Interno" solo existe
     para organizaciones de Google Workspace).
   * **Datos de contacto**: tu correo.
2. **Branding / Marca** (opcional): página principal de la app
   `https://jpripamonti.github.io/ludus_scaccorum/`. Dejá el logo vacío: un logo
   en una app externa en producción dispara una revisión de verificación de marca,
   y acá no hace falta.
3. **Acceso a los datos** (scopes): agregá exactamente estos y ninguno más:

   | Scope | Para qué |
   |---|---|
   | `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` | mostrar nombre, correo y foto de la cuenta, y vincular el perfil local con la cuenta |
   | `https://www.googleapis.com/auth/drive.appdata` | leer y escribir la carpeta oculta propia de la app en Drive |

   Los cuatro son scopes **no sensibles**. `drive.appdata` solo alcanza la
   carpeta oculta de la propia app: no puede ver, listar ni modificar ningún otro
   archivo del Drive de la persona. Los scopes no sensibles no pasan por la
   revisión de verificación de scopes sensibles de Google.
4. **Público -> Estado de publicación**:
   * **En pruebas** (el valor por defecto): solo pueden iniciar sesión las
     cuentas de Google cargadas en **Usuarios de prueba** (hasta 100); el resto ve
     "Acceso bloqueado". Cargá tu(s) cuenta(s) y probá todo primero.
   * **En producción**: cuando estés conforme, tocá **Publicar app**. Desde ahí
     cualquier cuenta de Google puede iniciar sesión. Como todos los scopes son no
     sensibles, no aparece la pantalla de "app no verificada" para los scopes de
     arriba.

**4. Creá el ID de cliente de OAuth**

1. **Clientes -> Crear cliente** (consola vieja: **Credenciales -> Crear
   credenciales -> ID de cliente de OAuth**).
2. **Tipo de aplicación**: **Aplicación web**. Nombre: `Ludus Scaccorum web`.
3. **Orígenes de JavaScript autorizados** -> **Agregar URI**, uno por cada uno:
   * `https://jpripamonti.github.io`
   * `http://localhost:5010` (lo que sirve `npm start`; agregá también
     `http://127.0.0.1:5010` si abrís el sitio así: es otro origen)

   Los orígenes no llevan ruta ni barra final. **URI de redireccionamiento
   autorizados**: dejalo vacío; el flujo con ventana emergente que usa la app no
   los usa.
4. **Crear** y copiá el **ID de cliente** (termina en
   `.apps.googleusercontent.com`). El **secreto de cliente** no hace falta.
   Nunca lo pongas en el repositorio ni en `config.js`.
5. Los orígenes nuevos pueden tardar unos minutos (pocas veces horas) en
   funcionar.

**5. Pegá el ID de cliente en `config.js`**

```js
window.LUDUS_CONFIG = {
  googleClientId: "1234567890-abcdefghijklmnop.apps.googleusercontent.com",
  // ...
};
```

El ID de cliente es un identificador público, no un secreto: está bien en un
repositorio público. `Ludus.Auth.isConfigured()` solo acepta un valor con la
forma `<algo>.apps.googleusercontent.com`, así que un marcador olvidado como
`YOUR_CLIENT_ID` deja la función oculta en vez de mostrar un botón roto.
Commiteá y desplegá como siempre (`config.js` es parte del build versionado).

**6. Verificá que anda**

1. Abrí el sitio (o `npm start` y `http://localhost:5010`), andá a la pantalla de
   cuenta y tocá **Iniciar sesión con Google**.
2. La ventana de Google te pide elegir una cuenta y muestra qué puede hacer la
   app: ver tu nombre, correo y foto, y "ver, crear y borrar sus propios datos de
   configuración en tu Google Drive". Dejá tildada la casilla de Drive.
3. Aparece el chip de la cuenta y el estado pasa de "Sincronizando..." a "Sesión
   iniciada".
4. Para ver el archivo: Google Drive -> ícono de engranaje -> **Configuración**
   -> **Administrar aplicaciones** -> **Ludus Scaccorum** -> ahí se listan los
   datos ocultos de la app y se pueden borrar. (El texto exacto depende de la
   interfaz actual de Drive.)

**Si algo falla**

| Qué ves | Causa y arreglo |
|---|---|
| La ventana dice `origin_mismatch` / "Error 400" | El origen del sitio no está en **Orígenes de JavaScript autorizados**. Agregá el origen exacto (esquema + host + puerto, sin ruta) y esperá unos minutos. |
| "Acceso bloqueado: ... no completó el proceso de verificación de Google" o "... no está registrada como usuario de prueba" | La app está **En pruebas** y la cuenta no es de prueba. Sumala en Público -> Usuarios de prueba, o publicá la app. |
| La app dice "Google negó el acceso a Drive" (`403 accessNotConfigured`) | La API de Drive no está habilitada en este proyecto (paso 2). |
| La app dice que no se dio el permiso (`scope-denied`) | La persona destildó la casilla de Drive en la ventana de consentimiento. Que inicie sesión de nuevo y la deje tildada. |
| No se abre nada / "el navegador bloqueó la ventana de Google" | Las ventanas emergentes están bloqueadas para el sitio. Permitilas. |
| "No pudimos cargar el servicio de Google" | Un bloqueador de contenido o la red bloquea `accounts.google.com`. |
| El ID parece bien pero el botón está oculto | No termina en `.apps.googleusercontent.com`, o `config.js` no se desplegó. |

La Content-Security-Policy de `index.html` ya permite exactamente los orígenes de
Google que hacen falta: `https://accounts.google.com/gsi/client` (script),
`https://accounts.google.com`, `https://oauth2.googleapis.com` y
`https://www.googleapis.com` (conexiones), `https://*.googleusercontent.com`
(fotos de perfil) y `https://accounts.google.com/gsi/style`. Si endurecés la CSP,
mantenelos.

### Qué se guarda y dónde

| Dónde | Qué | Notas |
|---|---|---|
| Memoria del navegador (variable JS) | El token de acceso de Google | Nunca se escribe en el almacenamiento; desaparece al recargar o cerrar sesión. Dura cerca de una hora. |
| `localStorage` del navegador, clave `ludus.auth.v1` | `{ v, signedIn, sub, name, picture, lastSyncAt }` | Una pista no secreta para poder dibujar el chip de la cuenta después de recargar. Sin token, sin correo. |
| `localStorage` del navegador, claves `ludus.profiles.v1`, `ludus.p.<id>.v1` | Los perfiles y el progreso de quien entrena, incluidos los usuarios de Lichess / Chess.com y los enlaces a las partidas de las rondas con partidas propias (ver "Usuarios y enlaces a partidas" más abajo) | Es la fuente de verdad en cada dispositivo. Un perfil recibe un `googleSub` cuando se vincula a la cuenta. |
| Google Drive de la persona, `appDataFolder` oculta | `ludus-progress-v1.json` | La exportación del progreso de los perfiles vinculados a la cuenta (nombres, colores, rondas con posiciones y jugadas, sesiones, tarjetas del cuaderno, XP, logros, racha diaria y el `googleSub`). Las rondas de las partidas propias de Lichess / Chess.com llevan los usuarios de los jugadores (también los de los rivales) y los enlaces a esas partidas. Sin correo, sin token. |
| Google | Pedidos de inicio de sesión y de Drive | Como en cualquier sitio con "Iniciar sesión con Google", Google sabe que se usó este sitio para iniciar sesión y recibe las llamadas a Drive. |
| GitHub Pages | Logs normales de servidor web | Igual que para cualquier visita al sitio. Nada de Drive ni del progreso pasa por ahí. |

Qué perfiles se sincronizan: solo los **vinculados a la cuenta de Google con la
sesión iniciada**, en los dos sentidos. Iniciar sesión **no** vincula ni sube nada
por sí solo: la primera vez que una cuenta inicia sesión en un dispositivo, la app
pregunta qué perfil local guardar en el Drive (o si se trae el progreso del Drive
a este dispositivo), así que en un dispositivo compartido no se puede subir en
silencio el progreso de la persona equivocada. Los demás perfiles del mismo
dispositivo (por ejemplo, el segundo jugador de un duelo) no se suben, un perfil
vinculado a una cuenta de Google nunca se sube al Drive de otra cuenta, y las
entradas del archivo de Drive que no están vinculadas a la cuenta con la sesión
iniciada nunca se importan (un archivo con más de 16 entradas se rechaza por
inválido). Una cuenta tiene un solo perfil en la nube; el contrato para la pantalla
de cuenta está en la sección 13 de `docs/ARCHITECTURE.md`.

### Notas de privacidad

* **Usuarios y enlaces a partidas.** Cuando alguien entrena con sus propias
  partidas de Lichess o Chess.com, cada ronda guardada conserva los nombres de
  los jugadores de esa partida (el usuario de quien entrena y el del rival) y el
  enlace a la partida, y la sesión lleva como título el usuario de quien entrena.
  Esto queda en el perfil y el cuaderno locales, se escribe en cada archivo de
  exportación y se sube a Drive en `ludus-progress-v1.json` cuando el perfil está
  vinculado. La app no tiene servidor: nada de esto le llega al dueño del sitio;
  solo está en el dispositivo, en los archivos que la persona descarga y en su
  propio Drive. La pantalla de Cuenta también lo dice (la nota de exportación y
  las de sincronización). Para quitarlo: borrar el perfil (o "Borrar todos mis
  datos") en la pantalla de Cuenta, borrar el archivo de Drive (ver más abajo) y
  borrar las partidas descargadas en Ajustes > Privacidad.
* No se le pide nada a Google (ni siquiera su script) hasta que la persona toca
  el botón. Con `googleClientId` vacío, la función no existe.
* El token de acceso queda en memoria. Después de recargar se muestra el chip de
  la cuenta a partir de la pista, pero para sincronizar hace falta tocar
  **Reconectar**: la app nunca abre sola una ventana de inicio de sesión.
* La identidad (nombre, correo, foto) se lee de Google y solo se usa para dibujar
  el chip y vincular el perfil local. No se envía a ningún otro lado.
* Cerrar sesión borra al instante el token y la pista, y detiene la sincronización
  automática. El archivo de Drive queda donde está (así, al volver a iniciar
  sesión se recupera el progreso). Cerrar sesión con revocación
  (`Ludus.Auth.signOut({ revoke: true })`) además le pide a Google que revoque el
  permiso.
* Si Google te pide una URL de política de privacidad al publicar, este texto
  sirve de base: "Ludus Scaccorum funciona por completo en tu navegador. Si
  elegís iniciar sesión con Google, la app lee tu nombre, correo y foto para
  mostrar tu cuenta, y guarda tu progreso de entrenamiento en un archivo oculto
  de tu propio Google Drive al que solo puede acceder esta app; si entrenaste con
  tus propias partidas de Lichess o Chess.com, ese archivo también incluye los
  usuarios de los jugadores de esas partidas (el tuyo y los de tus rivales) y los
  enlaces a ellas. No operamos ningún servidor y no recibimos nada de estos datos. Podés desconectar la app en
  cualquier momento desde los permisos de tu Cuenta de Google y borrar el archivo
  desde la configuración de Google Drive."

### Cómo revocar y borrar

* **Una persona usuaria, el permiso**: <https://myaccount.google.com/permissions>
  -> Ludus Scaccorum -> **Eliminar todas las conexiones** (el texto varía). La app
  deja de poder acceder a los datos de Drive.
* **Una persona usuaria, los datos**: Google Drive -> **Configuración** ->
  **Administrar aplicaciones** -> Ludus Scaccorum -> borrar los datos ocultos de
  la app. El progreso local de cada dispositivo no se toca; los datos locales se
  borran en la app: Cuenta > borrar un perfil o "Borrar todos mis datos" (los
  usuarios y los enlaces a partidas se van con el perfil).
* **El dueño, para apagar la función**: vaciá `googleClientId` en `config.js` y
  volvé a desplegar. Quien ya usaba la app conserva su progreso local; la pista
  vieja se ignora y se borra la primera vez que la app la mira.
* **El dueño, para cortar todo el acceso**: borrá el cliente OAuth (o el proyecto
  de Cloud) en la consola.

### Límites, con honestidad

* **Sin servidor no verificamos la identidad.** El nombre y la foto vienen de
  Google por TLS, pero la app no verifica ningún token firmado, y cualquiera puede
  editar su propio `localStorage`. Eso solo afecta su propio dispositivo: lo que
  realmente protege los datos es que el scope `appdata` de Drive se le otorga a
  una cuenta de Google. Nunca tomes la identidad que se muestra como prueba de
  nada.
* **La sincronización es de mejor esfuerzo, fusión "gana el último".** La fusión
  es una unión (se conservan rondas, sesiones, tarjetas del cuaderno, logros y
  eventos de XP de ambos lados). Dos dispositivos que sincronizan en el mismo
  instante pueden pisarse la subida porque Drive no ofrece bloqueo; cada uno
  vuelve a fusionar en su próxima sincronización, así que no se pierde nada, pero
  puede hacer falta una sincronización más para converger. Si dos dispositivos
  sincronizan por primera vez a la vez, pueden crear dos archivos; la siguiente
  sincronización los fusiona en el más antiguo y borra el sobrante.
* **Los borrados no se propagan.** Borrar el progreso en un dispositivo no lo
  borra en los demás: la fusión lo trae de vuelta. Para reiniciar la copia en la
  nube, borrá el archivo de Drive.
* **Hay topes** (rondas recientes 600, sesiones 200, tarjetas del cuaderno 1000)
  y el archivo tiene un techo de 5 MB; los registros más viejos se van cayendo
  igual que en local.
* **Los tokens duran poco.** Pasada más o menos una hora, la app intenta una vez
  renovar el token en silencio. Los navegadores que bloquean cookies de terceros o
  ventanas emergentes pueden negarse; entonces la cuenta muestra "Reconectar" y un
  toque lo arregla. Es a propósito: nunca hay una ventana emergente automática.
* **Navegadores**: hace falta permitir ventanas emergentes para el sitio y un
  navegador que deje correr el script de Google. Los bloqueadores de contenido
  estrictos, algunos modos de privacidad y los navegadores embebidos de otras apps
  lo rompen. La app sigue funcionando completa, sin conexión y en local, en todos
  los casos.
* **El estado "En pruebas"** limita el inicio de sesión a tus usuarios de prueba
  (máx. 100); publicá la app para abrirla a todos.
* **Un archivo en la nube por cuenta de Google**: cambiar de cuenta en un
  dispositivo nunca copia progreso de una cuenta a la otra.
* **Origen compartido en `*.github.io`.** Un sitio de usuario de GitHub Pages sirve
  todos los proyectos de la cuenta desde UN solo origen (`https://<usuario>.github.io`),
  y los navegadores aíslan el almacenamiento, los service workers y los clientes
  OAuth de Google por origen, no por ruta. Cualquier otra página alojada bajo el
  mismo `<usuario>.github.io` puede leer el `localStorage` de esta app
  (`ludus.profiles.v1`, `ludus.p.<id>.v1`, `ludus.auth.v1` con el `sub`, el nombre
  y la URL de la foto de la cuenta) y su caché de IndexedDB, comparte su Cache
  Storage (el service worker solo borra cachés cuyo nombre empieza con
  `ludus-scaccorum-`) y puede llamar a Google Identity con este client id público
  para obtener un token de `drive.appdata` del mismo archivo oculto, porque el
  origen de JavaScript autorizado es todo el host, no una ruta. Ni el código ni la
  CSP pueden cambiarlo. Alojá bajo esa cuenta solo proyectos en los que confíes o
  (mejor, si el archivo de progreso importa) servila desde su propio origen: un
  dominio propio o un sitio de Pages de usuario u organización dedicado, y
  registrá solo ese origen en el cliente OAuth.
