# Listening Homework: shared learner entry

Scandinavian Studies and Horton Castle use `app.mjs?v=20261101-listening-owner1`. Student intent is the default even with a teacher cookie. A contextual `documentId` is resolved at the native `/entry` endpoint before session restoration or protected reads; only the resolved owner/class can be confirmed. Successful manual selection remembers common ERP automatically. Tabs retain their pinned identity/draft when another tab changes common memory. Students do not need Google sign-in.

Teacher intent is explicit (`teacher=1` or `mode=teacher`), uses the existing `listeninghomework` SSO source, then resolves the Doc through `/teacher/entry` under native class permission. The native teacher workspace stays read-only. Retain code/Doc context on change-person/logout and preserve the Lesson 2 alias. Error/denied states do not become a learner session or a successful Google login.

The backend must expose the owner-entry policy and enforce `X-Reading-Homework-Document` on login/work/audio. Its complete runtime/CTA planner integration must be deployed before the new frontend. A Doc is context, not a credential; do not migrate historical Docs grading pipelines or assume a URL code proves a document owner.

Keep Origami PR402 unchanged, including the `20261101-origami1` renderer → transport → catalog cache chain and audio. This package changes only the two existing student entry forms; Origami's own form update follows in its task. Native Homework grading, CAS/history, transcript/audio controls and renderer layout remain unchanged.

`tests/listening-homework-owner-entry-browser.mjs` has13 isolated cases across both real pages, including wrong remembered owner before protected reads, tab/reload/storage errors, explicit teacher scope/logout, legacy alias and three unchanged polling cycles retaining DOM, focus, selection and reading position. The previous controller fails the wrong-owner regression. Real account/device/Docs checks are recorded separately from fixtures.
