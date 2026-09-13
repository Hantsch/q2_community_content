# Q2PRO starter bundle redistribution request

Draft, not sent. Before sending, add the sender's details and confirm that
"non-commercial" accurately describes the project's business and funding model.

Contact route: [ZeniMax/Bethesda — General Info or forwarding through Support](https://www.zenimax.com/en/more).
Ask for forwarding to an authorized representative responsible for id Software/Quake II.

This draft covers the originally proposed bundle with both patch PAKs. The
[research findings](q2pro-bundle-licensing-2026-09-08.md#2-pak-contents-and-multiplayer-requirements)
explain that `pak2.pak` is technically optional. Finalize the intended file list
before sending; if player files from the demo's separate `players/` directory are
included, list those explicitly in the request as well.

**Subject: Permission clarification — free portable Quake II demo + 3.20 patch bundle with Q2PRO**

Hello Bethesda / id Software licensing team,

I am developing a community launcher for Quake II. I would like to clarify the
redistribution rights before publishing a free, non-commercial portable starter
ZIP through GitHub Releases at:

https://github.com/Hantsch/q2_community_content

The proposed package would contain the open-source Q2PRO engine and game module,
together with the following unchanged files from the original publicly released
Quake II demo and point-release archives:

- `Install/Data/baseq2/pak0.pak` from `q2-314-demo-x86.exe`, installed as `baseq2/pak0.pak`;
- `baseq2/pak1.pak` and `baseq2/pak2.pak` from `q2-3.20-x86-full-ctf.exe`.

The PAK files would remain byte-for-byte unchanged. The packaging would remove
the need to run the historical installers or combine several downloads on the
user's machine. Users would download and extract one ZIP into a playable directory.
The intended users include people who have not purchased the full game.

No retail-only game data, soundtrack, expansion assets, or re-release assets
would be included. Original copyright notices and applicable license texts would
be retained, and Q2PRO's GPL obligations would be handled separately, including
providing its corresponding source code. The project would be identified as
unofficial and would not imply endorsement by id Software or Bethesda.

Section 3 of the February 1998 demo license permits free electronic distribution
with the license attached. However, the 3.20 archive contains the original retail
license, and I have not found a specific grant covering redistribution of its
individual PAK files in a combined portable package.

Could you please confirm, or direct me to an applicable published permission:

1. Whether the unchanged demo PAK may be redistributed in this portable ZIP with
   Q2PRO, without the original executable installer and legacy engine binaries.
2. Whether the unchanged `pak1.pak` and `pak2.pak` from the official 3.20 point
   release may be included and used together with the demo data by users who do
   not own the retail game.
3. Whether free public distribution through GitHub Releases and additional
   download mirrors is permitted, and whether any territorial or other conditions apply.
4. Which original documentation, license notices, attribution, or user acceptance
   steps must accompany the package.

If this requires a separate permission, could an authorized rights/licensing
representative provide written permission identifying the allowed files and scope?
If your team is not responsible for these rights, please forward this request to
the appropriate team or rights holder.

For precise identification, the source archives have these SHA256 hashes:

```text
q2-314-demo-x86.exe
7ace5a43983f10d6bdc9d9b6e17a1032ba6223118d389bd170df89b945a04a1e

q2-3.20-x86-full-ctf.exe
f82197c8c8089202a4b3a85d8833b0c2e827a709d205c760369407c212488baa
```

The proposed data files have these SHA256 hashes:

```text
baseq2/pak0.pak (demo)
cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09

baseq2/pak1.pak (3.20 patch)
678210ecd1b27dde1c645660333a1a7b139d849425793859657f804d379b62ad

baseq2/pak2.pak (3.20 patch)
cb88d584ef939d08e24433a6cf86274737303fac2bbd94415927a75e6b269dd8
```

Thank you for helping clarify this before publication.

Kind regards,

[Name and contact details]
