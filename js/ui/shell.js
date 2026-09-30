// App shell (Ludus.shell): the top bar, the primary navigation, the profile
// chip with its popover, the streak, and the bottom tab bar on phones.
// Contract: docs/ARCHITECTURE.md sections 15 and 20; styles in css/shell.css
// (prefix .sh-).
//
//   Ludus.shell.mount(appEl)     enhances the header that index.html ships
//                                (#shell-header, #shell-nav, #shell-status and the
//                                #language-switch group app.js binds), builds the
//                                bottom tab bar, subscribes to the bus. Idempotent.
//   Ludus.shell.update()         re-reads profile / notebook / language and repaints
//   Ludus.shell.setVisible(bool) manual show / hide (it also hides itself on the
//                                play screen: body[data-screen="game"])
//   Ludus.shell.destroy()        detaches every listener (tests)
//
// Routing: nav links call Ludus.router.show(id). A tiny hash router understands
// "#/home|classics|notebook|progress|museum|settings|account" (and "#/daily",
// which opens the home screen and starts the daily challenge) on load and on
// hashchange, and mirrors the current screen back into the hash with
// replaceState (no history entries: Ludus.router keeps its own back stack).
//
// The shell sets document.body.dataset.screen on every "screen:changed" and
// document.body.dataset.shell = "on" | "off" (used by the CSS for the bottom
// padding and the toast offset). Everything is built with Ludus.util.h and
// degrades to a no-op without a DOM.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.shell = api;
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

  function icon(name, options) {
    const ui = L().ui;
    return ui && typeof ui.icon === "function" ? ui.icon(name, options) : null;
  }

  // ---------- Text ----------

  const TEXT = {
    es: {
      "shell.skip": "Saltar al contenido",
      "shell.brand": "Ludus Scaccorum, ir al inicio",
      "shell.nav.label": "Principal",
      "shell.nav.home": "Inicio",
      "shell.nav.classics": "Clásicos",
      "shell.nav.notebook": "Cuaderno",
      "shell.nav.progress": "Progreso",
      "shell.nav.history": "Historia",
      "shell.nav.more": "Más",
      "shell.nav.settings": "Ajustes",
      "shell.nav.account": "Cuenta",
      "shell.more.title": "Más",
      "shell.notebook.due": "{n} para repasar",
      "shell.streak.label": "Racha de {n} días",
      "shell.streak.label.one": "Racha de 1 día",
      "shell.streak.none": "Sin racha todavía",
      "shell.streak.risk": "Entrená hoy para mantener la racha",
      "shell.profile.button": "Perfil de {name}, {level}",
      "shell.profile.title": "Perfiles de este dispositivo",
      "shell.profile.switchTo": "Jugar como {name}",
      "shell.profile.active": "Perfil activo",
      "shell.profile.xp": "{xp} XP · faltan {next} para el siguiente nivel",
      "shell.profile.xpMax": "{xp} XP · nivel máximo",
      "shell.profile.add": "Agregar perfil",
      "shell.profile.full": "Máximo {max} perfiles",
      "shell.profile.account": "Cuenta y datos",
      "shell.profile.addTitle": "Nuevo perfil",
      "shell.profile.nameLabel": "Nombre",
      "shell.profile.nameHint": "Cada perfil guarda su propio progreso en este dispositivo.",
      "shell.profile.create": "Crear perfil",
      "shell.profile.created": "Perfil creado: {name}",
      "shell.profile.switched": "Ahora jugás como {name}",
      "shell.profile.error.limit": "Ya hay {max} perfiles. Borrá uno desde Cuenta para crear otro.",
      "shell.profile.error.invalid-name": "Escribí un nombre para el perfil.",
      "shell.profile.error.storage": "No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.",
      "shell.profile.error.generic": "No se pudo crear el perfil.",
      "shell.profile.default": "Participante",
      "shell.storage.blocked.title": "El navegador no deja guardar tu progreso",
      "shell.storage.blocked.body": "Este sitio no puede guardar datos acá (una pestaña privada, o los datos del sitio están bloqueados). Podés seguir jugando, pero las rondas, el cuaderno y las rachas se pierden al cerrar la pestaña.",
      "shell.storage.quota.title": "Tu progreso no se está guardando",
      "shell.storage.quota.body": "El almacenamiento del navegador está lleno, así que lo último que jugaste puede no haberse guardado. Descargá una copia desde Cuenta y liberá espacio de este sitio para seguir guardando.",
      "shell.storage.account": "Ir a Cuenta",
      "shell.storage.dismiss": "Entendido",
      "shell.storage.region": "Aviso de almacenamiento",
      "shell.settings": "Ajustes",
    },
    en: {
      "shell.skip": "Skip to content",
      "shell.brand": "Ludus Scaccorum, go to home",
      "shell.nav.label": "Main",
      "shell.nav.home": "Home",
      "shell.nav.classics": "Classics",
      "shell.nav.notebook": "Notebook",
      "shell.nav.progress": "Progress",
      "shell.nav.history": "History",
      "shell.nav.more": "More",
      "shell.nav.settings": "Settings",
      "shell.nav.account": "Account",
      "shell.more.title": "More",
      "shell.notebook.due": "{n} to review",
      "shell.streak.label": "{n}-day streak",
      "shell.streak.label.one": "1-day streak",
      "shell.streak.none": "No streak yet",
      "shell.streak.risk": "Train today to keep your streak",
      "shell.profile.button": "{name}'s profile, {level}",
      "shell.profile.title": "Profiles on this device",
      "shell.profile.switchTo": "Play as {name}",
      "shell.profile.active": "Active profile",
      "shell.profile.xp": "{xp} XP · {next} to the next level",
      "shell.profile.xpMax": "{xp} XP · top level",
      "shell.profile.add": "Add profile",
      "shell.profile.full": "{max} profiles at most",
      "shell.profile.account": "Account and data",
      "shell.profile.addTitle": "New profile",
      "shell.profile.nameLabel": "Name",
      "shell.profile.nameHint": "Each profile keeps its own progress on this device.",
      "shell.profile.create": "Create profile",
      "shell.profile.created": "Profile created: {name}",
      "shell.profile.switched": "You are now playing as {name}",
      "shell.profile.error.limit": "There are already {max} profiles. Delete one from Account to create another.",
      "shell.profile.error.invalid-name": "Type a name for the profile.",
      "shell.profile.error.storage": "Could not save: browser storage is full or blocked.",
      "shell.profile.error.generic": "The profile could not be created.",
      "shell.profile.default": "Player",
      "shell.storage.blocked.title": "Your browser is not saving your progress",
      "shell.storage.blocked.body": "This site cannot store data here (a private tab, or site data is blocked). You can keep playing, but rounds, notebook and streaks are lost when you close the tab.",
      "shell.storage.quota.title": "Your progress is not being saved",
      "shell.storage.quota.body": "Browser storage is full, so your latest rounds may not have been saved. Download a copy from Account and free some space for this site to keep saving.",
      "shell.storage.account": "Go to Account",
      "shell.storage.dismiss": "Got it",
      "shell.storage.region": "Storage notice",
      "shell.settings": "Settings",
    },
  };

  function registerText() {
    const i18n = L().i18n;
    if (i18n && typeof i18n.register === "function") i18n.register(TEXT);
  }
  registerText();

  // ---------- Routes ----------

  const NAV_ITEMS = [
    { id: "home", icon: "home", key: "shell.nav.home" },
    { id: "classics", icon: "columns", key: "shell.nav.classics" },
    { id: "notebook", icon: "book", key: "shell.nav.notebook", badge: true },
    { id: "progress", icon: "chart", key: "shell.nav.progress" },
    { id: "museum", icon: "history", key: "shell.nav.history" },
  ];
  const TAB_ITEMS = NAV_ITEMS.filter((item) => item.id !== "museum");
  const MORE_ITEMS = [
    { id: "museum", icon: "history", key: "shell.nav.history" },
    { id: "settings", icon: "settings", key: "shell.nav.settings" },
    { id: "account", icon: "user", key: "shell.nav.account" },
  ];
  const HASH_ROUTES = ["home", "classics", "notebook", "progress", "museum", "settings", "account", "daily"];
  const MORE_IDS = MORE_ITEMS.map((item) => item.id);
  const HIDDEN_ON = ["game"];
  const MINIMAL_ON = ["landing"];

  // "#/classics" -> { id: "classics" }; anything else -> null.
  function parseHash(hash) {
    // Case does not matter for a typed or pasted address ("#/NOTEBOOK").
    const match = /^#\/([a-z]+)\/?$/.exec(String(hash || "").toLowerCase());
    return match && HASH_ROUTES.includes(match[1]) ? { id: match[1] } : null;
  }

  // ---------- State ----------

  const state = {
    mounted: false,
    header: null,
    nav: null,
    status: null,
    tabbar: null,
    refs: {},
    visible: true,
    screen: null,
    popoverOpen: false,
    offs: [],
    domOffs: [],
    scheduled: false,
    popoverId: 0,
    bannerDismissed: "",
  };

  // ---------- Data ----------

  function profileApi() {
    return L().Profile || null;
  }

  function readProfile() {
    const Profile = profileApi();
    const out = { profile: null, profiles: [], stats: null, due: 0 };
    if (!Profile) return out;
    try {
      out.profile = typeof Profile.ensureActive === "function" ? Profile.ensureActive() : Profile.active();
      out.profiles = Profile.list();
      out.stats = Profile.stats();
      const counts = Profile.notebook && Profile.notebook.counts ? Profile.notebook.counts() : null;
      out.due = counts ? counts.due : 0;
    } catch (error) {
      if (root.console && root.console.error) root.console.error("[Ludus.shell] reading the profile failed", error);
    }
    return out;
  }

  function currentLevelTitle(data) {
    if (data.stats && data.stats.level && data.stats.level.title) return data.stats.level.title;
    return "";
  }

  // ---------- Building blocks ----------

  function guardGame() {
    const game = L().game;
    return Boolean(game && typeof game.isActive === "function" && game.isActive());
  }

  function go(id) {
    const router = L().router;
    if (!router || typeof router.show !== "function") return false;
    return router.show(id) !== false;
  }

  // Every way out of the play screen (nav links, the tab bar, the brand, the "More" sheet
  // and the hash router) ends here: while a session is running, leaving asks the same
  // confirmation as its exit button (Ludus.game.leave), and only a "yes" goes on. Without
  // a session it is just the navigation. Resolves to whether `next` ran.
  function leaveGameThen(next) {
    if (!guardGame()) {
      next();
      return Promise.resolve(true);
    }
    const game = L().game;
    if (!game || typeof game.leave !== "function") return Promise.resolve(false);
    let asked;
    try {
      asked = Promise.resolve(game.leave());
    } catch (error) {
      return Promise.resolve(false);
    }
    return asked.then((left) => {
      if (left) next();
      else mirrorHash(state.screen);
      return Boolean(left);
    }, () => false);
  }

  function isModifiedClick(event) {
    return Boolean(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (typeof event.button === "number" && event.button > 0)));
  }

  function onNavigate(id) {
    return (event) => {
      if (isModifiedClick(event)) return;
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      closePopover(false);
      leaveGameThen(() => go(id));
    };
  }

  function navLink(item, extraClass) {
    const badge = item.badge
      ? h("span", { class: "badge badge-count sh-badge", "aria-hidden": "true", hidden: true })
      : null;
    const badgeText = item.badge ? h("span", { class: "sr-only sh-badge-text" }) : null;
    const link = h("a", { class: `sh-nav-link ${extraClass || ""}`.trim(), href: `#/${item.id}`, "data-nav": item.id, onclick: onNavigate(item.id) },
      h("span", { class: "sh-nav-icon" }, icon(item.icon, { size: extraClass === "sh-tab" ? 22 : 18 }), extraClass === "sh-tab" ? badge : null),
      h("span", { class: "sh-nav-label" }, t(item.key)),
      extraClass === "sh-tab" ? null : badge,
      badgeText);
    return { link, badge, badgeText, item };
  }

  function buildNav() {
    const doc = getDoc();
    if (!doc || !state.nav) return;
    while (state.nav.firstChild) state.nav.removeChild(state.nav.firstChild);
    state.nav.setAttribute("aria-label", t("shell.nav.label"));
    state.refs.navLinks = NAV_ITEMS.map((item) => {
      const built = navLink(item, "");
      state.nav.appendChild(built.link);
      return built;
    });
  }

  function buildTabbar() {
    const doc = getDoc();
    if (!doc || !doc.body) return;
    if (state.tabbar && state.tabbar.parentNode) state.tabbar.parentNode.removeChild(state.tabbar);
    const tabs = TAB_ITEMS.map((item) => navLink(item, "sh-tab"));
    const more = h("button", {
      type: "button",
      class: "sh-nav-link sh-tab sh-more",
      "aria-haspopup": "dialog",
      "data-nav": "more",
      onclick: () => openMore(),
    }, h("span", { class: "sh-nav-icon" }, icon("more", { size: 22 })), h("span", { class: "sh-nav-label" }, t("shell.nav.more")));
    state.refs.tabLinks = tabs;
    state.refs.moreButton = more;
    state.tabbar = h("nav", { class: "sh-tabbar", id: "shell-tabbar", "aria-label": t("shell.nav.label") }, tabs.map((entry) => entry.link), more);
    doc.body.appendChild(state.tabbar);
  }

  function openMore() {
    const ui = L().ui;
    if (!ui || typeof ui.sheet !== "function") return;
    let handle = null;
    const rows = MORE_ITEMS.map((item) => h("button", {
      type: "button",
      class: "sh-more-item",
      onclick: () => {
        if (handle) handle.close("navigate");
        leaveGameThen(() => go(item.id));
      },
    }, h("span", { class: "sh-more-icon", "aria-hidden": "true" }, icon(item.icon, { size: 22 })),
    h("span", { class: "sh-more-label" }, t(item.key)),
    h("span", { class: "sh-more-go", "aria-hidden": "true" }, icon("chevron-right", { size: 18 }))));
    handle = ui.sheet({ title: t("shell.more.title"), size: "sm", body: h("div", { class: "sh-more-list" }, rows) });
  }

  // ---------- Profile chip and popover ----------

  function chipParts(data) {
    const profile = data.profile;
    const name = profile ? profile.name : t("shell.profile.default");
    const level = data.stats && data.stats.level ? data.stats.level : null;
    return { profile, name, level, levelTitle: currentLevelTitle(data) };
  }

  function buildStatus() {
    const ui = L().ui;
    if (!state.status || !ui) return;
    const data = readProfile();
    const { profile, name, level, levelTitle } = chipParts(data);
    while (state.status.firstChild) state.status.removeChild(state.status.firstChild);

    const streakDays = data.stats && data.stats.streak ? data.stats.streak.current : 0;
    const atRisk = Boolean(data.stats && data.stats.streak && data.stats.streak.atRisk);
    const streakLabel = streakDays > 0
      ? (streakDays === 1 ? t("shell.streak.label.one") : t("shell.streak.label", { n: streakDays }))
      : t("shell.streak.none");
    const streak = h("a", {
      class: `sh-streak${streakDays > 0 ? " is-lit" : ""}${atRisk ? " is-risk" : ""}`,
      href: "#/progress",
      "aria-label": atRisk ? `${streakLabel}. ${t("shell.streak.risk")}` : streakLabel,
      title: atRisk ? t("shell.streak.risk") : streakLabel,
      onclick: onNavigate("progress"),
    }, icon("flame", { size: 18 }), h("span", { class: "sh-streak-n" }, String(streakDays)));

    const popoverId = `sh-pop-${state.popoverId += 1}`;
    const progress = level ? Math.round(Math.max(0, Math.min(1, level.progress || 0)) * 100) : 0;
    const chip = h("button", {
      type: "button",
      class: "sh-profile-chip",
      "aria-haspopup": "dialog",
      "aria-expanded": state.popoverOpen ? "true" : "false",
      // Only while the popover is open: a collapsed popover is hidden and axe cannot resolve a reference to it.
      "aria-controls": state.popoverOpen ? popoverId : null,
      "aria-label": t("shell.profile.button", { name, level: levelTitle || "" }).replace(/,\s*$/, ""),
      onclick: () => togglePopover(),
    }, ui.avatar(profile || { name, color: "#2b5f8a" }, { size: 34 }),
    h("span", { class: "sh-profile-text" },
      h("span", { class: "sh-profile-name" }, name),
      h("span", { class: "sh-profile-level" }, levelTitle),
      h("span", { class: "sh-xp", "aria-hidden": "true" }, h("span", { class: "sh-xp-bar", style: { width: `${progress}%` } }))),
    h("span", { class: "sh-profile-caret", "aria-hidden": "true" }, icon("chevron-down", { size: 14 })));

    const popover = h("div", { class: "sh-pop", id: popoverId, role: "dialog", "aria-label": t("shell.profile.title"), hidden: !state.popoverOpen });
    const settings = h("a", {
      class: "sh-icon-btn sh-settings",
      href: "#/settings",
      "aria-label": t("shell.nav.settings"),
      title: t("shell.nav.settings"),
      "data-nav": "settings",
      onclick: onNavigate("settings"),
    }, icon("settings", { size: 20 }));

    const profileWrap = h("div", { class: "sh-profile" }, chip, popover);
    state.refs.chip = chip;
    state.refs.popover = popover;
    state.refs.profileWrap = profileWrap;
    state.refs.settingsLink = settings;
    state.status.appendChild(streak);
    state.status.appendChild(profileWrap);
    state.status.appendChild(settings);
    if (state.popoverOpen) fillPopover(data);
  }

  function fillPopover(dataArg) {
    const popover = state.refs.popover;
    const ui = L().ui;
    if (!popover || !ui) return;
    const data = dataArg || readProfile();
    while (popover.firstChild) popover.removeChild(popover.firstChild);
    const Profile = profileApi();
    const max = Profile && Profile.constants ? Profile.constants.MAX_PROFILES : 4;
    const activeId = data.profile ? data.profile.id : null;
    const rows = data.profiles.map((entry) => {
      const isActive = entry.id === activeId;
      const stats = isActive ? data.stats : safeStats(entry.id);
      const levelText = stats && stats.level ? stats.level.title : "";
      return h("li", null, h("button", {
        type: "button",
        class: `sh-pop-row${isActive ? " is-active" : ""}`,
        "aria-current": isActive ? "true" : null,
        "aria-label": isActive ? `${entry.name}, ${t("shell.profile.active")}` : t("shell.profile.switchTo", { name: entry.name }),
        onclick: () => switchProfile(entry),
      }, ui.avatar(entry, { size: 36 }),
      h("span", { class: "sh-pop-who" }, h("span", { class: "sh-pop-name" }, entry.name), h("span", { class: "sh-pop-level" }, levelText)),
      isActive ? h("span", { class: "sh-pop-check", "aria-hidden": "true" }, icon("check", { size: 18 })) : null));
    });
    const full = data.profiles.length >= max;
    const info = data.stats && data.stats.level
      ? (data.stats.level.max
        ? t("shell.profile.xpMax", { xp: data.stats.xp })
        : t("shell.profile.xp", { xp: data.stats.xp, next: data.stats.level.xpToNext }))
      : "";
    popover.appendChild(h("p", { class: "sh-pop-title" }, t("shell.profile.title")));
    popover.appendChild(h("ul", { class: "sh-pop-list" }, rows));
    if (info) popover.appendChild(h("p", { class: "sh-pop-xp" }, info));
    popover.appendChild(h("div", { class: "sh-pop-actions" },
      h("button", {
        type: "button",
        class: "btn btn-secondary btn-sm sh-pop-add",
        disabled: full,
        title: full ? t("shell.profile.full", { max }) : null,
        onclick: () => {
          closePopover(false);
          openAddProfile();
        },
      }, icon("plus", { size: 16 }), h("span", { class: "btn-label" }, full ? t("shell.profile.full", { max }) : t("shell.profile.add"))),
      h("a", { class: "btn btn-ghost btn-sm sh-pop-account", href: "#/account", onclick: onNavigate("account") }, icon("user", { size: 16 }), h("span", { class: "btn-label" }, t("shell.profile.account"))),
      // The gear leaves the header on narrow screens; this row keeps Settings one tap away.
      h("a", { class: "btn btn-ghost btn-sm sh-pop-settings", href: "#/settings", onclick: onNavigate("settings") }, icon("settings", { size: 16 }), h("span", { class: "btn-label" }, t("shell.nav.settings")))));
  }

  function safeStats(id) {
    try {
      return profileApi().stats(id);
    } catch (error) {
      return null;
    }
  }

  function switchProfile(entry) {
    const Profile = profileApi();
    if (!Profile) return;
    const already = Profile.active() && Profile.active().id === entry.id;
    if (!already && !Profile.setActive(entry.id)) return;
    closePopover(true);
    if (!already) {
      const ui = L().ui;
      if (ui && ui.toast) ui.toast(t("shell.profile.switched", { name: entry.name }), { kind: "success", duration: 3200 });
    }
  }

  function togglePopover() {
    if (state.popoverOpen) closePopover(true);
    else openPopover();
  }

  function onDocumentPointer(event) {
    const wrap = state.refs.profileWrap;
    if (!state.popoverOpen || !wrap) return;
    if (event && event.target && typeof wrap.contains === "function" && wrap.contains(event.target)) return;
    closePopover(false);
  }

  function onPopoverKeydown(event) {
    if (event && event.key === "Escape" && state.popoverOpen) {
      if (typeof event.stopPropagation === "function") event.stopPropagation();
      closePopover(true);
    }
  }

  function onPopoverFocusOut(event) {
    const wrap = state.refs.profileWrap;
    if (!state.popoverOpen || !wrap || !event) return;
    const next = event.relatedTarget;
    // relatedTarget is null when the window loses focus or a tap lands on
    // non-focusable content; the pointer handler covers those.
    if (next && typeof wrap.contains === "function" && !wrap.contains(next)) closePopover(false);
  }

  function openPopover() {
    const chip = state.refs.chip;
    const popover = state.refs.popover;
    if (!chip || !popover) return;
    state.popoverOpen = true;
    fillPopover();
    popover.hidden = false;
    popover.removeAttribute("hidden");
    chip.setAttribute("aria-expanded", "true");
    const popoverId = typeof popover.getAttribute === "function" ? popover.getAttribute("id") : popover.id;
    if (popoverId) chip.setAttribute("aria-controls", popoverId);
    const doc = getDoc();
    if (doc && typeof doc.addEventListener === "function") {
      doc.addEventListener("pointerdown", onDocumentPointer, true);
      state.refs.docPointer = onDocumentPointer;
    }
    state.refs.profileWrap.addEventListener("keydown", onPopoverKeydown);
    state.refs.profileWrap.addEventListener("focusout", onPopoverFocusOut);
    const first = typeof popover.querySelector === "function" ? popover.querySelector(".sh-pop-row.is-active") || popover.querySelector("button") : null;
    if (first && typeof first.focus === "function") first.focus();
  }

  function closePopover(restoreFocus) {
    if (!state.popoverOpen) return;
    state.popoverOpen = false;
    const { chip, popover, profileWrap } = state.refs;
    if (popover) popover.hidden = true;
    if (chip) {
      chip.setAttribute("aria-expanded", "false");
      chip.removeAttribute("aria-controls");
    }
    const doc = getDoc();
    if (doc && typeof doc.removeEventListener === "function") doc.removeEventListener("pointerdown", onDocumentPointer, true);
    if (profileWrap) {
      profileWrap.removeEventListener("keydown", onPopoverKeydown);
      profileWrap.removeEventListener("focusout", onPopoverFocusOut);
    }
    if (restoreFocus && chip && typeof chip.focus === "function") chip.focus();
  }

  function openAddProfile() {
    const ui = L().ui;
    const Profile = profileApi();
    if (!ui || !Profile) return;
    const inputId = "sh-new-profile-name";
    const hintId = "sh-new-profile-hint";
    const errorId = "sh-new-profile-error";
    const input = h("input", {
      id: inputId,
      class: "input",
      type: "text",
      maxlength: 24,
      autocomplete: "off",
      spellcheck: "false",
      "aria-describedby": `${hintId} ${errorId}`,
    });
    const error = h("p", { class: "field-error", id: errorId, hidden: true, role: "alert" });
    let handle = null;

    function showError(text) {
      error.textContent = text;
      error.hidden = false;
      error.removeAttribute("hidden");
      input.setAttribute("aria-invalid", "true");
      if (typeof input.focus === "function") input.focus();
    }

    function create() {
      const name = String(input.value || "").trim();
      if (!name) {
        showError(t("shell.profile.error.invalid-name"));
        return false;
      }
      const created = Profile.create({ name });
      if (!created) {
        const code = typeof Profile.lastError === "function" ? Profile.lastError() : "";
        const max = Profile.constants ? Profile.constants.MAX_PROFILES : 4;
        const key = `shell.profile.error.${code}`;
        showError(L().i18n.has(key) ? t(key, { max }) : t("shell.profile.error.generic"));
        return false;
      }
      Profile.setActive(created.id);
      if (handle) handle.close("created");
      if (ui.toast) ui.toast(t("shell.profile.created", { name: created.name }), { kind: "success", duration: 3200 });
      return true;
    }

    const form = h("form", { class: "field", novalidate: true, onsubmit: (event) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      create();
    } },
    h("label", { for: inputId }, t("shell.profile.nameLabel")),
    input,
    h("p", { class: "field-hint", id: hintId }, t("shell.profile.nameHint")),
    error);

    handle = ui.modal({
      title: t("shell.profile.addTitle"),
      size: "sm",
      body: form,
      initialFocus: input,
      actions: [
        { label: t("shell.profile.create"), kind: "primary", onClick: () => { create(); return false; } },
        { label: L().i18n.t("ui.cancel"), kind: "ghost", value: "cancel" },
      ],
    });
  }

  // ---------- Painting ----------

  function paintActive() {
    const current = state.screen;
    const mark = (entry) => {
      const active = entry.item.id === current;
      if (active) entry.link.setAttribute("aria-current", "page");
      else entry.link.removeAttribute("aria-current");
      entry.link.classList.toggle("is-active", active);
    };
    (state.refs.navLinks || []).forEach(mark);
    (state.refs.tabLinks || []).forEach(mark);
    if (state.refs.moreButton) state.refs.moreButton.classList.toggle("is-active", MORE_IDS.includes(current));
    if (state.refs.settingsLink) {
      const on = current === "settings";
      state.refs.settingsLink.classList.toggle("is-active", on);
      if (on) state.refs.settingsLink.setAttribute("aria-current", "page");
      else state.refs.settingsLink.removeAttribute("aria-current");
    }
  }

  function paintBadges(due) {
    const text = due > 99 ? "99+" : String(due);
    [].concat(state.refs.navLinks || [], state.refs.tabLinks || []).forEach((entry) => {
      if (!entry.badge) return;
      entry.badge.textContent = text;
      entry.badge.hidden = due <= 0;
      if (due > 0) entry.badge.removeAttribute("hidden");
      if (entry.badgeText) entry.badgeText.textContent = due > 0 ? ` (${t("shell.notebook.due", { n: due })})` : "";
    });
  }

  function paintLabels() {
    const set = (entries) => (entries || []).forEach((entry) => {
      const label = typeof entry.link.querySelector === "function" ? entry.link.querySelector(".sh-nav-label") : null;
      if (label) label.textContent = t(entry.item.key);
    });
    set(state.refs.navLinks);
    set(state.refs.tabLinks);
    if (state.nav) state.nav.setAttribute("aria-label", t("shell.nav.label"));
    if (state.tabbar) state.tabbar.setAttribute("aria-label", t("shell.nav.label"));
    if (state.refs.moreButton) {
      const label = state.refs.moreButton.querySelector(".sh-nav-label");
      if (label) label.textContent = t("shell.nav.more");
    }
    const brand = state.header && typeof state.header.querySelector === "function" ? state.header.querySelector("#shell-brand") : null;
    if (brand) brand.setAttribute("aria-label", t("shell.brand"));
    const skip = getDoc() && typeof getDoc().querySelector === "function" ? getDoc().querySelector(".skip-link") : null;
    if (skip) skip.textContent = t("shell.skip");
    paintSkipTarget();
  }

  // ---------- Storage warning (UX-007, PERF-009) ----------

  // When the browser refuses to store anything (private tab, blocked site data, a full quota) the app keeps working
  // and keeps celebrating, but nothing is saved. Profile reports it (storageStatus() and the once-per-load bus event
  // "storage:failed"); this is the place that says so, plainly and persistently, under the header of every screen but
  // the play screen. It is a polite live region that exists from the start so that its text is announced when it fills.
  function storageStatus() {
    const Profile = profileApi();
    try {
      return Profile && typeof Profile.storageStatus === "function" ? Profile.storageStatus() : null;
    } catch (error) {
      return null;
    }
  }

  function ensureBanner() {
    const doc = getDoc();
    if (state.refs.banner && state.refs.banner.parentNode) return state.refs.banner;
    if (!doc || !state.header || !state.header.parentNode) return null;
    const banner = h("div", { class: "sh-banner-region", id: "shell-banner", role: "status", "aria-live": "polite", "aria-label": t("shell.storage.region") });
    state.header.parentNode.insertBefore(banner, state.header.nextSibling);
    state.refs.banner = banner;
    return banner;
  }

  function paintStorageBanner() {
    const banner = ensureBanner();
    if (!banner) return;
    const status = storageStatus();
    const reason = status && !status.ok ? (status.reason === "blocked" ? "blocked" : "quota") : "";
    const key = reason && state.bannerDismissed !== reason ? `${reason}:${t("shell.storage.dismiss")}` : "";
    if (state.refs.bannerKey === key) return;
    state.refs.bannerKey = key;
    while (banner.firstChild) banner.removeChild(banner.firstChild);
    if (!key) return;
    const actions = [];
    // A full quota can still be exported; with blocked storage there is nothing saved to download.
    if (reason === "quota") {
      actions.push(h("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: () => leaveGameThen(() => go("account")) }, h("span", { class: "btn-label" }, t("shell.storage.account"))));
    }
    actions.push(h("button", {
      type: "button",
      class: "btn btn-ghost btn-sm",
      onclick: () => {
        state.bannerDismissed = reason;
        paintStorageBanner();
      },
    }, h("span", { class: "btn-label" }, t("shell.storage.dismiss"))));
    banner.appendChild(h("div", { class: `sh-banner is-${reason}` },
      h("span", { class: "sh-banner-icon", "aria-hidden": "true" }, icon("alert", { size: 20 })),
      h("div", { class: "sh-banner-text" },
        h("p", { class: "sh-banner-title" }, t(`shell.storage.${reason}.title`)),
        h("p", { class: "sh-banner-body" }, t(`shell.storage.${reason}.body`))),
      h("div", { class: "sh-banner-actions" }, actions)));
  }

  // The skip link must land on the visible main landmark: the landing page is a sibling of #app-main (which holds every
  // routed screen), so pointing at #app-main from the landing would jump past the hero and its start button.
  function paintSkipTarget() {
    const doc = getDoc();
    const skip = doc && typeof doc.querySelector === "function" ? doc.querySelector(".skip-link") : null;
    if (skip && typeof skip.setAttribute === "function") skip.setAttribute("href", state.screen === "landing" ? "#landing-screen" : "#app-main");
  }

  function applyVisibility() {
    const doc = getDoc();
    if (!doc || !doc.body) return;
    const screen = state.screen;
    const hiddenByScreen = HIDDEN_ON.includes(screen);
    const on = state.visible && !hiddenByScreen;
    doc.body.dataset.shell = on ? (MINIMAL_ON.includes(screen) ? "minimal" : "on") : "off";
    if (state.header) state.header.hidden = !on;
    if (state.tabbar) state.tabbar.hidden = !on || MINIMAL_ON.includes(screen);
    if (state.header && on) state.header.removeAttribute("hidden");
    if (state.tabbar && on && !MINIMAL_ON.includes(screen)) state.tabbar.removeAttribute("hidden");
  }

  function update() {
    if (!state.mounted) return;
    state.scheduled = false;
    const wasOpen = state.popoverOpen;
    const hadFocusInside = wasOpen && state.refs.profileWrap && getDoc() && state.refs.profileWrap.contains(getDoc().activeElement);
    buildStatus();
    if (wasOpen) {
      // The chip was rebuilt: keep the popover open and give focus back to its content.
      state.popoverOpen = false;
      openPopover();
      if (!hadFocusInside && state.refs.chip && typeof state.refs.chip.focus === "function") state.refs.chip.focus();
    }
    paintLabels();
    paintBadges(readDue());
    paintActive();
    paintStorageBanner();
    applyVisibility();
  }

  function readDue() {
    const Profile = profileApi();
    try {
      const counts = Profile && Profile.notebook && Profile.notebook.counts ? Profile.notebook.counts() : null;
      return counts ? counts.due : 0;
    } catch (error) {
      return 0;
    }
  }

  // Events arrive in bursts (one round emits profile:changed and notebook:changed),
  // so repaints are coalesced into one.
  function scheduleUpdate() {
    if (!state.mounted || state.scheduled) return;
    state.scheduled = true;
    const run = () => update();
    if (typeof root.setTimeout === "function") root.setTimeout(run, 0);
    else run();
  }

  // ---------- Hash router ----------

  // `hash` is passed for the cold start: by the time the deferred call runs, boot
  // code has already shown the landing page and mirrorHash() has cleared it.
  function applyHash(initial, hash) {
    const route = parseHash(hash !== undefined ? hash : root.location && root.location.hash);
    if (!route) return;
    if (guardGame()) {
      leaveGameThen(() => applyHash(false, hash));
      return;
    }
    const router = L().router;
    if (route.id === "daily") {
      // A stranger who follows a "#/daily" link must not land in a running clock: boot showed them the landing page
      // (the first-visit screen), and that is where they stay until they choose to start.
      if (initial && router && router.current() === "landing") return;
      if (router && router.current() !== "home") go("home");
      const home = L().Screens && L().Screens.home;
      if (home && typeof home.startDaily === "function") home.startDaily();
      return;
    }
    if (router && router.current() === route.id) return;
    // A cold start on "#/classics" (a PWA shortcut) skips the landing page.
    if (initial || router) go(route.id);
  }

  function mirrorHash(id) {
    try {
      if (!root.history || typeof root.history.replaceState !== "function" || !root.location) return;
      const wanted = HASH_ROUTES.includes(id) && id !== "daily" ? `#/${id}` : "";
      if (root.location.hash === wanted) return;
      root.history.replaceState(root.history.state, "", `${root.location.pathname}${root.location.search}${wanted}`);
    } catch (error) {
      // Sandboxed frames and file:// can refuse; the hash is only a convenience.
    }
  }

  // ---------- Screen changes ----------

  function focusScreen(id, prev) {
    if (!prev || id === "landing" || id === "game") return;
    const doc = getDoc();
    if (!doc || typeof doc.getElementById !== "function") return;
    const screen = doc.getElementById(`screen-${id}`);
    if (!screen) return;
    const raf = typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : (fn) => root.setTimeout(fn, 0);
    raf(() => {
      let target = null;
      try {
        target = screen.querySelector("[data-screen-title], h1, .screen-title, h2");
      } catch (error) {
        target = null;
      }
      const node = target || screen;
      if (node && typeof node.setAttribute === "function" && !node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      try {
        if (typeof node.focus === "function") node.focus({ preventScroll: true });
      } catch (error) {
        // focus is best effort
      }
    });
  }

  function onScreenChanged(payload) {
    const id = payload && payload.id ? payload.id : null;
    state.screen = id;
    const doc = getDoc();
    if (doc && doc.body) doc.body.dataset.screen = id || "";
    closePopover(false);
    paintActive();
    paintSkipTarget();
    applyVisibility();
    mirrorHash(id);
    focusScreen(id, payload && payload.prev);
  }

  // ---------- Public API ----------

  function on(evt, fn) {
    const bus = L().bus;
    if (bus && typeof bus.on === "function") state.offs.push(bus.on(evt, fn));
  }

  function listen(target, evt, fn) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(evt, fn);
    state.domOffs.push(() => target.removeEventListener(evt, fn));
  }

  function ensureHeader(appEl) {
    const doc = getDoc();
    let header = doc.getElementById("shell-header");
    if (header) return header;
    // index.html normally ships the header; this is the fallback for a page
    // that does not (the language switch is then left to whoever owns it).
    header = h("header", { class: "sh-header", id: "shell-header" },
      h("div", { class: "sh-inner" },
        h("a", { class: "sh-brand", id: "shell-brand", href: "#/home" },
          h("img", { class: "sh-brand-mark", src: "assets/brand/logo.svg", alt: "", width: 36, height: 36 }),
          h("span", { class: "sh-brand-word" }, "Ludus Scaccorum")),
        h("nav", { class: "sh-nav", id: "shell-nav" }),
        h("div", { class: "sh-right" }, h("div", { class: "sh-status", id: "shell-status" }))));
    const parent = appEl && appEl.parentNode ? appEl.parentNode : doc.body;
    parent.insertBefore(header, appEl && appEl.parentNode ? appEl : parent.firstChild);
    return header;
  }

  function mount(appEl) {
    const doc = getDoc();
    if (!doc || !doc.body || !L().util || typeof L().util.h !== "function") return api;
    if (state.mounted) {
      update();
      return api;
    }
    state.header = ensureHeader(appEl);
    state.nav = doc.getElementById("shell-nav") || state.header.querySelector(".sh-nav");
    state.status = doc.getElementById("shell-status") || state.header.querySelector(".sh-status");
    state.mounted = true;

    const brand = doc.getElementById("shell-brand");
    if (brand) {
      state.refs.brandOff = onNavigate("home");
      listen(brand, "click", state.refs.brandOff);
    }

    buildNav();
    buildTabbar();
    buildStatus();

    const current = L().router && typeof L().router.current === "function" ? L().router.current() : null;
    state.screen = current;
    if (doc.body && current) doc.body.dataset.screen = current;

    on("screen:changed", onScreenChanged);
    on("profile:changed", scheduleUpdate);
    on("notebook:changed", scheduleUpdate);
    on("language:changed", () => update());
    on("session:completed", scheduleUpdate);
    on("storage:failed", scheduleUpdate);
    listen(root, "hashchange", () => applyHash(false));
    listen(doc, "keydown", (event) => {
      if (event && event.key === "Escape" && state.popoverOpen) closePopover(true);
    });

    update();
    // Boot code may still register screens and show the landing page after this
    // call; the initial hash (read now, before anything mirrors the screen into
    // it) is applied once that synchronous work is done.
    const initialHash = root.location ? root.location.hash : "";
    if (typeof root.setTimeout === "function") root.setTimeout(() => applyHash(true, initialHash), 0);
    return api;
  }

  function setVisible(visible) {
    state.visible = Boolean(visible);
    applyVisibility();
  }

  function destroy() {
    state.offs.forEach((off) => {
      try {
        off();
      } catch (error) {
        // already detached
      }
    });
    state.offs = [];
    state.domOffs.forEach((off) => off());
    state.domOffs = [];
    closePopover(false);
    if (state.tabbar && state.tabbar.parentNode) state.tabbar.parentNode.removeChild(state.tabbar);
    state.tabbar = null;
    if (state.refs.banner && state.refs.banner.parentNode) state.refs.banner.parentNode.removeChild(state.refs.banner);
    state.refs.banner = null;
    state.refs.bannerKey = undefined;
    state.mounted = false;
  }

  const api = {
    mount,
    update,
    setVisible,
    destroy,
    parseHash,
    TEXT,
    // Exposed for tests and for the home screen (same routing rules).
    NAV_ITEMS: NAV_ITEMS.map((item) => item.id),
    HASH_ROUTES: HASH_ROUTES.slice(),
    isVisible: () => state.visible && !HIDDEN_ON.includes(state.screen),
  };
  return api;
});
