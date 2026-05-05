# /photos/

City and editorial photographs referenced from `data/listening.json` and
`data/cafes-*.json`. These files are **not** committed to the repository
because each carries a licence and credit obligation that the editor
verifies offline (see [CONTENT-LICENSE.md](../CONTENT-LICENSE.md) §2).

## Expected structure

```
photos/
├── cities/
│   ├── lisbon-alfama.webp
│   ├── porto-quiet.webp
│   ├── tokyo-quiet.webp
│   └── …
└── cafes/
    └── seoul/
        └── …
```

## Format

- `webp` is the project default. Fall back to `jpg` when needed.
- Long edge ≥ 1600 px. Listening Room crops at 16:10.
- Strip EXIF location for privacy unless the photographer explicitly opts in.

## Licence checklist (per CONTENT-LICENSE.md §2)

Every file deposited here MUST have:

1. A `*.txt` sidecar at the same path with the licence string and
   credit line — e.g. `lisbon-alfama.webp.txt` containing
   ```
   Licence: OWN-PHOTO
   Credit:  LEEJAEJIN, 2026-04-15
   Source:  Camera, Praça do Comércio
   ```
2. Or, if not editor-shot, an Unsplash / Pexels link + photographer name.

A future `scripts/validate-content.js` extension will fail the build if
any referenced photo is present without its sidecar.

## Why this folder exists at all

`data/listening.json` references `default_photo_url: "/photos/cities/X.webp"`.
Even when the file is absent, the Listening Room renders a paper
placeholder cleanly (see saudade-listening.js — placeholder lives
BEHIND the `<img>` and stays visible if the image fails to load).

## Adding a photo (editor workflow)

```bash
# Drop the webp.
cp ~/lisbon-alfama-1600.webp photos/cities/lisbon-alfama.webp

# Drop the licence sidecar.
cat > photos/cities/lisbon-alfama.webp.txt <<EOF
Licence: OWN-PHOTO
Credit:  LEEJAEJIN, 2026-04-15
Source:  Camera, Praça do Comércio
EOF

# Verify.
ls -la photos/cities/lisbon-alfama.*
```

The image will now appear in the Listening Room's Lisbon view on next
page load.
