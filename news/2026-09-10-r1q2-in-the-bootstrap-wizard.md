---
template: split
title: r1q2 now installs from the bootstrap wizard
image: img/split-bootstrap.png
order: 10
visibleFrom: 2026-08-01T00:00:00Z
buttons:
  - label: View r1q2 on GitHub
    url: https://github.com/r1q2/r1q2
  - label: Release notes
    url: https://github.com/r1q2/r1q2/releases
---
The bootstrap wizard can now fetch and install r1q2 directly as part of
setting up a new Quake II installation, rather than requiring it to be
placed by hand beforehand.

The wizard verifies the download before handing control back to the rest
of the installation flow, so a partial or corrupted fetch does not leave
an installation in a half-configured state.
