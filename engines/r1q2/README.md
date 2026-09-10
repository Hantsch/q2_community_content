# R1Q2 b8012 MSVC package preparation

Prepared 2026-09-10. Local preparation only: no commit, push, or GitHub release
has been performed. The community download URL in ../manifest.json is reserved;
it becomes usable only after the release below is published.

## Pinned artifact

- Package ID: `r1q2-b8012-msvs2022-win32`
- Version: `b8012-msvs2022`
- Community release tag: `r1q2-b8012-msvs2022`
- Asset: `release-assets/R1Q2-b8012-msvs2022.7z`
- Bytes: 751580
- SHA-256: `a41c46f4732c05755091658fc3c27d3ff03e3f2048bbd6cec56882e5e346a7aa`
- Primary: https://github.com/Hantsch/q2_community_content/releases/download/r1q2-b8012-msvs2022/R1Q2-b8012-msvs2022.7z
- Fallback: https://github.com/vic7or777/R1Q2-MSVC/releases/download/b8012_fix/R1Q2-b8012-msvs2022.7z

The primary URL plus one entry in `mirrors` are the two requested download
locations. Keep the original archive byte-for-byte unchanged. Repacking it to
add notices would break fallback against the original archive's hash.
Keep license/source notices alongside it as separate release assets.

[Upstream release](https://github.com/vic7or777/R1Q2-MSVC/releases/tag/b8012_fix)
was published 2025-07-28. Its tag resolves to
`8af268c795293406f6f7d4328bf0d4f225294d6e`; use that commit, not current master.
The archive was downloaded, hashed, listed, extracted in a temporary directory,
and its PE import tables inspected. No engine executable was run or rebuilt.

## Archive contents and installation implications

| Path | Bytes | Architecture | Install |
| --- | ---: | --- | --- |
| r1q2.exe | 1047552 | x86 | Required client at installation root |
| ref_r1gl.dll | 524288 | x86 | Required renderer at installation root |
| baseq2/gamex86.dll | 348672 | x86 | Required game module from this engine archive |
| dedicated.exe | 290304 | x86 | Keep in mirrored archive; omit from client installation |

All four import VCRUNTIME140.dll and Universal CRT DLLs. The archive contains
no VC++ runtime DLLs, game PAKs, license texts, or readmes. Windows x64 support
does not imply that the x86 VC++ runtime is installed.
Static import inspection does not cover optional LoadLibrary dependencies.

The pinned `win32/vid_dll.c` defaults `vid_ref` to `gl`. This package contains
`ref_r1gl.dll`, not `ref_gl.dll`; a fresh installation must select
`vid_ref r1gl`. Preserve user settings on retries. Do not force optional OpenAL.

## Source and redistribution preparation

The intended distribution route is GPLv3 section 6(d), exercising the
"GPL version 2 or any later version" permission in the reviewed engine/renderer
headers. This is not a claim that every file or dependency has been audited.
The repository-root MIT license does not replace the third-party licenses.

External sources (no source archive is rehosted here):
- [Exact source tree](https://github.com/vic7or777/R1Q2-MSVC/tree/8af268c795293406f6f7d4328bf0d4f225294d6e)
- [Exact source ZIP](https://github.com/vic7or777/R1Q2-MSVC/archive/8af268c795293406f6f7d4328bf0d4f225294d6e.zip)
- [Build/dependency declarations](https://github.com/vic7or777/R1Q2-MSVC/blob/8af268c795293406f6f7d4328bf0d4f225294d6e/vcpkg.json)
- [Renderer dependencies](https://github.com/vic7or777/R1Q2-MSVC/blob/8af268c795293406f6f7d4328bf0d4f225294d6e/ref_gl/vcpkg.json)
- [External-source rule](https://www.gnu.org/licenses/gpl-faq.en.html#SourceAndBinaryOnDifferentSites)

The source tag is an upstream association, not a reproduced-build attestation.
The source ZIP contains dependency declarations, not the dependency source trees:
root vcpkg baseline `7ffcbfcc40de93da695b6b389b6fa7541d2e419a`;
renderer/game baseline `4f8fe05871555c1798dbcb1957d0d595e94f7b57`.
Declared dependencies are zlib, minizip, curl, openal-soft, libpng, ijg-libjpeg.

Before public redistribution, finish the concrete remaining checks:
1. Resolve the dependencies actually linked into the release, their exact source
   versions and required notices, including transitive components. Confirm the
   full package can be distributed using GPLv3 and that the external source
   instructions cover all required corresponding source.
2. Complete the draft release notes and third-party notice assets using that
   evidence. The GPL text alone is not a replacement for dependency notices.
3. Verify the external source downloads. Keep them available while distributing;
   if they disappear, restore equivalent access or withdraw the binary download.
4. Upload the unchanged archive and completed notices under the reserved tag.
   Use RELEASE_NOTES.md as the release body after removing its draft notice.
5. Download both binary URLs and verify their byte sizes and SHA-256 before
   publishing the manifest changes.

The launcher integration is planned in q2-launcher story 080. The current
launcher intentionally excludes R1Q2 from bootstrap choices even when pinned.
Runtime testing and x86 runtime handling are part of that story.
