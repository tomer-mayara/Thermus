# PR251 quality selection

Candidate: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`.
Actual parent and complete-candidate main: `8c6d204e8588a664438ba8934ab36670b802525f`.

The complete candidate changes `src/`, so source rule 1 selects the full ordinary
suite, typecheck, portal build and applicable production gates. The validation
worker owns those runs and their final selection record. The fixture-only repair
changes the private fake WorkOS router in the PostgreSQL runtime test. All prior
coverage remains historical because test inputs changed.

The manager separately authorized only Habit now. Run `habit-hooks --branch`
with the pinned complete-candidate main. Review each reported location and keep
snooze empty. No build, coverage collector, metrics process or checker is
selected for execution until validation hands back and the manager authorizes it.
