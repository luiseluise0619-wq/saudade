const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8799/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1300);
  await p.evaluate(() => document.querySelectorAll('.sdd-welcome,[aria-modal="true"]').forEach(e=>e.remove()));
  await p.waitForTimeout(200);
  await p.click('.dock-btn[data-cat="tz"]'); await p.waitForTimeout(1200);
  const arch = await p.evaluate(() => {
    const days = Array.from(document.querySelectorAll('.sdd-disp-archive-day'));
    return { count: days.length, dates: days.map(d => (d.querySelector('.sdd-disp-archive-date')?.textContent||'').trim()), sampleText: days.map(d=>(d.innerText||'').replace(/\n+/g,' ').slice(0,60)) };
  });
  console.log('PAST WEEK archive days:', arch.count);
  console.log('dates:', arch.dates.join(' | '));
  arch.sampleText.forEach((t,i)=>console.log(`  day ${i}: ${t}`));
  // distinct check
  const uniq = new Set(arch.sampleText);
  console.log('distinct content?', uniq.size===arch.sampleText.length && arch.count>0 ? 'YES ✅' : (arch.count===0?'EMPTY':'REPEATED ❌'));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
