# Contributing

> **Status: under construction.** There is no contribution process yet. Please ask
> before investing work in a change — see [Contact](#contact).

## Ground rules

- **Language:** English for everything authored in this repository — docs, comments,
  manifest descriptions, commit messages. Original license texts and proper names stay
  as they are. See [AGENTS.md](AGENTS.md).
- **Licensing:** only add content that may be redistributed. Third-party artifacts keep
  their own license; the repository's [MIT license](LICENSE) does not cover them.
- **Manifests:** a package entry pins an exact version and records `sizeBytes`,
  `sha256`, the download URL, and a `provenance` note saying where the artifact came
  from. Never change a pinned artifact in place — add a new entry.
- **Binaries:** do not repack or modify third-party archives. They must stay
  byte-for-byte identical so their hash keeps verifying.

## How to contribute

TBD. Still open:

- Which content types are accepted, and in which format (`packs/`, `mods/`,
  `config_templates/` are reserved but unspecified).
- The review and acceptance process for content submissions.
- Branch, commit, and release conventions.

Reference example for how a package is documented until then:
[engines/r1q2/README.md](engines/r1q2/README.md).

## Contact

TBD.
