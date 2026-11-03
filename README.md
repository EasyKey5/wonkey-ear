# Wonkey Ear

An ear training game. A tonic drones underneath while a second note plays, and you name its scale degree on the wheel. Score 9 out of 10 to unlock the next note, then try hard mode, where the tonic fades away.

Play it at https://easykey5.github.io/wonkey-ear/

## Develop

```bash
npm install
npm run dev
```

`npm test` runs the game logic tests and `npm run check` runs the type check. Every push to `main` runs both, then publishes to GitHub Pages.

The sound prototype used to choose the drone and note voices is on the `prototype/sound` branch.
