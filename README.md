# Decision Empire
Persistent civilization strategy game adjudicated by an external LLM via clipboard. No backend, build, or API key.
## Deploy (GitHub Pages)
Push this folder to a repo, Settings > Pages > deploy from branch (root). All paths are relative, so subdirectory hosting works.
## Play
Decide (pick actions, spend CP) > AI Exchange: COPY TURN TO CHATGPT > paste into ChatGPT > paste the JSON reply back > Validate > review diff > Commit turn. Invalid replies are rejected whole; copy the correction prompt back to the LLM.
## Rules owned by the engine
CP, proficiency XP, utility, scheduled-effect execution, schema validation. The AI may only change /vars/*, /params/*, entities, events and propose scheduled effects (optionally recurring via repeat_every/repeat_count).
## Backup and recovery
Saves > Export (JSON incl. adjudications and snapshots) / Import. Roll back to the state before any committed turn; later adjudications are discarded. Data lives in IndexedDB (clearing site data deletes it, so export regularly).
## Tests
`node --test tests/engine.test.js` (Node 18+, dev only).
## Phase 3 systems
- **Delegation** (Decide view, needs Institutions >= 25): a delegated action runs every turn through an agent entity. Low oversight costs 0 CP but the AI is told to model agency risk; high oversight costs 1 CP/turn.
- **Information asymmetry:** entities may be hidden (`visible:false`, `hidden_traits`); the UI shows trust as an estimate whose error band shrinks with intelligence (raised by Scout actions, decays 2/turn). Note: the exported prompt contains everything, so this is imperfect-information gameplay, not secrecy.
- **Branching:** Fork copies the active campaign with its history. Rolling back first archives the abandoned future as its own campaign, so it can never contaminate the restored timeline.
- **Libraries:** `data/technologies.json` gates "Pursue" actions by world variables; `data/factions.json` is sent to the AI as faction archetypes. Both are loaded at startup.
- **Analytics:** expected vs realized utility, luck residual, growth streak, per-variable trends.
