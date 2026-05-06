/**
 * Fix Tiled JSON exports — run after every Tiled export:  node fix-tilesets.js
 *
 * Handles three issues that appear after a Tiled re-export:
 *  1. External .tsx references   → embed full tileset data inline
 *  2. Absolute local image paths → replace with relative assets/maps/ paths
 *  3. Duplicate tileset names    → rename second occurrence to avoid Phaser conflicts
 */
const fs   = require('fs');
const path = require('path');

const MAPS_DIR = path.join(__dirname, 'client', 'assets', 'maps');

// ── Known tileset definitions ──────────────────────────────────────────────
// Add a new entry here whenever you add a new tileset .tsx to your project.
const TSX_DEFS = {
  'Room_Builder_free_32x32.tsx': {
    columns: 17, image: 'assets/maps/Room_Builder_free_32x32.png',
    imageheight: 736, imagewidth: 544,
    name: 'Room_Builder_free_32x32', tilecount: 391,
    tileheight: 32, tilewidth: 32, margin: 0, spacing: 0,
  },
  'Interiors_free_32x32.tsx': {
    columns: 16, image: 'assets/maps/Interiors_free_32x32.png',
    imageheight: 2848, imagewidth: 512,
    name: 'Interiors_free_32x32', tilecount: 1424,
    tileheight: 32, tilewidth: 32, margin: 0, spacing: 0,
  },
};

// Image filename → canonical relative path served by Express
const IMAGE_PATH_MAP = {
  'Room_Builder_free_32x32.png': 'assets/maps/Room_Builder_free_32x32.png',
  'Interiors_free_32x32.png':   'assets/maps/Interiors_free_32x32.png',
};

// Process all .json files in the maps directory
const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(MAPS_DIR, file);
  let map;
  try {
    map = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.log(`❌ Parse error in ${file}: ${e.message}`);
    continue;
  }

  let changed = false;
  const nameCount = {};  // track how many times each name has been seen

  map.tilesets = map.tilesets.map(ts => {
    // 1. Embed external .tsx references
    if (ts.source) {
      const tsxFile = path.basename(ts.source);
      const def = TSX_DEFS[tsxFile];
      if (def) {
        changed = true;
        ts = { firstgid: ts.firstgid, ...def };
      } else {
        console.warn(`  ⚠️  Unknown .tsx: ${ts.source} — add it to TSX_DEFS in fix-tilesets.js`);
      }
    }

    // 2. Fix absolute / relative image paths
    if (ts.image) {
      const basename = path.basename(ts.image).replace(/\\/g, '/');
      const canonical = IMAGE_PATH_MAP[basename];
      if (canonical && ts.image !== canonical) {
        ts = { ...ts, image: canonical };
        changed = true;
      }
    }

    // 3. Deduplicate names — second occurrence of a name gets a "_B" suffix
    if (ts.name) {
      nameCount[ts.name] = (nameCount[ts.name] || 0) + 1;
      if (nameCount[ts.name] > 1) {
        const newName = ts.name + '_B';
        ts = { ...ts, name: newName };
        changed = true;
      }
    }

    return ts;
  });

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(map, null, 1));
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`✔  OK (no changes needed): ${file}`);
  }
}
