# Stockfish provenance

This file records what could and could not be independently confirmed about the origin
of the two vendored Stockfish artifacts:

- `vendor/stockfish-18-lite-single.js`
- `vendor/stockfish-18-lite-single.wasm`

`THIRD_PARTY_NOTICES.md` summarizes this; this file has the full trail. It was compiled
on 2026-08-31 by re-checking the claims in the vendored file's own header comment against
the public GitHub repositories involved, using the `gh` CLI and direct file downloads —
not by trusting the header comment alone.

## What was independently verified

**The exact release these files came from.** `github.com/nmrugg/stockfish.js` has a
GitHub release named "Stockfish 18", tag `v18.0.0`, commit
`31a98753a5d932511693f44775da908377c24513`, published 2026-02-11. That release's assets
include `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm`
(`https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0`).

**Byte-for-byte match, not just a plausible hash.** Both files were downloaded fresh from
that release (`.../releases/download/v18.0.0/stockfish-18-lite-single.js` and
`...-single.wasm`) and compared to the files in this `vendor/` directory with `cmp` —
zero differences. Their SHA-256 hashes:

- `stockfish-18-lite-single.js`: `2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe`
- `stockfish-18-lite-single.wasm`: `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1`

match `vendor/SHA256SUMS` exactly, and also match the asset digests GitHub itself reports
for that release via its API (`repos/nmrugg/stockfish.js/releases`, asset `digest` field) —
an independent second source for the same hash. So: the two files in this repository are,
byte for byte, the official prebuilt "lite single-threaded" release asset that
`nmrugg/stockfish.js` published as Stockfish.js 18.

**The declared upstream Stockfish commit.** The `v18.0.0` release notes on
`nmrugg/stockfish.js` state: "Upstream:
`https://github.com/official-stockfish/Stockfish/commit/cb3d4ee9b47d0c5aae855b12379378ea1439675c`".
That commit exists in `official-stockfish/Stockfish`, is tagged `sf_18`, and its commit
message is the project's own "Stockfish 18" release announcement (dated 2026-01-31). This
is the real, official Stockfish 18 source commit, not a fork or unrelated repository.

**The build toolchain version.** `nmrugg/stockfish.js`'s own `build.js`, read at the exact
`v18.0.0` tagged commit (not just the current `master` branch), hard-codes
`expectedEmscripten = "3.1.7"` and refuses to build with any other Emscripten version. The
same repository's `README.md` documents the build entry point: install
Emscripten 3.1.7, then run `./build.js` (`./build.js --help` for flavor flags).

**The neural network identifier.** This took the most digging, because the vendored
file's header comment (`nn-9067e33176e`, 11 hex characters after `nn-`) does not exactly
match what the source declares:

- `nmrugg/stockfish.js`'s own `src/lite_nets.h`, read at the `v18.0.0` tag, is the file the
  "lite" build flavor actually uses for its embedded net (confirmed by reading `build.js`,
  which embeds `lite_nets.h`'s net specifically when building with the `--lite` flag,
  instead of the standard big/small nets in `evaluate.h`). It declares:
  `#define EvalFileDefaultNameBig "nn-9067e33176e8.nnue"` — 12 hex characters, i.e. one
  character longer than the header comment (the header comment appears to be missing a
  trailing `8`; this looks like a typo in upstream's own comment, not evidence of a
  different net, but it is a literal mismatch worth recording rather than silently
  correcting).
- That net file was downloaded directly from Stockfish's own network-hosting
  infrastructure (`https://tests.stockfishchess.org/api/nn/nn-9067e33176e8.nnue`, the same
  host `net.sh` in the `nmrugg/stockfish.js` source uses to fetch nets). Its SHA-256 is
  `9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d` — the first 12 hex
  characters are exactly `9067e33176e8`, which is what Stockfish's own naming convention
  requires (`nn-[SHA256 first 12 digits].nnue`, per the comment in `evaluate.h`). So this
  is a genuine, correctly self-named Stockfish network file, served from Stockfish's own
  infrastructure — not a coincidental filename.
- Attribution to Linmiao Xu ("linrock") could not be verified beyond the vendored file's
  own header and `nmrugg/stockfish.js`'s own README, which credits a contributor named
  "linrock" in its Thanks section. The network's own info page,
  `https://tests.stockfishchess.org/nns?network_name=nn-9067e33176e8`, was behind a bot
  challenge when checked and did not return usable content.

**License.** `nmrugg/stockfish.js` declares GPLv3 in its own `README.md` and ships a
`Copying.txt`, consistent with the license stated in the vendored file's header.

## What remains open — not independently verified

- **No from-source rebuild was performed.** Everything above verifies that the vendored
  files are an exact copy of `nmrugg/stockfish.js`'s own prebuilt release asset, and that
  the release's declared upstream commit and toolchain version are real. Nobody has
  actually installed Emscripten 3.1.7 and run `./build.js` against that source to confirm
  it reproduces these exact bytes. That is a materially stronger claim ("byte-reproducible
  build") than what is confirmed here ("this is genuinely their official release asset").
- **No public, auditable build pipeline exists for this release.** `nmrugg/stockfish.js`
  has no `.github/workflows` directory (checked directly via the GitHub API — none found).
  The release asset appears to have been built and uploaded locally by the maintainer,
  not through a public CI log that could be inspected independently.
- **The exact `./build.js` invocation used for this specific release asset is unknown.**
  `build.js` supports flags for single-threaded and lite builds (`--single-threaded`,
  `--lite`, among others), which is consistent with a flavor named "lite-single", but the
  precise flag combination the maintainer ran to produce the published
  `stockfish-18-lite-single.js`/`.wasm` was not confirmed from any log or manifest.
- **The one-character discrepancy in the net identifier** (`nn-9067e33176e` in the header
  comment vs. the real `nn-9067e33176e8`) is unresolved with upstream; it is most likely a
  typo in their own header, but that is an inference, not a confirmed fact.

### Checklist for whoever next touches `vendor/`

- [ ] If Stockfish is upgraded or rebuilt, repeat this process for the new version: identify
      the exact upstream release/tag, download the release asset fresh, `cmp` it against
      the new vendored file, and record the new hashes in `vendor/SHA256SUMS`.
- [ ] If anyone wants "reproducible build" level provenance (not just "verified official
      release asset"), the next step is installing Emscripten 3.1.7 and running
      `./build.js` against `official-stockfish/Stockfish` commit
      `cb3d4ee9b47d0c5aae855b12379378ea1439675c`, then comparing output bytes.
- [ ] If `nmrugg/stockfish.js` ever adds a public build workflow, link it here instead of
      relying on this manual trail.

## Standing offer of source (GPLv3)

The corresponding source for the exact Stockfish binaries shipped in this repository at
commit `a0a62e0d2426009a2d0239a2def92514c97e76e0` (the `vendor/` files themselves were last
changed in commit `79d9794850ac249b2b8f3ae1f85c27f18ba12bc0`) is available on request.
Contact the repository owner via GitHub issues at
`https://github.com/jpripamonti/ludus_scaccorum/issues`, or see the upstream repositories
linked above (`github.com/nmrugg/stockfish.js`, `github.com/official-stockfish/Stockfish`)
for the general source. This offer is the standard GPLv3 compliance fallback for the case
where full independent build-reproducibility has not (yet) been established in-house; it
does not claim more than what is verified above.
