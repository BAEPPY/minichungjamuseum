# Map delivery assets

These WebP files are delivery copies of the existing generated map illustrations in `public/art`. The original PNGs remain unchanged. Every copy keeps the original image dimensions and byte-identical alpha, so sprite calibration points, collision placement and transparency masks continue to use the same geometry.

Avatar sprite sheets use lossless RGBA encoding to preserve the RGB thresholds used by clothing recoloring. The other illustrations use quality-94 RGB encoding with lossless alpha. `manifest.json` records source/output paths, hashes, byte counts and decoded image fidelity checks.

Rebuild from the repository root with Pillow/libwebp installed:

```sh
python scripts/build_map_art.py
```

The script also writes `src/map-art-bounds.js`, containing the exact source alpha > 18 bounding rectangles. Map loading can use these bounds instead of scanning every large image on the main thread.

The script verifies dimensions and alpha for all assets, exact RGBA for avatars, and unchanged source hashes. Different libwebp versions may produce different compressed bytes; the decoded-image checks remain the important constraints.
