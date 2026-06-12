# Sprite Source Notes

This prototype is prepared for sprite URLs through the optional `spriteUrl` field on each Pokemon record.

## Candidate Sources

- PokeRogue assets: likely useful for pixel-style sprites, but the asset repository uses Creative Commons non-commercial/share-alike terms for many files and has file-level license metadata. Treat it as prototype-only until exact files and attribution requirements are locked.
- PokeAPI sprite URLs: convenient for development, but do not assume the Pokemon artwork itself is freely reusable for a public fan game.

Useful references:

- https://github.com/pagefaultgames/pokerogue-assets
- https://github.com/pagefaultgames/pokerogue

## Current Decision

Keep sprite integration pluggable. The UI renders a letter badge now and automatically switches to pixel art when `spriteUrl` is supplied.

Before shipping publicly:

1. Pick the exact asset source.
2. Record its license and attribution.
3. Avoid monetization unless the asset and IP rights are clearly compatible.
