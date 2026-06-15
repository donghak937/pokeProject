# PokeProject Showdown Backend

This backend runs the real Pokemon Showdown simulator in Node. GitHub Pages cannot run this server, so deploy it as a separate web service.

## Local Run

```bash
npm run backend:dev
```

Default local URL:

```text
http://localhost:8787
```

## API

```http
GET /health
```

```http
POST /battle/start
Content-Type: application/json

{
  "team": [],
  "enemy": [],
  "playerMoves": {},
  "enemyMoves": {},
  "playerAbilities": {},
  "enemyAbilities": {},
  "seed": [1, 2, 3, 4]
}
```

```http
GET /battle/:id
POST /battle/:id/choose

{
  "side": "p1",
  "choice": "move 1"
}
```

Choices follow Pokemon Showdown syntax, for example `move 1`, `move 2`, `switch 2`.

The frontend direct battle mode should normally use this endpoint instead:

```http
POST /battle/:id/player-action

{
  "choice": "move 1"
}
```

`player-action` applies the player choice as `p1`, then makes the opponent choose a legal action automatically.

## Render Deploy

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml`.
4. After deploy, copy the service URL and set the GitHub repository variable `VITE_SHOWDOWN_API_URL` to that URL.
5. Re-run the GitHub Pages workflow.

The backend accepts CORS from any origin for now because this is a friend-only prototype.

You can also test a deployed frontend without rebuilding by opening:

```text
https://donghak937.github.io/pokeProject/?api=https://your-render-service.onrender.com
```

The `api` query parameter is saved in local storage for later visits.
