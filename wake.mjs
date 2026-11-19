// Wakes sleeping free-tier apps with a real (headless) browser.
//
// Why: Render now answers a request to a sleeping free service with a
// "waking up" page (HTTP 503) and only starts the server when that page's
// script runs in a browser. Plain pings (cron-job.org) get the 503 and the
// server stays asleep. Once a server is awake, the cron-job.org pings keep it
// awake for the rest of its window. The workflow runs every hour, so if a run is
// late or the server falls asleep anyway, the next run wakes it again.
//
// Streamlit Community Cloud apps sleep after about 12 hours without a visitor
// and show a "Zzzz ... Yes, get this app back up!" page. Plain pings don't count
// as visits, so they're opened in the browser too: twice a day is enough to keep
// them awake, and a sleeping one gets its wake button clicked.
//
// Each service is woken only inside its keep-awake window (Indian time), so
// free Render hours aren't spent outside it.
import { chromium } from 'playwright';

const SERVICES = [
  // name, URL, text that appears once the real app answers, window [from, to) in IST hours
  { name: 'ContractIQ', url: 'https://contractiq-1odn.onrender.com/health', ready: 'healthy', from: 10, to: 23 },
  { name: 'CodeAtlas', url: 'https://codeatlas-yygz.onrender.com/health', ready: 'healthy', from: 19, to: 23 },
  // Short evening window: Render's free tier is 750 hours a month for the whole
  // account, and ContractIQ + CodeAtlas already use about 570 of them.
  { name: 'StockVision', url: 'https://stockvision-pro-jbve.onrender.com/health', ready: 'healthy', from: 19, to: 23 },
  // Kavorin Tech company site (runs on a separate Render account with its own
  // 750 free hours, so it can stay awake all day). Its health check also queries
  // the Supabase database, which keeps the free database from pausing.
  { name: 'Kavorin', url: 'https://kavorin-tech.onrender.com/api/v1/health', ready: '"status":"ok"', from: 0, to: 24 },
  // Streamlit apps: opened only at these IST hours (no Render hours used)
  { name: 'MonteCarlo', streamlit: true, url: 'https://ai-monte-carlo-simulator-pro.streamlit.app/', ready: 'AI Monte Carlo Pro', hours: [10, 21] },
  { name: 'StockPrediction', streamlit: true, url: 'https://stocks-price-predictions.streamlit.app/', ready: 'Stock Price Prediction Dashboard', hours: [10, 21] },
];

const WAIT_MS = 4 * 60 * 1000; // a cold start can take a minute or two
const only = (process.env.ONLY || '').toLowerCase(); // manual runs: wake one service, or "all"

function istHourNow() {
  const now = new Date();
  return (now.getUTCHours() + (now.getUTCMinutes() + 30 >= 60 ? 6 : 5)) % 24;
}

function inWindow(s, hour) {
  if (s.hours) return s.hours.includes(hour);
  // Start up to an hour early so the server is up when the window opens
  return hour >= s.from - 1 && hour < s.to;
}

// Streamlit renders the app inside an iframe, so look for the text in every frame
async function pageHasText(page, text) {
  for (const frame of page.frames()) {
    const found = await frame
      .evaluate((t) => !!document.body && document.body.innerText.includes(t), text)
      .catch(() => false);
    if (found) return true;
  }
  return false;
}

async function wakeStreamlit(page, s) {
  await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const deadline = Date.now() + WAIT_MS;
  let clicked = false;
  while (Date.now() < deadline) {
    if (await pageHasText(page, s.ready)) return;
    if (!clicked) {
      const button = page.getByRole('button', { name: /get this app back up/i });
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        clicked = true;
        console.log(`  ${s.name} was asleep, clicked the wake button`);
      }
    }
    await page.waitForTimeout(3000);
  }
  throw new Error(`"${s.ready}" never appeared`);
}

async function wake(browser, s) {
  const page = await browser.newPage();
  const started = Date.now();
  try {
    if (s.streamlit) {
      await wakeStreamlit(page, s);
    } else {
      await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Render's waking page polls the server and reloads itself when it's up
      await page.waitForFunction((t) => document.body && document.body.innerText.includes(t), s.ready, {
        timeout: WAIT_MS,
        polling: 2000,
      });
    }
    console.log(`✓ ${s.name} is awake (${Math.round((Date.now() - started) / 1000)}s)`);
    return true;
  } catch (err) {
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '').catch(() => '');
    console.error(`✗ ${s.name} did not wake within ${WAIT_MS / 60000} min: ${err.message.split('\n')[0]}\n  page said: ${text.replace(/\s+/g, ' ')}`);
    return false;
  } finally {
    await page.close();
  }
}

const hour = istHourNow();
const targets = SERVICES.filter((s) =>
  only === 'all' ? true : only ? s.name.toLowerCase().includes(only) : inWindow(s, hour),
);
console.log(`IST hour ${hour}: waking ${targets.map((s) => s.name).join(', ') || 'nothing (all outside their windows)'}`);

if (targets.length) {
  const browser = await chromium.launch();
  const results = await Promise.all(targets.map((s) => wake(browser, s)));
  await browser.close();
  if (results.includes(false)) process.exit(1); // a failed run shows red on GitHub and emails you
}
