/**
 * Pack Loader — Loads rich Action Packs (.pack.json) from the filesystem.
 *
 * These are the "real" Automator-style workflow templates for Aletheia.
 * They live in `templates/packs/` and are richer than the old DB action_templates.
 *
 * This module is the bridge so the existing templates.js endpoint (and future
 * pack endpoints) can serve them without major rewrites.
 *
 * For v0.1 we keep it simple and filesystem-based. Later we can move to
 * a proper registry or DB + file hybrid.
 */

import fs from 'fs';
import path from 'path';

const PACKS_DIR = path.join(process.cwd(), 'templates', 'packs');

let cachedPacks = null;
let lastLoad = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds for dev

export function loadActionPacks() {
  const now = Date.now();
  if (cachedPacks && (now - lastLoad) < CACHE_TTL_MS) {
    return cachedPacks;
  }

  const packs = [];

  try {
    if (!fs.existsSync(PACKS_DIR)) {
      return packs;
    }

    const files = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.pack.json'));

    for (const file of files) {
      try {
        const fullPath = path.join(PACKS_DIR, file);
        const raw = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(raw);

        // Normalize to a shape that plays nicely with the existing templates response
        const packEntry = {
          id: data.pack?.id || path.basename(file, '.pack.json'),
          name: data.pack?.name || 'Unnamed Pack',
          description: data.pack?.description || '',
          category: data.pack?.category || 'general',
          version: data.pack?.version || '0.1.0',
          icon: data.pack?.icon || null,
          is_file_pack: true,
          source: 'filesystem',
          pack: data,                    // the full rich definition
          workflow_schema: data,         // convenient alias for the old install logic
          required_inputs: [],           // packs are more self-describing via variables
          pack_file: file,
        };

        packs.push(packEntry);
      } catch (err) {
        console.warn(`[pack-loader] Failed to load pack ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.warn('[pack-loader] Error scanning packs directory:', err.message);
  }

  cachedPacks = packs;
  lastLoad = now;
  return packs;
}

export function getPackById(id) {
  const packs = loadActionPacks();
  return packs.find(p => p.id === id) || null;
}

export function getPackByName(name) {
  const packs = loadActionPacks();
  return packs.find(p => p.name === name) || null;
}
