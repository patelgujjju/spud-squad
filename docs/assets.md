# Asset ledger

The indoor vertical slice (1-1 and 2-1) uses these Poly Haven assets under [CC0 1.0](https://polyhaven.com/license). No CC-BY assets are used, so no attribution screen is required. This ledger preserves each creator and exact source.

| Asset                   | Author                         | Source                                                        | Licence | Use                                                                 |
| ----------------------- | ------------------------------ | ------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| Interior Tiles          | Charlotte Baglioni             | [Poly Haven](https://polyhaven.com/a/interior_tiles)          | CC0-1.0 | Ceramic floor colour, OpenGL normal and AO/roughness/metalness maps |
| Concrete Brick Wall 001 | Dimitrios Savva, Rico Cilliers | [Poly Haven](https://polyhaven.com/a/concrete_brick_wall_001) | CC0-1.0 | Factory wall colour, normal and AO/roughness/metalness maps         |
| Metal Plate             | Rob Tuytel                     | [Poly Haven](https://polyhaven.com/a/metal_plate)             | CC0-1.0 | Slicer Hall floor colour, normal and AO/roughness/metalness maps    |
| Wood Planks             | Amal Kumar                     | [Poly Haven](https://polyhaven.com/a/wood_planks)             | CC0-1.0 | Crates and shelves: colour, normal and AO/roughness/metalness maps  |
| Empty Warehouse 01      | Sergej Majboroda               | [Poly Haven](https://polyhaven.com/a/empty_warehouse_01)      | CC0-1.0 | 1K HDR reflection environment, prefiltered on load                  |

Exact upstream file URLs, authors, byte counts and MD5 checksums are recorded in `apps/client/art/sources.json`. `fetch-sources.mjs` verifies source downloads. `build-textures.mjs` packs four external surfaces and original enamel, burlap, rubber and paint surfaces into an atlas, then generates mipmapped Basis ETC1S KTX2 colour, normal and ORM maps for High, Medium and Low. Uncompressed sources stay in ignored `art/.cache/`; only optimised outputs ship.

The washer, crates, sacks, shelves, railings, console, slicer housing/blade/beacon, conveyor, exit and pedestal are original project models made in `apps/client/art/build-models.mjs`. They are merged by material and exported as meshopt-compressed `public/assets/factory/props.glb`. Spud, porous skin bump texture, labels, window, signs, static contact AO, puddle masks, favicon and particle shapes are original project code, with no third-party asset author or licence. Web Audio generates all sound; no sound files ship.

Allowed sources are Poly Haven, ambientCG, Kenney, Quaternius CC0 assets, or Sketchfab CC0/CC-BY models. Add the exact name, source, author and licence here before introducing one, and add an in-app Credits page if a CC-BY asset is used.

## Software decoder notices

The Basis Universal texture decoder copied from Three.js ships with its Apache-2.0 licence and notice in `public/assets/factory/`. The Three.js MIT licence is included there too. Meshopt is imported from the installed Three.js addon with its upstream MIT notice. These are software dependencies, not art assets.

## Retained prototype fonts

The mature HUD uses system UI fonts. These earlier prototype fonts remain in `/fonts/` but are not loaded by the new stylesheet. Browsers make no Google Fonts requests at runtime.

| Asset                    | Author                     | Local file                                     | Source                                                                                               | Licence                                                    |
| ------------------------ | -------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Lilita One Regular       | Juan Montoreano            | `apps/client/public/fonts/lilita-one.ttf`      | [Google Fonts source](https://github.com/google/fonts/blob/main/ofl/lilitaone/LilitaOne-Regular.ttf) | SIL Open Font License 1.1; bundled in `Lilita-One-OFL.txt` |
| Nunito variable, upright | The Nunito Project Authors | `apps/client/public/fonts/nunito-variable.ttf` | [Google Fonts source](https://github.com/google/fonts/blob/main/ofl/nunito/Nunito%5Bwght%5D.ttf)     | SIL Open Font License 1.1; bundled in `Nunito-OFL.txt`     |

Font files are unmodified upstream releases. Original copyright notices and licence terms remain in the adjacent licence files.
