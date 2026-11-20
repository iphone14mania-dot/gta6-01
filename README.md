# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/iphone14mania-dot/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/iphone14mania-dot/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Coral Harbor** — a complete 3D open-world crime game in the spirit of GTA 6, built
for make.fun's "Make GTA 6" bounty. Milo Reyes arrives in a sun-soaked coastal city
with $250 and a borrowed jacket; the Harbor Crew needs a driver, and the CHPD needs
someone to chase.

What is in the game:

- **An open world to explore on foot and by car** — a seeded grid city with downtown
  towers, a beach and ocean, palms, streetlights, a stadium, docks and an airfield,
  all at golden hour. Traffic fills the streets and pedestrians stroll the sidewalks.
- **Driving** — arcade handling with handbrake drifts, six car types to steal and
  drive (sedan, sports, SUV, truck, taxi, police cruiser), damage, smoke and explosions.
- **A 5-star wanted system** — CHPD cruisers chase and ram, roadblocks at 3 stars,
  the CONDOR-1 helicopter with a searchlight at 4, and busts on foot. Break line of
  sight to cool down.
- **Eight story missions** — a delivery run, a car theft, a dockside shootout, a
  3-star getaway, a checkpoint street race, a 90-second manhunt, and a final assault
  on the Vultures' airfield hideout, with cash and respect rewards.
- **Combat** — four weapons (pistol, SMG, shotgun, rifle) with reloading, muzzle
  flashes, enemy gang members with health bars, and a wanted system that answers.
- **A full HUD** — live minimap with mission and police blips, wanted stars, health,
  money, respect ranks, speedometer, weapon and ammo, radio station and objectives.
- **Polish** — title and pause screens, mission-complete and wasted/busted screens,
  synthesized sound (engine, sirens, gunfire, three procedural radio stations),
  saving to localStorage, and a garage that keeps the cars you park.

Everything is original: the city, characters, story, names and music are invented
for this entry. The game is static files under `game/` (three.js vendored as
`game/vendor/three.min.js`) and plays offline in desktop Chrome with no network
request. Screenshots in `screenshots/` are real renders of the game's own code.

## Run it

```sh
node serve.ts
# open http://localhost:8080 — WASD to move/drive, mouse to look, E to enter a car
```

Or hand it in exactly as the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=fcek93em&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
