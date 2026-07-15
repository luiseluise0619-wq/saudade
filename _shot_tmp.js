const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8799/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1300);
  await p.evaluate(() => document.querySelectorAll('.sdd-welcome,[aria-modal="true"]').forEach(e=>e.remove()));
  await p.waitForTimeout(200);
  const lang = await p.evaluate(() => { const e=document.querySelector('.sdd-cover-edition'); return e?getComputedStyle(e).display:'ABSENT'; });
  const theme = await p.evaluate(() => { const e=document.querySelector('.sdd-theme-toggle'); if(!e) return 'ABSENT'; const r=e.getBoundingClientRect(); return `y=${Math.round(r.y)} disp=${getComputedStyle(e).display}`; });
  console.log('language switcher:', lang, lang==='none'?'✅ HIDDEN':'❌');
  console.log('theme toggle:', theme, '(should be near top y~16-24)');
  // theme still works?
  await p.click('.sdd-theme-toggle').catch(()=>{}); await p.waitForTimeout(150);
  await p.click('.sdd-theme-opt[data-skin="sepia"]').catch(()=>{}); await p.waitForTimeout(200);
  console.log('theme click → data-skin:', await p.evaluate(()=>document.documentElement.getAttribute('data-skin')));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
