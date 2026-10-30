# Frame effects and portable bundles, draft v1

This document specifies a **future contract**, not a claim that the current player, renderer, or exporter implements it. The initiative's D02 and D08 are authoritative for scope. MUST, SHOULD and MAY are normative. Schemas use JSON Schema draft 2020-12 and reject unknown fields except explicitly extensible maps.

## Effect instance

An effect implementation exposes `mount(root, {width, height, fps, seed, assets})`, `seek(frame): Promise<void>`, and `dispose(): void`. `root` is the host DOM element; dimensions are positive pixels, fps is positive, seed is a recorded uint32, and assets are pre-resolved local assets. Mount establishes the instance; seek accepts a nonnegative integer and represents time `frame / fps` seconds. A visible interval is `[startFrame,endFrame)`. Seek MUST settle asset loading and visual state before its promise resolves. Repeated, backward, random and parallel evaluations under the same pinned environment MUST produce reproducible state within documented tolerances. Pure time formulas and baked deterministic trajectories are allowed; ambient wall clock and unseeded randomness are forbidden. Dispose releases resources and is safe at end of use. An implementation MUST document any concurrency restrictions necessary to achieve this result.

The versioned `effect-descriptor` declares the effect ID, version and JSON Schema for its parameter object; the `effect-config` references that identity, parameters and visibility interval. Validators MUST validate parameters against the matched descriptor and reject an unknown ID/version, invalid parameters, or endFrame < startFrame. Use one shared implementation in DOM player and renderer, adapting existing React layouts. Preserve the existing mount cleanup return API; add a separate controller API exposing seek, pause and dispose. Server HTML alone is not evidence of canvas or WebGL output.

## Portable bundle v1

A directory or ZIP contains `videoml-project.json`, `source/`, `assets/`, `audio/`, `timing/`, `dependencies.lock.json`, and `notices/`. The manifest conforms to `portable-bundle.schema.json`; paths are relative POSIX paths. `files` covers every source, asset, font, audio, timing, notice and dependency-lock file, exactly once; each record contains the SHA-256 of file bytes and media type. `assets` is a subset of matching `files` records with identical digest and media type. Entry, audio and timing paths MUST reference listed files. No unlisted payload, missing file, symlink, absolute, backslash, traversal, dot or duplicate normalized path is permitted. Verify every digest before use. JSON Schema cannot verify file existence, symlinks, uniqueness by path, subset consistency or content: the importer MUST perform these checks.

For the content digest, remove `contentDigest` from the manifest, sort the `files` and `assets` arrays by path in Unicode code point order, preserve every other array order, canonicalize the resulting JSON with RFC 8785 JSON Canonicalization Scheme (JCS), concatenate their lowercase hexadecimal SHA-256 strings in that order with no separator, and SHA-256 the UTF-8 bytes of the canonical manifest followed by that ASCII concatenation. This definition avoids self-hashing. Dependency and font version maps are pinned; the lock file is also hashed. Generated narration and frozen resolved timing travel with the bundle; rendering does not require TTS credentials or network fetches.

Before extraction, reject ZIPs with compressed size >250 MiB, expanded size >1 GiB, >10,000 files, any file >250 MiB, duplicate normalized paths, symlinks or unsafe paths. Enforce limits while streaming, including actual bytes, not just header claims. Sanitize SVG external references and scripts; reject unsupported active formats. Local trusted projects MAY compile TS during preparation. Hosted pilot input is declarative XML with built-in or approved effect IDs and validated data only; reject scripts, handlers, custom components, executable expressions, HTML injection, external URLs and TS entrypoints. User data MUST NOT become code. The supervisor stages and validates the bundle, then launches the pinned allowlisted worker without credentials, metadata access or network, and uploads verified output separately. No arbitrary installs or setup hooks. Both directory and ZIP exports remain usable without a Babulus account.

ZIP and filesystem enforcement is a P17 implementation gate. These schema and reference vectors do not implement or demonstrate ZIP import safety.

## XML frame-effect binding (draft)

A `frame-effect` is a component within a scene, layer, sequence, stack, or transition, using the existing XML timing and ID rules:

```xml
<vml id="example" fps="30" width="1280" height="720">
  <scene id="scene" duration="4s">
    <frame-effect id="effect" effect-id="videoml/echo-smear" effect-version="1" props='{"parameters":{"color":"#71f5a7"}}' start="0f" duration="120f" />
  </scene>
</vml>
```

The `effect-id` and exact `effect-version` MUST resolve in an approved registry; the `props` JSON object MUST contain only a `parameters` object. Its content MUST be plain finite data, recursively rejecting prototype-sensitive keys and executable expressions, and MUST validate against the registered descriptor. Unknown identities, versions, invalid parameters, or missing required pre-resolved assets MUST fail explicitly. The registry may be explicitly supplied by a trusted caller; the default built-in registry is fixed by the implementation and MUST NOT load code named by the XML.

Start and duration use the ordinary component timing grammar, including frame units and inherited container timing. Frozen timing, when provided, is authoritative and uses the ordinary qualified component ID. The effect receives composition-absolute integer frames, not an independent local clock; visibility is half-open. Dimensions, frame rate, seed, and approved assets come from the composition and its caller. Seek MUST settle before capture, and disposal MUST release resources even after cancellation or failure. This draft describes the intended binding; implementations and release parity require separate verification.

### Local effect assets

An XML root MAY declare `<assets><asset id="font" src="assets/Geist-Latin.woff2" media-type="font/woff2"/></assets>`. The container is metadata and does not participate in timeline or normalized component IDs. Each ID is a unique asset-map key. Paths are relative POSIX paths resolved against the source XML directory; absolute paths, backslashes, traversal, URL schemes, query strings and fragments are invalid. The initial supported media types are WOFF2 fonts and PNG, JPEG, WebP or restricted SVG images. A composition MAY declare at most 32 assets, with at most 16 MiB per asset and 64 MiB total.

Generation copies verified bytes into content-addressed files adjacent to the generated script and records `id`, relative `path`, `mediaType`, and SHA-256 in `script.meta.assets`; source absolute paths MUST NOT appear in generated artifacts. Node rendering requires the script directory as `assetBaseDir` when declarations exist, verifies file bytes and hashes, and passes pre-resolved data or blob URLs to effects without browser network access. A programmatic override that conflicts with a declared asset MUST fail rather than silently change its identity.

A browser XML player MAY prepare declarations from same-origin resources using an explicit asset base URL or the document base URL. Alternatively, a trusted caller MAY provide matching pre-resolved local data or blob URLs. Preparation MUST settle before the first effect seek, reject missing or mismatched assets, enforce the bounds while reading, and release owned resources on cancellation or disposal. ZIP import and stronger hostile-filesystem isolation remain P17 responsibilities.

For player effects, the frozen `generationSeed` takes precedence over a trusted explicit `effectSeed`, followed by an authored `voiceover` seed and then zero. An authored random seed requires frozen timing or an explicitly supplied resolved seed. Generation records its resolved seed in script metadata so script-only rendering can reproduce the same effect without starting a speech provider; renderers use frozen timing first, then a trusted explicit override, then that script seed, and finally zero.
