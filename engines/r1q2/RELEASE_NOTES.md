# R1Q2 b8012 - Visual Studio 2022, Windows x86

DRAFT: complete the dependency/source checks in README.md before publishing.

This is an unchanged mirror of the
[upstream b8012_fix release](https://github.com/vic7or777/R1Q2-MSVC/releases/tag/b8012_fix),
published July 28, 2025. It contains r1q2.exe, ref_r1gl.dll,
baseq2/gamex86.dll and dedicated.exe. It contains no Quake II game data.
R1Q2 by Rich "R1CH" / r1ch.net; MSVC rebuild by vic7or777; original engine
copyright (C) 1997-2001 Id Software, Inc. This is a community mirror, not a new
official R1CH release. [R1CH project page](https://r1ch.net/old-stuff).

## Download integrity

File: R1Q2-b8012-msvs2022.7z
Size: 751580 bytes
SHA-256: a41c46f4732c05755091658fc3c27d3ff03e3f2048bbd6cec56882e5e346a7aa

## Source code and license

[Download the source for this release](https://github.com/vic7or777/R1Q2-MSVC/archive/8af268c795293406f6f7d4328bf0d4f225294d6e.zip)
or [browse the exact commit](https://github.com/vic7or777/R1Q2-MSVC/tree/8af268c795293406f6f7d4328bf0d4f225294d6e).
Use the Visual Studio solution and dependency manifests from this commit.

The reviewed R1Q2 engine and renderer headers permit GPL version 2 or later.
The intended mirror distribution uses GPL version 3, including its section 6(d)
external-source option. See the accompanying GPL-3.0.txt and completed
third-party notices. This software comes without warranty.
The community repository's MIT license does not apply to these binaries.

DRAFT SOURCE COMPLETENESS ITEM: add verified source/version links and notices
for the dependencies actually included in these binaries before publication.
The engine source ZIP alone does not contain their source code.

## Running

These are 32-bit binaries and require the x86 Microsoft Visual C++ runtime
(VCRUNTIME140.dll and Universal CRT). The archive does not bundle that runtime.
Select the renderer with `set vid_ref "r1gl"`. Game data must be supplied
separately. Windows 10/11 runtime testing is pending.
