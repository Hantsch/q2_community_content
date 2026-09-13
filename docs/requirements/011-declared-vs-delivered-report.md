---
id: 011
title: The declared-versus-delivered report
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

This is the story the whole project was started for. The news contract is deliberately forgiving:
a `cover` without an image is not rejected, it is quietly downgraded to `text`; a button pointing at
`gist.github.com` is not an error, it simply disappears; an entry with an empty body is dropped
while the rest of the feed carries on. Every one of those rules is right at runtime and invisible to
the author.

The report states them out loud, before publishing, in the author's terms: what you declared, what
the launcher will actually deliver, and — wherever those differ — which rule made the difference.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-11, section 7.

## Acceptance Criteria

- [ ] **AC1** — Every entry gets a verdict naming its declared template and the template it will be
      delivered as.
- [ ] **AC2** — A `split` or `cover` with no usable image is reported as falling back to `text`,
      naming the image path that was not found.
- [ ] **AC3** — An unknown `template` value is reported as falling back to `text` — as a note, not
      an error, because the contract treats it as a supported outcome.
- [ ] **AC4** — A dropped entry names the rule that dropped it: missing title, empty body,
      frontmatter that did not parse, an index row without `id` or `file`, or a duplicate `id`.
- [ ] **AC5** — Each button is reported as kept or dropped, and a dropped one names the reason —
      host not `github.com` or `raw.githubusercontent.com`, missing label or url, or being the
      fourth button.
- [ ] **AC6** — Visibility is reported as published, scheduled from a date, or expired since a date,
      evaluated against a clock the caller supplies rather than the wall clock.
- [ ] **AC7** — The delivered order is reported per entry, and two entries sharing an `order` value
      are flagged with the tie-break the launcher will apply.
- [ ] **AC8** — Every verdict is derived from the mirrored pipeline's own output; the report
      classifies and explains, it does not decide.

## Open Questions

- What severity model does the report use — error / warning / info? A fallback is not a failure, but
  it is almost always a mistake, and flattening both into "warning" loses that.
- Is a scheduled entry a finding at all, or just a state? It is often exactly what the author
  intended.
- Should the report be able to explain *why* an entry is in a given position, beyond its `order`
  value — for example when a tie-break decided it?

## Plan

<Filled by `/refine 011`.>

## Deliverables

<Filled by `/refine 011`.>

## Model Hints

<Filled by `/refine 011`.>

## Acceptance Tests

<Filled by `/refine 011`.>

## Done

<Filled by `/build 011`.>
