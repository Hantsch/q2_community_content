# q2_community_content

Content repository for the Quake II community launcher. It holds the manifests and
content the launcher reads at runtime — engine and game data packages, news feed
entries, and folders reserved for future content types. No launcher code lives here.

> **Status: under construction.** Structure, formats, and processes are still being
> built out and can change without notice.

## Contents

| Path | What it holds | State |
| --- | --- | --- |
| [engines/](engines/) | Engine packages (pinned versions, hashes, download URLs) | in use |
| [gamedata/](gamedata/) | Game data packages (demo, point release) | in use |
| [news/](news/) | News feed shown in the launcher (`index.json` + entries) | in use |
| [packs/](packs/) | Map/content packs | reserved, format not defined |
| [mods/](mods/) | Mods | reserved, format not defined |
| [config_templates/](config_templates/) | Config templates | reserved, format not defined |
| [docs/](docs/) | Project docs, roadmap, stories, concepts | in use |

Every manifest pins a version with its size and SHA-256 and records where the
artifact came from in its `provenance` field.

## Where to start

- Current state and what comes next: [docs/ROADMAP.md](docs/ROADMAP.md)
- Documentation map: [docs/README.md](docs/README.md)
- Repository rules: [AGENTS.md](AGENTS.md)

## How to

TBD — adding content, manifest schemas, and release preparation are not documented
yet. The one worked example is [engines/r1q2/README.md](engines/r1q2/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Contact

TBD.

## License

[MIT](LICENSE) for the repository's own content. Third-party artifacts referenced or
distributed here keep their own licenses.
