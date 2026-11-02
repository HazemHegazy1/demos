/*
 * Playwright checks from CLAUDE.md for the demos passed as args.
 *   node tests/run-demo-tests.js omaryahia-dental-dubai ponytail-mirdif
 * Env: LIBS=<dir containing node_modules/{gsap,lenis}> serves the CDN scripts
 * locally when the sandbox cannot reach the CDN.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const LIBS = process.env.LIBS;
const EXPECT = { 'omaryahia-dental-dubai': '971502195151', 'ponytail-mirdif': '971504562611' };
const VIEWPORTS = process.env.VP ? [process.env.VP.split('x').map(Number)] : [[390, 844], [1024, 469], [1280, 720], [1440, 900]];
const LANGS = process.env.LANG_ONLY ? [process.env.LANG_ONLY] : ['en', 'ar'];
const demos = process.argv.slice(2);
fs.mkdirSync(SHOTS, { recursive: true });

const local = {
  'gsap.min.js': 'gsap/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'gsap/dist/ScrollTrigger.min.js',
  'lenis.min.js': 'lenis/dist/lenis.min.js',
};

async function setupRoutes(page) {
  await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, (route) => {
    const f = route.request().url().split('/').pop();
    if (LIBS && local[f]) return route.fulfill({ path: path.join(LIBS, 'node_modules', local[f]), contentType: 'application/javascript' });
    return route.continue();
  });
  await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route(/fonts\.gstatic\.com/, (r) => r.abort());
}

// fraction of pixels that differ from the most common colour, fixed UI hidden
async function contentRatio(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    const w = (c.width = Math.min(img.width, 400));
    const h = (c.height = Math.round(img.height * w / img.width));
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    let top = 0;
    for (const v of hist.values()) top = Math.max(top, v);
    return 1 - top / (w * h);
  }, buf.toString('base64'));
}

async function run(demo, [vw, vh], lang, reduced) {
  const tag = `${demo} ${vw}x${vh} ${lang}${reduced ? ' reduced-motion' : ''}`;
  const fails = [];
  const fail = (m) => fails.push(m);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: vw < 500 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') fail('console error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await setupRoutes(page);
  await page.addInitScript(() => {
    // sample the fixed nav during the whole intro: when visible it must be inside the viewport
    window.__navBad = [];
    const tick = () => {
      const n = document.querySelector('nav.top, nav#nav, nav');
      if (n) {
        const r = n.getBoundingClientRect(), o = +getComputedStyle(n).opacity;
        if (o > 0.05 && r.bottom > 0.5 && r.top < -0.5) window.__navBad.push(`nav top=${r.top.toFixed(1)} opacity=${o.toFixed(2)} at ${Math.round(performance.now())}ms`);
      }
      if (performance.now() < 9000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('file://' + path.join(ROOT, demo, 'index.html'));
  await page.waitForTimeout(reduced ? 1500 : 6500); // let loader/intro finish
  if (lang === 'ar') {
    await page.evaluate(() => (document.querySelector('#langBtn,#lang,.lang')).click());
    await page.waitForTimeout(1200);
    if (await page.evaluate(() => document.documentElement.lang) !== 'ar') fail('language did not switch to ar');
  }

  const header = () => page.evaluate(() => {
    const el = document.querySelector('nav.top, nav#nav, nav');
    if (!el) return { err: 'no header' };
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const out = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, pos: cs.position, op: +cs.opacity, bad: [] };
    out.vw = innerWidth; out.vh = innerHeight;
    // every visible descendant of interest must be inside the viewport and topmost
    el.querySelectorAll('a,button,.brand i,.logo').forEach((c) => {
      const b = c.getBoundingClientRect();
      if (!b.width || !b.height) return;
      if (b.top < -0.5 || b.left < -0.5 || b.right > innerWidth + 0.5 || b.bottom > innerHeight + 0.5) out.bad.push('clipped: ' + (c.textContent || c.className).trim().slice(0, 20) + ' top=' + b.top.toFixed(1));
      const t = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1));
      if (t && !el.contains(t)) out.bad.push('covered: ' + (c.textContent || c.className).trim().slice(0, 20) + ' by ' + t.tagName + '.' + t.className);
    });
    return out;
  });
  const checkHeader = async (label) => {
    const h = await header();
    if (h.err) return fail(h.err);
    const hidden = h.bottom <= 0.5; // intentionally slid away while scrolling down
    if (hidden) return;
    if (h.top < -0.5) fail(`header top ${h.top.toFixed(1)} < 0 (${label})`);
    if (h.op < 0.99) fail(`header opacity ${h.op} (${label})`);
    h.bad.forEach((b) => fail(`header ${b} (${label})`));
  };

  await checkHeader('top');
  (await page.evaluate(() => window.__navBad.slice(0, 3))).forEach((m) => fail('intro offset: ' + m));

  // wa.me links
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => a.href));
  const js = await page.evaluate(() => document.documentElement.outerHTML.match(/wa\.me\/[^"'`?$ ]*/g) || []);
  const want = EXPECT[demo];
  [...links, ...js].forEach((l) => { const m = l.match(/wa\.me\/(\d+)/); if (m && m[1] !== want) fail('wrong wa.me number ' + m[1]); });
  const tpl = await page.evaluate(() => document.documentElement.outerHTML.includes('wa.me/${'));
  if (!links.length && !tpl) fail('no wa.me links found');

  // scroll in half-screen steps
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(vh / 2);
  let blanks = 0, n = 0, worst = 1;
  for (let y = 0; y <= total - vh + step; y += step) {
    await page.evaluate((yy) => { window.scrollTo(0, yy); }, y);
    await page.mouse.wheel(0, 0);
    await page.waitForTimeout(reduced ? 250 : 900);
    const sy = await page.evaluate(() => scrollY);
    await checkHeader('scrollY=' + Math.round(sy));
    const ow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (ow) fail(`horizontal overflow at scrollY=${Math.round(sy)}`);
    await page.evaluate(() => { const a = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && !e.closest('.pin-spacer') && !e.parentElement.closest('.pin-spacer') && !e.querySelector('h1,h2,h3,article,section')); a.forEach((e) => (e.dataset.pv = e.style.visibility, e.style.visibility = 'hidden')); });
    const buf = await page.screenshot();
    await page.evaluate(() => document.querySelectorAll('[data-pv]').forEach((e) => { e.style.visibility = e.dataset.pv; delete e.dataset.pv; }));
    const ratio = await contentRatio(page, buf);
    worst = Math.min(worst, ratio);
    if (ratio < 0.012) { blanks++; fail(`blank viewport (${(ratio * 100).toFixed(2)}% content) at scrollY=${Math.round(sy)}`); }
    n++;
    fs.writeFileSync(path.join(SHOTS, `${demo}_${vw}x${vh}_${lang}${reduced ? '_rm' : ''}_${String(n).padStart(3, '0')}.png`), buf);
    if (n > 140) break;
  }
  const ow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  if (!ow) fail('horizontal overflow');
  await ctx.close();
  console.log(`${fails.length ? 'FAIL' : 'ok  '} ${tag}  steps=${n} min-content=${(worst * 100).toFixed(1)}%`);
  fails.slice(0, 8).forEach((f) => console.log('       - ' + f));
  return fails.length;
}

let browser;
(async () => {
  browser = await chromium.launch();
  let bad = 0;
  for (const demo of demos) {
    for (const vp of VIEWPORTS) for (const lang of LANGS) bad += await run(demo, vp, lang, false);
    bad += await run(demo, [1280, 720], 'en', true);
  }
  await browser.close();
  console.log(bad ? `\n${bad} run(s) failed` : '\nall runs passed');
  process.exit(bad ? 1 : 0);
})();
