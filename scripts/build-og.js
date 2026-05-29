#!/usr/bin/env node
/**
 * saudade · build-og — convert og-cover.svg → og-cover.png
 *
 * Why this exists: Facebook, Instagram, and Twitter scrapers do not
 * render SVG in link-preview cards. The site's og:image points at
 * og-cover.png (with og-cover.svg as a secondary for LinkedIn/Slack/
 * Discord which do render SVG). This script produces the PNG from the
 * SVG source so the share card looks right on every platform.
 *
 * One-time setup (sandbox network was blocked when this shipped):
 *
 *     npm install --no-save sharp
 *     node scripts/build-og.js
 *
 * Re-run whenever og-cover.svg changes. og-cover.png is committed so
 * the deployed site has it without a build step on Cloudflare Pages.
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SVG  = path.join(ROOT, 'og-cover.svg');
const PNG  = path.join(ROOT, 'og-cover.png');

if (!fs.existsSync(SVG)) {
    console.error(`Missing ${SVG}.`);
    process.exit(2);
}

let sharp;
try { sharp = require('sharp'); }
catch (e) {
    console.error('sharp is not installed.');
    console.error('Run:  npm install --no-save sharp  &&  node scripts/build-og.js');
    process.exit(1);
}

sharp(SVG)
    .resize(1200, 630, { fit: 'contain', background: '#F2EEE3' })
    .png({ quality: 92, compressionLevel: 9 })
    .toFile(PNG)
    .then(() => {
        const kb = (fs.statSync(PNG).size / 1024).toFixed(1);
        console.log(`[ok] ${path.relative(ROOT, PNG)} · ${kb} KB`);
        console.log('Commit it so Facebook/Instagram/Twitter scrapers can fetch it.');
    })
    .catch(err => {
        console.error('Conversion failed:', err.message);
        process.exit(3);
    });
