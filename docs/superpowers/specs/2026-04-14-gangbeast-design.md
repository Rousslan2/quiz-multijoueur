# GangBeast — Design Spec
**Date:** 2026-04-14  
**Project:** ZapPlay  
**Status:** Approved

---

## Overview

Multiplayer physics-based brawler in the style of Gang Beasts. Integrated into ZapPlay as `gangbeast.html`. Supports 1v1, 2v2, 3v3, and 4v4 (free-for-all in all modes). Stock-based lives system (3 lives per player). Three arenas with dynamic environmental hazards.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Physics | Matter.js (client + server) | Real joints/constraints for ragdoll feel, same engine both sides = clean sync |
| Rendering | PixiJS | WebGL, smooth blob rendering, handles 8 players at 60fps |
| Multiplayer | WebSocket (existing server.js) | Consistent with all ZapPlay games |
| Hosting | Railway (existing) | No changes needed |

---

## Architecture

```
Browser
  └── PixiJS renderer (blob display, HUD, UI screens)
  └── Matter.js (local prediction only)
  └── WebSocket client

server.js (extended)
  └── Room management (reuses existing pattern)
  └── Matter.js world per room (authoritative)
  └── Physics tick: 60fps server-side
  └── Broadcast state every 16ms

public/gangbeast.html
  └── Screens: Home → Wait → Mode Select → Ready → Game → GameOver
```

### Sync Protocol

```
Client → Server: INPUT every frame
  { keys: { left, right, up, punch, kick, grab }, seq: n }

Server → Client: STATE every 16ms
  { players: [{ id, x, y, parts[], hp, lives, state }], hazards: [...] }
```

**Client-side prediction:** Input applied locally immediately. Server state received → interpolate if delta < 80ms, snap if > 80ms.

**Bandwidth:** 8 players × ~200 bytes × 60fps ≈ 96KB/s per room. Acceptable.

---

## Character System

Each player is a **compound Matter.js body**:

```
Torso       (circle, r=20) — main body
├── Head    (circle, r=12) — pivot joint top of torso
├── ArmL    (rectangle)    — joint with limited angle
├── ArmR    (rectangle)    — joint with limited angle
├── LegL    (rectangle)    — joint with limited angle
└── LegR    (rectangle)    — joint with limited angle
```

### Ragdoll Feel
- Joints use `stiffness: 0.6` → soft limbs, not full flop
- Impact applies force to hit body part → limbs swing
- KO state: `stiffness: 0.1` → full ragdoll while recovering

### Actions

| Action | Mechanic |
|--------|----------|
| Punch | Force on arm + momentary hitbox |
| Kick | Force on leg downward/forward |
| Grab | Temporary constraint between arm and target body |
| Throw | Release grab + directional impulse |
| Headbutt | Forward force on head hitbox |
| Jump | Upward impulse on torso |

### Stats
- **Lives:** 3 (stock system)
- **Stamina:** Spamming drains stamina; low stamina = weak hits
- **KO timer:** 2s invincibility on respawn

---

## Arenas

Three arenas selectable by host (random if skipped):

### 1. Rooftop
- Setting: Nighttime skyscraper top
- Hazards: Moving cranes (strong knockback), slippery ledge edge, wind gusts (periodic directional force)

### 2. Factory
- Setting: Industrial assembly line
- Hazards: Conveyor belts (constant horizontal force), hydraulic presses (instant KO zone), lava pit below

### 3. Cargo Ship
- Setting: Ocean freighter deck
- Hazards: Waves (tilt entire platform, shifts gravity direction), swinging anchor chains (knockback), open edges

### Hazard Architecture

```javascript
Hazard {
  type: "crane" | "press" | "wave" | "conveyor" | "anchor",
  body: Matter.Body,
  cycle: { period, phase },
  onCollide: (player) => applyEffect(player)
}
```

### Fall Zone
- Falling off arena → lose 1 life → respawn at center with 2s invincibility

---

## Game Modes

| Mode | Players | Notes |
|------|---------|-------|
| 1v1 | 2 | Classic duel |
| 2v2 | 4 | Free-for-all (no team HP pooling) |
| 3v3 | 6 | Free-for-all |
| 4v4 | 8 | Free-for-all, max room size |

All modes are free-for-all — teams are cosmetic grouping only (matching colors). Last player with lives remaining wins.

---

## UI & Screens

### Screen Flow
```
Home → Wait (room code) → Mode Select → Ready (player list) → Game → GameOver
```

### HUD (In-Game)
- Top bar: player avatars with life icons (hearts)
- Stamina bar: small bar below each character on canvas
- Center top: arena name + round info

### Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move | WASD / Arrow keys | Joystick (same as sumo.html) |
| Punch | J | Button A |
| Kick | K | Button B |
| Grab | L | Button C |
| Jump | Space | Joystick up |

### Game Over Screen
- Animated podium (1st / 2nd / 3rd)
- Stats: kills, times grabbed, hazard deaths, survival time
- Buttons: Rematch / Back to Lobby

---

## Integration with ZapPlay

- Added to `public/index.html` game grid as new card (category: `c-action`)
- Added to lobby `sel-game` dropdown in `public/lobby.html`
- `GAME_URLS` and `GAME_ICONS` maps updated in lobby JS
- `server.js`: new room type `gangbeast`, Matter.js world instantiated per room
- New npm dependencies: `matter-js`, `pixi.js` (client-side via CDN)

---

## File Structure

```
public/
  gangbeast.html         — main game page
  gangbeast-physics.js   — shared physics constants (client + server import)
  gangbeast-arenas.js    — arena definitions and hazard configs
server.js                — extended with gangbeast room handling
```

---

## Open Questions / Future Work
- Sound effects (punches, grabs, falls) — not in v1
- Custom character colors/skins — not in v1
- Spectator mode — not in v1
- Ranked/ELO system — not in v1
