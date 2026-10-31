# Reading Homework: student and teacher entry

All six Reading Homework products use the same shared ERP identity. A normal lesson URL enters the student path even when a teacher cookie exists. Explicit teacher URLs retain the shared Google session and native class authorization; teacher work stays read-only.

Personal Homework CTAs add `mode=student`, the class code and the Homework `documentId`. The API resolves that document against its verified assignment/version/owner registry and current membership. It never accepts the class or learner from URL parameters as authorization. A remembered or tab-local student session opens directly only when it matches that owner and class. A mismatch asks for the bound owner before any lesson or draft read, preserving the previous shared memory until explicit selection. The document header accompanies student requests and is checked again on the server.

Students continue to select their names; Google login is not required. A document ID is context, not a credential. Legacy generic links remain usable but have no personal owner context. Future CTA registrations produce personal links whenever the class has a verified Classroom mapping. Empty or unmapped rosters do not receive fabricated student identities.

The rollout preserves content versions, grading, answers, draft/history tables, existing class grants and result links. Root Materials and the Headings adapter use the same entry guard as the other Homework types. Backend policy is private and derives class/course pairs from the current authority; it is no longer restricted to the Lesson 12 pilot.

Validation: owner browser scenarios cover all six routes with both generic and personal links, matching memory, mismatching memory/session and explicit teacher entry. Backend SQL/HTTP checks cover class boundaries, revoked membership, changed Classroom mapping, unchanged drafts and independent teacher access. Real production readback is recorded privately; these automated fixtures do not prove physical learner devices.
