# Launch Engine

`/launch` turns a shipped feature into a complete launch packet.

Every feature ships with marketing.

## Output

```text
launch/
├── trailer-30.mp4
├── trailer-60.mp4
├── vertical.mp4
├── thumbnail.png
├── x-thread.md
├── tweets.md
├── press.md
├── screenshots/
├── gifs/
└── changelog.md
```

## Command

Use the local launch skill:

```text
/launch
```

To create the packet skeleton manually:

```bash
npm run launch:scaffold
```

To pull live Radar launch data:

```bash
npm run launch:data
```

## Principle

The launch packet is part of the feature, not an afterthought.

Ship the proof, the story, the screenshots, the short trailers, the thread, the press note, and the changelog together.

## Motion

Launch videos should be built around remembered metaphors, not UI pans.

Default sequence:

```text
Noise -> one particle glows -> Radar locks -> graph grows -> receipts connect -> memory expands -> terminal wakes -> URL
```

## Live Data

Every launch should pull current Radar state from public `GET /v1/*` endpoints into:

```text
launch/live-data.json
launch/live-data.md
```

Use it for video overlays and proof points:

- Routes Observed
- Claims
- Receipts
- Signals
- Latest Narrative
- Graph Nodes
- Provider Count
- Loop Count
