# Q2PRO starter ZIP: redistribution research

Research date: September 8, 2026. This review assumes free, non-commercial
distribution. It is a review of available license evidence, not a binding legal
opinion. Monetization of the launcher or downloads has not been assessed.

## Findings

A portable ZIP containing Q2PRO, the original demo, and the 3.20 patch is technically
possible. However, no explicit, generally applicable permission from the rights
holder was found for this exact public bundle.

- Q2PRO can be redistributed under its GPL terms.
- The demo permits free electronic distribution with its license included. It does
  not mandate a particular archive format, so using ZIP is not itself disallowed.
- Redistribution of the selected 3.20 patch data remains the main unresolved issue.
- Existing packages establish distribution practices, not permission for this project.
- Technically, `pak1.pak` supplies the eight official deathmatch maps and related
  textures. `pak2.pak` contains only two replacement weapon textures and is not a
  general multiplayer prerequisite. See section 2 for the inspected contents and
  the distinction between engine requirements and launcher policy.

Recommending the original demo installer as the only mirror format was a
conservative recommendation, not an explicit requirement in the license.

## 1. Inspected artifacts

Both original archives were downloaded temporarily from the Yamagi mirror named in
the manifest, inspected without executing the installers, and checked against the
manifest hashes. Both hashes matched.

| Original archive | Bytes | SHA256 |
| --- | ---: | --- |
| `q2-314-demo-x86.exe` | 39015499 | `7ace5a43983f10d6bdc9d9b6e17a1032ba6223118d389bd170df89b945a04a1e` |
| `q2-3.20-x86-full-ctf.exe` | 19267584 | `f82197c8c8089202a4b3a85d8833b0c2e827a709d205c760369407c212488baa` |

Sources: [original demo on the Yamagi mirror](https://deponie.yamagi.org/quake2/idstuff/q2-314-demo-x86.exe),
[original patch on the Yamagi mirror](https://deponie.yamagi.org/quake2/idstuff/q2-3.20-x86-full-ctf.exe).

The following PAK files proposed for the minimal bundle were read directly from
the archives and hashed without changing their contents:

| Origin and archive path | Bytes | SHA256 |
| --- | ---: | --- |
| Demo: `Install/Data/baseq2/pak0.pak` | 49951322 | `cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09` |
| Patch: `baseq2/pak1.pak` | 12992754 | `678210ecd1b27dde1c645660333a1a7b139d849425793859657f804d379b62ad` |
| Patch: `baseq2/pak2.pak` | 45055 | `cb88d584ef939d08e24433a6cf86274737303fac2bbd94415927a75e6b269dd8` |

A filename alone does not identify a license. In particular, the demo's `pak0.pak`
must be distinguished from the file with the same name in a purchased retail copy.

## 2. PAK contents and multiplayer requirements

These findings come from reading the PAK directory records inside the exact
archives identified above. File counts, paths, sizes, and the texture comparison
were measured directly. No live Q2PRO multiplayer session was tested during this
review; runtime implications below are conclusions from the inspected contents and
the documented download behavior.

### `pak1.pak`: official deathmatch content

The archive is approximately 12.4 MiB and contains 279 files:

| Content | Count | Details |
| --- | ---: | --- |
| Maps | 8 | `maps/q2dm1.bsp` through `maps/q2dm8.bsp`, including The Edge (`q2dm1`) |
| Map textures | 260 | `.wal` files under `textures/`; 242 of these paths are absent from the demo's `pak0.pak` |
| Images | 2 | `pics/tag1.pcx` and `pics/tag2.pcx` |
| Configuration files | 9 | `default.cfg`, `steed.cfg`, `cash.cfg`, `amnet.cfg`, `killme.cfg`, `bear.cfg`, `paulj.cfg`, `bwh.cfg`, and `todd.cfg` |

The demo PAK contains only `maps/demo1.bsp`, `maps/demo2.bsp`, and
`maps/demo3.bsp`. It does not supply the eight official `q2dm*` maps.

For a standard deathmatch server running one of those maps, the client needs the
map and its required assets locally. `pak1.pak` is the original container that
supplies this content, not an intrinsic network-protocol requirement. Equivalent
assets can technically be loaded from another supported package or as loose files;
changing the container does not change their redistribution rights.

Q2PRO supports automatic downloads of maps, textures, models, sounds, and player
assets. Missing content can therefore be obtained on connection only when the
configured download source actually serves it and downloads are allowed. This
cannot be assumed for every server or used as a guarantee of immediate playability.
See the [Q2PRO client manual: Downloads](https://github.com/q2pro/q2pro/blob/master/doc/client.asciidoc#downloads).

### `pak2.pak`: two replacement weapon textures

The archive is 45,055 bytes, approximately 44 KiB, and contains exactly:

```text
models/weapons/g_blast/base.pcx
models/weapons/g_flareg/base.pcx
```

There are no maps, executable code, game logic, or network components in this PAK.
Both texture paths already exist in the demo PAK, with different bytes:

| Texture | Demo file size | Patch file size |
| --- | ---: | ---: |
| `models/weapons/g_blast/base.pcx` | 57993 | 12603 |
| `models/weapons/g_flareg/base.pcx` | 59873 | 32312 |

Omitting `pak2.pak` leaves the existing demo textures available. Based on these
contents, it should not be treated as a general multiplayer prerequisite. This
review did not establish the precise visual or corrective purpose of each replacement.

### Implications for a starter bundle

- **Q2PRO plus demo data:** a possible multiplayer baseline for maps and assets
  available locally or obtainable from a configured download source. Include the
  necessary player assets: the demo archive contains 59 non-empty files under
  `Install/Data/baseq2/players/`, outside `pak0.pak`.
- **Immediate access to the eight official deathmatch maps:** requires their
  content and dependencies, normally supplied by `pak1.pak` in addition to the
  baseline game data.
- **`pak2.pak`:** optional for this technical baseline; retaining it provides the
  two patch textures. Removing it does not resolve the separate licensing question
  if `pak1.pak` is still distributed.

At the time of inspection, the adjacent launcher checkout marks both `pak1.pak`
and `pak2.pak` as `required: true` in
`src/main/modules/downloads/bootstrap/assemble.ts`. That is an installation policy
in the launcher, not evidence that the Q2PRO engine requires both archives for all
multiplayer games. Supporting a demo-only installation or making `pak2.pak` optional
would require a separate launcher change and runtime verification. Neither was
performed as part of this documentation update.

## 3. License evidence

### Q2PRO

The [GPLv2 in the Q2PRO repository](https://github.com/q2pro/q2pro/blob/master/LICENSE)
permits binary distribution under section 3. A practical approach is to provide a
complete source archive corresponding to the exact build at the same download
location, including necessary build scripts and sources for included modules.
Bundled libraries and their notices must also be considered. A generic link to a
moving development branch does not replace that check.

The GPL does not automatically cover an entire collection of independent works
merely because they are distributed together. It does not turn proprietary demo
or patch assets into GPL content. This content repository's MIT license likewise
grants no additional rights to those assets.

### Original demo 3.14

Inspected: `license.txt` in the demo archive, dated February 16, 1998.
Section 3 allows free electronic distribution with the license included.
Section 2 prohibits, among other things, commercial exploitation and modification.
There is no explicit requirement to retain the original EXE container.
The exact scope for selecting files and combining them with patch data remains a
matter of interpretation. Unchanged PAKs, preserved documentation, and clear
provenance are sensible practices but cannot replace missing permission.

The text is also available in the [NVIDIA Q2RTX license document](https://github.com/NVIDIA/Q2RTX/blob/master/license.txt)
under "LIMITED USE SOFTWARE DEMO LICENSE AGREEMENT". NVIDIA's own release does not
establish any separate permission for this project.

### Original patch 3.20

Inspected: in particular `DOCS/license.txt`, `DOCS/licinfo.txt`, `DOCS/release.txt`,
and `3.20_Changes.txt` in the patch archive.
The included retail license from November 1997 contains a general distribution
prohibition in section 3(e). No separate explicit permission was found for
extracting and redistributing `pak1.pak` and `pak2.pak`.

This does not prove that every historical patch mirror was unauthorized: additional
permission outside the archive may exist. However, the reviewed sources did not
establish such permission for the proposed bundle. The
[official GPL source release statement from id Software](https://github.com/id-Software/Quake-2/blob/master/readme.txt)
explicitly leaves the game data under its original terms.

## 4. Comparable projects and what they establish

| Source | Observation | Interpretation |
| --- | --- | --- |
| [Quake II for Mac/Linux by Quetoo, `jdolan/quake2`](https://github.com/jdolan/quake2#downloads) | The README describes ready-to-play packages containing the 3.14 demo and 3.20 point-release data. | A close precedent. No separate rights-holder permission was found in the reviewed material. The maintainers are a useful contact for the original licensing basis. This refers to the classic Quake II project, not the standalone game Quetoo. |
| [vkQuake2](https://github.com/kondrak/vkQuake2#running) | Project documentation describes releases containing demo content. | Establishes the practice of shipping the demo with an alternative engine. Does not confirm permission for this specific Q2PRO/patch bundle. |
| [Quake II Starter: author's announcement, 2013](https://www.esreality.com/post/2380506/quake-ii-starter-installation-package/) | Author ElysiumTS explicitly states that the demo and patch are downloaded separately from original archives; their content is not bundled with the installer. | A precedent for assembling the installation on the user's machine, not permission for a preassembled ZIP. |
| [Gentoo: demo package definition](https://raw.githubusercontent.com/gentoo/gentoo/master/games-fps/quake2-demodata/quake2-demodata-3.14-r1.ebuild) | Installs `pak0.pak`, `players`, and text documentation from the extracted demo archive; this definition has no `bindist` or `mirror` restriction. | Supports the interpretation that the original EXE packaging is not mandatory. This remains a distributor's interpretation. |
| [Gentoo: retail data package definition](https://raw.githubusercontent.com/gentoo/gentoo/master/games-fps/quake2-data/quake2-data-3.20-r1.ebuild) | Downloads the 3.20 patch, also imports `pak0.pak` from CD, and sets `RESTRICT="bindist"`. | The resulting package includes purchased game data. The restriction must not be treated as proof of an independent prohibition on repackaging the patch alone. |

Gentoo documents [license and distribution restrictions](https://devmanual.gentoo.org/general-concepts/licenses/index.html)
separately for original archives (`mirror`) and generated packages (`bindist`).
Both ebuilds were additionally read directly over HTTP because the web reader could
not retrieve them. Some historical mirror pages and Debian sources were inaccessible;
no positive or negative licensing conclusion is drawn from those access failures.

## 5. How to resolve the open question

1. Give the `jdolan/quake2` maintainers the exact file list and ask for a public
   grant, archived statement, or written permission from id Software. A response
   that they have distributed the files for years does not answer the rights
   question. Project-specific permission may not extend to other distributors.
2. Use the [official ZeniMax/Bethesda contact page](https://www.zenimax.com/en/more),
   under "General Info", and request forwarding to the legal or licensing team
   responsible for id Software/Quake II. Bethesda Support is also linked there and
   can serve as a routing channel. No dedicated public contact for Quake II demo
   repackaging permissions was verified.
3. Ask specifically about free public distribution of the identified unchanged
   PAKs with Q2PRO through GitHub Releases and download mirrors. Also clarify use
   without a purchased retail copy, required notices, and combining the demo with
   patch data. A generic question about mods is insufficient.
4. Keep the applicable public license or written confirmation from an authorized
   representative, including its scope. Silence or a generic support response
   about fan projects does not confirm permission for this bundle.

An English request draft is available in
[permission-request-q2pro-bundle.md](permission-request-q2pro-bundle.md).
No one has been contacted and no bundle has been published as part of this research.

## 6. Implementation options

**With confirmed permission:** Generate a reproducible ZIP from the pinned original
archives, containing Q2PRO, the approved unchanged PAKs, required documentation, and
license notices. Avoid personal configurations, server downloads, or extra assets
from a previously used installation. Offer the corresponding GPL sources separately
at the same download location. Publish the bundle through its own manifest entry
with fixed versions, SHA256, and mirrors serving identical bytes.
[GitHub Releases support binary downloads](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

**While permission remains unresolved:** Retain local assembly from separately
downloaded original packages. This already avoids running the historical installers.
It avoids adding public distribution of a custom assembled package; it is not a
blanket legal clearance for every possible use of the demo and patch.

**Narrower scope:** A bundle containing only Q2PRO and unchanged demo content has
stronger support from the demo's explicit distribution clause and documented
practice. It would not include the eight official deathmatch maps. Section 2
describes the resulting technical scope and the launcher changes that would need
separate implementation and verification.
