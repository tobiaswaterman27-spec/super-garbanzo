# Outlaw — NPC speech plan (OpenAI, to be added later)

NPC speech is designed so that the words come from what each person actually knows, and the
generation step can be swapped without touching the simulation.

## What exists now

- `src/sim/dialogue.js`
  - `buildContext(sim, npc)` — a compact, factual brief: name, age, trade, personality traits,
    goal, needs (hunger/energy/company), household purse and pantry, illness, family, the NPC's
    six strongest memories (including crimes they witnessed and rumours they heard), their opinion
    of the player, whether they recognise the player from a crime, local bread price and village news.
  - `LocalProvider` — offline template lines picked from that brief (used today).
  - `RemoteProvider` — wired but disabled: posts `{ system, line, voice }` to a game-server
    endpoint and expects `{ text, audioUrl }` back.
  - `remotePrompt(ctx)` — the system prompt built from the brief.
  - `voiceFor(ctx)` — a stable voice descriptor per NPC (sex, age band, temperament).

## Architecture when we add OpenAI

```
browser (game)                      game server (holds the API key)            OpenAI
-----------------                   --------------------------------           -----------------
buildContext(npc)  ── POST /api/npc-dialogue ──►  validate + rate-limit
                                                   chat completion (text)  ──►  model
                                                   text-to-speech (voice)  ──►  TTS
                   ◄──  { text, audioUrl }  ───    cache by (npc, topic, state hash)
play audio, show subtitle
```

- Never call OpenAI from the client: the key would leak. A small proxy (Node/Cloudflare Worker)
  holds it, enforces per-player rate limits and caps reply length.
- Artifacts on claude.ai cannot reach external APIs (CSP), so the remote provider only runs in a
  standalone build of the game.

## Prompting rules

- The system prompt contains only what the NPC could know (the brief). They may be wrong, repeat
  rumours, lie if `hostile`/`greedy`, or refuse to talk.
- Replies: 1–3 sentences, period-flavoured plain English, no modern words, no narration.
- The player's typed or chosen line is passed as the user message. Choice buttons stay available so
  the game is playable without free text.
- Output is validated: length cap, no meta-talk; fall back to `LocalProvider` on error or timeout
  (1.5 s budget).

## Voices

- Map `voiceFor(ctx)` to a fixed TTS voice per NPC, chosen deterministically from the NPC id so a
  person always sounds the same. Children and elders use lighter/heavier voices; `hostile` NPCs a
  gruffer delivery instruction; `friendly` a warmer one.
- Cache audio by `(npcId, hash(text))`. Common greetings can be pre-generated.
- Volume falls off with distance in the world; subtitles always show.

## Memory write-back

- After a remote conversation, the server returns a one-line summary
  (`"The stranger asked about the Hobb's bakery prices"`) which the game stores with
  `sim.remember(npc, summary, 'player', 0.8, 0)`. Memories decay like any other.
- Promises, threats and lies the player makes become memories too, so the world reacts to talk.

## Cost control

- Only NPCs the player is actively talking to use the remote provider; ambient chatter
  (tavern noise, market calls) stays template-based.
- Daily token budget per player; once exceeded, fall back to local lines.
