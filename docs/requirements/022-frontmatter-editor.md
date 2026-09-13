---
id: 022
title: Frontmatter editor with live validation
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Frontmatter is where every silent failure starts. A field name that is not in the contract is simply
ignored, a button URL pointing at the wrong host disappears, a fourth button is dropped, and a
`template` value nobody recognises quietly becomes `text`. None of it produces an error anywhere.

Editing it as a form rather than as raw YAML turns most of those into impossibilities and the rest
into something the author is told about while typing, not after publishing.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-20.

## Acceptance Criteria

- [ ] **AC1** — `template`, `title`, `order`, `image`, `visibleFrom`, `visibleUntil` and `buttons`
      are editable as fields.
- [ ] **AC2** — The fields offered follow the selected template: no `image` field for `text`, and
      the `image` field is marked as required for `split` and `cover`.
- [ ] **AC3** — A button URL the launcher would reject is flagged while typing, naming the rule it
      breaks.
- [ ] **AC4** — Adding a fourth button is flagged as one the launcher will drop, and which one.
- [ ] **AC5** — A date that is not a valid ISO 8601 instant is flagged before it can be saved.
- [ ] **AC6** — No field allows a value that would carry presentation into the published surface —
      no HTML, no CSS, no colour or layout value.
- [ ] **AC7** — Editing changes nothing on disk until the entry is saved; leaving an entry with
      unsaved changes warns rather than discarding silently.

## Open Questions

- Is a raw-frontmatter escape hatch needed for a field the form does not know? It would let an
  author work ahead of a contract change — and let them write the unsupported fields the contract
  explicitly warns against.
- Should `order` be editable here at all, given story 027 owns reordering? Two ways to change the
  same number invite them disagreeing.
- What does the date field offer — a picker, or a text field with validation? A picker has to make a
  decision about time zones that the contract leaves to ISO 8601.

## Plan

<Filled by `/refine 022`.>

## Deliverables

<Filled by `/refine 022`.>

## Model Hints

<Filled by `/refine 022`.>

## Acceptance Tests

<Filled by `/refine 022`.>

## Done

<Filled by `/build 022`.>
