# Content types: how to add one

The studio knows each content type through one descriptor; this guide says what a descriptor holds and what else a new type touches.

## Descriptor fields

Every member of `ContentTypeDescriptor` in `studio/src/content-types/descriptor.ts`.

| field         | required | purpose                                                                                                                                                                                               |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | yes      | The type's identifier, one member of the `ContentTypeId` union. Needed in every state; the registry, the navigation and the bridge all key on it.                                                     |
| `label`       | yes      | English display name shown in the navigation and in the state notice, for example `Game data`. Needed in every state.                                                                                 |
| `state`       | yes      | A `ContentTypeState` literal that decides what the studio shows (see States). Needed in every state.                                                                                                  |
| `directory`   | yes      | Repository-relative directory name without a trailing slash. The bridge confines the type's reading to it; writing is allowed there only once the state is `implemented`. Needed in every state.      |
| `indexFile`   | no       | The file the launcher reads the directory through, for example `index.json` or `manifest.json`. Set for `launcher-reads` and `implemented`, absent while there is nothing to read.                    |
| `conceptPath` | no       | Repository-relative path of the concept document. Set for `reserved` types only, so the notice can point at what is planned.                                                                          |
| `reader`      | no       | A function without arguments that reads the directory through the `ContentTypeSource` the registry factory was given. Required for `implemented`; the studio only renders the library when it exists. |
| `validators`  | no       | A `ContentTypeValidators` pair of pure functions of one read. Required for `implemented`; absent otherwise.                                                                                           |

Nested shapes: a `ContentTypeSource` has one method, `read(directory)`, that resolves to a `ContentSourceRead` and never throws, because a failure comes back as a finding on an empty read. `ContentTypeValidators` has `buildReport(read, now)`, which returns a `ContentReport`, and `collectFindings(read)`, which returns `RepositoryFinding` entries; `now` is always supplied by the caller.

## States

- `implemented` - the studio reads and validates the type itself: the library (list, editor, validation) is shown for the selected type.
- `launcher-reads` - the launcher consumes the directory but the studio does not read it yet: a `ContentTypeStateNotice` is shown instead of the library.
- `reserved` - the contract claims the directory and the content is still a concept: a `ContentTypeStateNotice` is shown that points at the concept document.

## Touch points

Generic means derived from the registry, so a new type needs no change there. News-specific means the code names or assumes news today, so a new type needs a change.

- `studio/src/content-types/descriptor.ts` - news-specific: the `ContentTypeId` union lists every id and must gain the new one; the descriptor shape itself is generic.
- `studio/src/content-types/descriptors.ts` - news-specific: this is where the descriptor is added, and the type's reader and validators are bound here.
- `studio/src/content-types/registry.ts` - generic: it builds the registry from the descriptor list, so no change is needed.
- `studio/src/content-types/registry.test.ts` - news-specific: it asserts the registry's ids, order and states, so it needs the new expectation.
- `studio/src/content-types/descriptors.test.ts` - news-specific: it pins each descriptor, so the new or changed descriptor needs a case.
- `studio/src/content-types/shell-independence.test.ts` - news-specific: it holds its own list of ids, which must gain the new id.
- `studio/e2e/content-type-registry.spec.ts` - news-specific: it checks the navigation and the state per type, so it needs the new type's expectation.
- `studio/src/bridge/create-file-bridge.ts` - news-specific: the read route only reads news and refuses every other declared directory, and the image route is confined to `news/img`. The write routes are generic and confine writes to `writableDirectories`, which holds only the directories of `implemented` types.
- `studio/src/bridge/file-bridge-plugin.ts` - generic: the declared and the writable directories are derived from the registry, so a new descriptor is reachable without a change. A type gets no write access until it is `implemented`: the directory of a `reserved` or `launcher-reads` type is readable at most, never writable. It also loads the image rules from `studio/src/contract/launcher-safe-names.ts`.
- `studio/src/bridge/resolve-bridge-path.ts` - generic: it confines a path to the directories it is given; it only mentions news and engines in a comment.
- `studio/src/bridge/write-files.ts` - news-specific for the image write, which creates a file below `news/img`; the entry and index writes are generic over `writableDirectories`.
- `studio/src/bridge/client.ts` - news-specific: `addNewsImage` posts to the news image route, so another type needs its own client call.
- `studio/src/bridge/bridge-protocol.ts` - news-specific for the image shapes such as `AddNewsImageResult`; the read and write shapes are generic.
- `studio/src/contract/launcher-safe-names.ts` - news-specific: re-exports the mirrored news document and image name rules that the image route applies.
- `studio/src/library/use-news-library.ts` - news-specific: the hook that feeds the news library view.
- `studio/src/authoring/write-news-index.ts` - news-specific: the news index row writer; the other modules in `studio/src/authoring/` follow the same news entry format.
- `studio/src/publishing/apply-plan.ts` - news-specific: it targets `news/index.json`; the order and publish plans beside it in `studio/src/publishing/` assume the news index.
- `studio/src/images/image-expectations.ts` - news-specific: the cover, banner and split image expectations of the news templates.
- `studio/src/pages/studio/StudioPage.tsx` - news-specific: the `implemented` branch renders the news library, so a second implemented type needs its own view. The notice branches are generic.
- `studio/src/content-repo/read-content-repo.ts` - news-specific: the reader only knows the news directory and its entry files, so a new type needs its own reader.
- `studio/scripts/validate.ts` - news-specific: the command-line validation only checks news and needs a branch for the new type.
- `studio/tests/boundary.test.ts` - news-specific: it holds the list of published directories that must stay untouched by the studio work, which must gain the new directory.
- `README.md` - news-specific: the contract section describes news and needs the new type's contract.
- `<directory>/README.md` - the placeholder README of the directory, which the type replaces with its real contract for contributors.
- `docs/concepts/<type>-content.md` - the concept document that `conceptPath` points at while the type is reserved.
- `studio/scripts/launcher-core.manifest.ts` - news-specific: it lists the launcher files mirrored today, so a new contract needs an entry, followed by `npm run sync:launcher`.
- `studio/launcher-core.lock.json` - generated by `npm run sync:launcher`; never edited by hand.
- `q2-launcher/scripts/check-content-repo.mjs` - launcher side, news-specific: the launcher's own check of this repository must learn the new type.

## Worked example: news

News is the only implemented type, and its descriptor is `createNewsDescriptor` in `studio/src/content-types/descriptors.ts`. Read it field by field there: `id`, `label` and `directory` name the type, `indexFile` is `index.json`, `state` is `implemented`, `reader` binds the injected source to the news directory, and `validators` bind the two pure checks.

- The reader behind the source is `studio/src/content-repo/read-content-repo.ts`, which reads the index, the entry documents and the images.
- `buildReport` adapts a read for `studio/src/report/build-news-report.ts`, and `collectFindings` adapts it for `studio/src/report/repository-findings.ts`.

Not to be copied, because it is news-specific: the news reader and its file layout, the report adaptation in `toNewsReportInput`, and the library view that `StudioPage` renders for it. A new type brings its own reader, its own adaptation and its own view, and reuses only the descriptor shape and the registry.

## What a content type must not do

- It must not put presentation into the published surface: no CSS, HTML, colours, fonts or layout values, because the launcher owns all of that (see `AGENTS.md`).
- It must not read or write outside its declared `directory`; the bridge confines reads to the declared directories and writes to those of `implemented` types, and refuses the rest.
- It must not carry a second implementation of a contract rule; contract logic comes from `studio/src/launcher-core/`, which is mirrored from the launcher and never hand-edited (see `CLAUDE.md`).

## From reserved to implemented

1. Agree the contract in `q2-launcher` first: the launcher reads the directory, so its format is decided there, not here.
2. Mirror the new contract here with `npm run sync:launcher` after adding the launcher files to `studio/scripts/launcher-core.manifest.ts`.
3. Move `reserved` to `launcher-reads`: the launcher contract must exist and the contract section of the root `README.md` must describe it. Set `indexFile` and drop `conceptPath`.
4. Move `launcher-reads` to `implemented`: the mirror entry, a reader and validators must exist first. Add `reader` and `validators` to the descriptor and give the type its view.
5. Update every touch point above that is news-specific, and extend the tests that list ids and states.
