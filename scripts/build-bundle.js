#!/usr/bin/env node
/**
 * saudade · zero-dep IIFE bundler.
 *
 * The modules in this repo are all standalone IIFEs guarded by
 * `if (window.X) return;`. That means a build is just a deterministic
 * concatenation in dependency order — no esbuild required.
 *
 * Output:
 *   dist/bundle/saudade.core.js    auth, account, schengen, schengen-form,
 *                                  empty, welcome, footer-rule
 *   dist/bundle/saudade.cover.js   masthead, cover, cover-edition
 *
 * If esbuild is installed, it will be used to additionally minify each
 * bundle. Otherwise the concatenation is shipped as-is (still valid JS).
 *
 * Usage:  node scripts/build-bundle.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'dist', 'bundle');
// Production bundle is also written to repo root so index.html can reference
// it directly without a server build step. Commit these files.
const PUBLIC = ROOT;

const BUNDLES = {
    'saudade.core.js': [
        'saudade-auth.js',
        'saudade-account.js',
        'saudade-schengen.js',
        // v649 — saudade-schengen-form.js + saudade-tax-form.js removed.
        // Both were superseded by saudade-stays-form.js which writes to
        // saudade.{schengen,tax}.stays directly. Kept the source files in
        // the tree for reference; just dropped from the production bundle.
        'saudade-tax.js',
        'saudade-coverage.js',
        'saudade-coverage-form.js',
        'saudade-stays-form.js',
        'saudade-empty.js',
        'saudade-welcome.js',
        'saudade-demo.js',
        'saudade-import.js',
        'saudade-personal.js',
        'saudade-homes.js',
        'saudade-letters.js',
        'saudade-desks.js',
        'saudade-contribute.js',
        'saudade-focus.js',
        'saudade-footer-rule.js'
    ],
    'saudade.editorial.js': [
        'saudade-cover.js',
        'saudade-cover-edition.js',
        'saudade-masthead.js',
        'saudade-edition.js',
        'saudade-edition.js'.length > 0 ? null : null    // placeholder for future
    ].filter(Boolean)
};

const BANNER = (date, name) => `/*! saudade · ${name} · built ${date} · ` +
    `https://saudade.app — concatenated IIFE modules, see /scripts/build-bundle.js */\n`;

function tryEsbuild(input, output) {
    try {
        const esbuild = require('esbuild');
        esbuild.buildSync({
            entryPoints: [input],
            outfile: output.replace(/\.js$/, '.min.js'),
            minify: true,
            format: 'iife',
            target: 'es2019',
            sourcemap: true,
            logLevel: 'silent'
        });
        return true;
    } catch (e) { return false; }
}

function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const date = new Date().toISOString();
    let bundleCount = 0;
    let totalIn = 0, totalOut = 0;
    for (const [name, files] of Object.entries(BUNDLES)) {
        const present = files.filter(f => fs.existsSync(path.join(ROOT, f)));
        if (!present.length) continue;
        let body = BANNER(date, name);
        for (const f of present) {
            const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
            totalIn += src.length;
            body += `\n/* ── ${f} ──────────────────────────────────────────────────── */\n`;
            body += src.endsWith('\n') ? src : src + '\n';
        }
        const outFile = path.join(OUT, name);
        fs.writeFileSync(outFile, body, 'utf8');
        // Also publish to repo root so the live HTML can reference it. The
        // committed file is the production artefact; dist/bundle/ is the
        // development copy.
        const publicFile = path.join(PUBLIC, name);
        fs.writeFileSync(publicFile, body, 'utf8');
        totalOut += body.length;
        bundleCount++;
        const min = tryEsbuild(outFile, outFile);
        const sizeKb = (body.length / 1024).toFixed(1);
        console.log(`[ok]  ${name}: ${present.length} modules · ${sizeKb} KB${min ? ' (+ .min.js via esbuild)' : ''}`);
        console.log(`      → ${path.relative(ROOT, publicFile)} (committed) + ${path.relative(ROOT, outFile)} (dev)`);
    }
    console.log(`\nBuilt ${bundleCount} bundle(s) into ${path.relative(ROOT, OUT)}/`);
    console.log(`Total: ${(totalIn/1024).toFixed(1)} KB → ${(totalOut/1024).toFixed(1)} KB (concatenated, unminified)`);
    console.log('Install esbuild for additional minified .min.js outputs:  npm i -D esbuild');
}

if (require.main === module) main();
