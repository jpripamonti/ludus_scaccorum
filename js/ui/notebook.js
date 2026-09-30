// stub: replaced by the module owner
// Screen "notebook". Contract: docs/ARCHITECTURE.md section 15.
(function (root, factory) {
  const api = factory(root);
  root.Ludus = root.Ludus || {};
  root.Ludus.Screens = root.Ludus.Screens || {};
  root.Ludus.Screens.notebook = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  return { mount() {}, show() {}, hide() {} };
});
