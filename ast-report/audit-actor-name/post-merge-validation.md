# Post-merge cleanup and container validation

Candidate: `19e60e2b14a36bb1a1527309dd31e78b7ef28e5d`. Owner-merged commit: `581f30cfaa32b01399422b087b0f0bdc3b800f70`. The complete Git trees match.

Removed 219 unused anonymous Docker volumes after explicit owner approval. Each removal used Docker without force, so a newly attached volume would be refused. All five protected volumes and all ten pre-existing container states (six running) remained intact. Docker went from no free space to 6.9 GB free immediately after cleanup.

The owner merged before the outstanding container gates completed. These checks ran afterward on the identical candidate tree; this report does not claim they passed before merge. No source change or agent merge/deployment occurred.

- `self-hosted`: exit 0, 182.624 seconds. Full output: `self-hosted.log`.
- `hosted-image`: exit 0, 939.136 seconds. Full output: `hosted-image.log`.

The hosted image gate runs `npm run build:hosted` inside the Linux AMD64 image build, then tests the final image. Existing ordinary, Collector and WorkOS staging evidence remains pinned in the earlier review artifact. The initial ENOSPC failure is retained. The cleanup removes the storage blocker; retained MI/habit-hook dispositions are unchanged.
