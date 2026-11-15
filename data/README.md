# Frozen study records

`study.json` is the app's read-only projection of the StegoGuard-LM `pilot_v0` archive. It contains the original corpus, detector scores, accepted candidates, replay rounds, clean controls, and source checksums. Scores retain their stored precision; generated text retains its original wording.

Regenerate it from the research archive with `scripts/export_data.py`, then run `npm run check` from the project root. The exporter and checks are documented in the root README. Do not treat the recorded experiments as live model outputs or as an estimate of naturally occurring attack prevalence.
