# Contract schema checks

From this repository, with Python 3.9+ and network access to install the small pinned validator:

```sh
python3 -m venv /tmp/videoml-contract-venv
/tmp/videoml-contract-venv/bin/pip install jsonschema==4.25.1
/tmp/videoml-contract-venv/bin/python tests/validate_contracts.py
```

Examples are illustrative schema fixtures; placeholder digests do not establish file integrity. Schema validation does not replace the semantic and file checks in the draft specifications.

Run `node tests/timing-contract.mjs` for the fixed-seed, clamp and frame-boundary reference vectors. These are contract vectors, not implementation conformance tests.

Run `node tests/semantic-vectors.mjs` for known-answer bundle hashing, membership and digest failures, revision availability, sample-to-frame arithmetic, stable IDs, references, and WAV versus PCM hash checks. These vectors are bounded reference checks, not a complete importer or ZIP security test.
