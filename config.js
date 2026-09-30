// Site configuration, loaded before every other script (see index.html).
// This file is the ONLY thing the site owner needs to edit to switch optional
// features on. Ludus.config (js/ludus.js) reads it, fills defaults and freezes
// it, so a missing or malformed value can never break the app.
window.LUDUS_CONFIG = {
  // Optional Google sign-in with progress sync through the user's own Google
  // Drive (docs/GOOGLE_SIGNIN.md explains the one-time setup). Leave it empty
  // to keep the app fully local: nothing is requested from Google and the
  // "Sign in" button stays hidden. It is a public identifier, not a secret.
  googleClientId: "",

  // Feature flags. Every flag defaults to true when omitted; set one to false
  // to hide that area of the app.
  features: {
    classics: true,
    notebook: true,
    daily: true,
    museum: true,
    audio: true,
  },
};
