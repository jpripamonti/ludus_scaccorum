// Ludus Scaccorum - boot guards. A tiny, synchronous, same-origin classic script
// loaded from <head> BEFORE the stylesheets and the app (CSP: script-src 'self',
// so no inline script is needed). It runs before the first paint and only sets
// attributes on <html> that css/system.css and css/shell.css react to:
//
//   data-returning    a visitor who has been here before (localStorage
//                     "ludus.seen.v1", the same key app.js writes when the landing
//                     page was shown): CSS never paints the first-visit hero for
//                     them, so there is no flash of the marketing page and no
//                     layout jump when the router mounts Home.
//   data-framed       the page is inside another page's frame: the app is hidden
//                     (clickjacking). frame-ancestors cannot be sent from a <meta>
//                     CSP and top navigation is blocked by modern browsers, so
//                     hiding is the defence that works everywhere, sandboxed
//                     frames included. A link opens the app in its own tab.
//   data-unsupported  the browser lacks what the app needs (CSS :has() and
//                     container queries, which also imply the JavaScript syntax the
//                     other files use: a browser older than that throws a
//                     SyntaxError and would show a blank page). A friendly notice
//                     replaces the page.
//
// Written in ES5 on purpose: this is the one file an old browser must still be able
// to parse. It never throws and never touches the network.
(function () {
  "use strict";

  var root = document.documentElement;

  function flag(name) {
    try { root.setAttribute("data-" + name, ""); } catch (error) { /* a missing flag only costs a cosmetic flash */ }
  }

  function storedValue(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  // Same rule as Ludus.i18n (js/ludus.js): a stored choice wins, then the browser
  // language; only Spanish-language browsers get Spanish.
  function language() {
    var stored = storedValue("ludus.language");
    if (stored === "es" || stored === "en") return stored;
    var list = [];
    try { list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]; } catch (error) { list = []; }
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i] || "").toLowerCase().indexOf("es") === 0) return "es";
    }
    return "en";
  }

  var TEXT = {
    es: {
      unsupportedTitle: "Tu navegador es demasiado viejo para Ludus Scaccorum",
      unsupportedBody: "Para entrenar necesitás una versión reciente de Chrome, Edge, Firefox o Safari (Safari 16 o más nuevo, Chrome 105, Firefox 121). Actualizalo y volvé a abrir esta página: tu progreso, si lo hubiera, sigue guardado en este dispositivo.",
      framedTitle: "Ludus Scaccorum se abre en su propia pestaña",
      framedBody: "Por seguridad la app no se muestra dentro de otra página.",
      framedLink: "Abrir Ludus Scaccorum"
    },
    en: {
      unsupportedTitle: "Your browser is too old for Ludus Scaccorum",
      unsupportedBody: "To train you need a recent version of Chrome, Edge, Firefox or Safari (Safari 16 or newer, Chrome 105, Firefox 121). Update it and open this page again: your progress, if any, is still saved on this device.",
      framedTitle: "Ludus Scaccorum opens in its own tab",
      framedBody: "For your safety the app is not shown inside another page.",
      framedLink: "Open Ludus Scaccorum"
    }
  };

  // The notice is built with the DOM and styled through the CSSOM (allowed under any
  // style-src), so it still looks right when the stylesheets did not load or parse.
  function showNotice(kind, link) {
    function build() {
      try {
        if (document.getElementById("boot-notice")) return;
        var copy = TEXT[language()];
        var box = document.createElement("div");
        box.id = "boot-notice";
        box.setAttribute("role", kind === "framed" ? "note" : "alert");
        box.style.cssText = "box-sizing:border-box;max-width:36rem;margin:0 auto;padding:48px 20px;color:#e5e8ec;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center";
        var title = document.createElement("h1");
        title.style.cssText = "margin:0 0 12px;font-size:22px;line-height:1.25;color:#dda734";
        title.appendChild(document.createTextNode(copy[kind + "Title"]));
        var body = document.createElement("p");
        body.style.cssText = "margin:0 0 20px";
        body.appendChild(document.createTextNode(copy[kind + "Body"]));
        box.appendChild(title);
        box.appendChild(body);
        if (link) {
          var a = document.createElement("a");
          a.href = link;
          a.target = "_blank";
          a.rel = "noopener";
          a.style.cssText = "display:inline-block;padding:12px 20px;border-radius:10px;background:#dda734;color:#1f1401;font-weight:700;text-decoration:none";
          a.appendChild(document.createTextNode(copy.framedLink));
          box.appendChild(a);
        }
        document.body.insertBefore(box, document.body.firstChild);
      } catch (error) { /* the page stays hidden, which is the safe outcome */ }
    }
    if (document.body) build();
    else if (document.addEventListener) document.addEventListener("DOMContentLoaded", build);
  }

  // ---- Clickjacking -------------------------------------------------------
  var framed = false;
  try { framed = window.top !== window.self; } catch (error) { framed = true; }
  if (framed) {
    flag("framed");
    var href = "";
    try { href = window.self.location.href; } catch (error) { href = ""; }
    // css/system.css hides everything in <body> but this notice while data-framed is set.
    showNotice("framed", href);
    return;
  }

  // ---- Returning visitors -------------------------------------------------
  var seen = storedValue("ludus.seen.v1");
  if (seen && seen !== "0" && seen !== "false" && seen !== "null") flag("returning");

  // ---- Browser baseline ---------------------------------------------------
  var supported = false;
  try {
    supported = !!(window.Promise && window.fetch && window.CSS && typeof window.CSS.supports === "function" &&
      window.CSS.supports("selector(:has(*))") && window.CSS.supports("container-type", "inline-size"));
  } catch (error) { supported = false; }
  if (!supported) {
    flag("unsupported");
    showNotice("unsupported", "");
  }
})();
