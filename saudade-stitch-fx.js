// saudade · stitch FX
// tiny side-effects to bring the saudade-stitch.css patterns to life:
//   1. Inject .sdd-waveform (16 bars) into the listening room header.
//   2. Toggle .is-playing on the waveform via the audio element's events.
//   3. (Future) more decorative inserts kept here so the override layer
//      stays one css + one js file.
//
// Loaded last via index.html. IIFE guarded.
'use strict';

(function() {
    if (window.SAUDADE_STITCH_FX) return;
    window.SAUDADE_STITCH_FX = { mounted: true };

    const WAVE_BARS = 16;
    const WAVE_HOST_SELECTOR = '.sdd-listen-head';

    function makeWaveform() {
        const w = document.createElement('div');
        w.className = 'sdd-waveform';
        w.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < WAVE_BARS; i++) {
            const b = document.createElement('span');
            b.className = 'sdd-waveform__bar';
            w.appendChild(b);
        }
        return w;
    }

    function ensureWaveform() {
        document.querySelectorAll(WAVE_HOST_SELECTOR).forEach(host => {
            if (host.querySelector('.sdd-waveform')) return;
            host.appendChild(makeWaveform());
        });
    }

    function bindAudioToWaveforms() {
        // The listening module is a singleton with a global Audio element —
        // we don't have a stable handle, so listen for play/pause events
        // at the capture phase on any <audio> in the document.
        document.addEventListener('play', (e) => {
            if (e.target && e.target.tagName === 'AUDIO') {
                document.querySelectorAll('.sdd-waveform').forEach(w => w.classList.add('is-playing'));
            }
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target && e.target.tagName === 'AUDIO') {
                document.querySelectorAll('.sdd-waveform').forEach(w => w.classList.remove('is-playing'));
            }
        }, true);
    }

    function start() {
        ensureWaveform();
        bindAudioToWaveforms();
        // Listening room re-renders on city switch / mode toggle — observe
        // body to re-inject. Cheap: we only act when a header appears.
        const mo = new MutationObserver(() => ensureWaveform());
        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
