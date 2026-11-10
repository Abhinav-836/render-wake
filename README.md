# render-wake

Wakes Abhinav's Render free-tier backends (ContractIQ, CodeAtlas, Strategy Lab)
at the start of their keep-awake windows, using a headless browser.

Render answers plain pings to a sleeping free service with a 503 "waking up"
page and only starts the server when that page runs in a browser, so the
cron-job.org pings can keep a server awake but can't wake it. This GitHub
Actions job opens each backend in Chromium just before its window; the
cron-job.org pings then keep it awake until the window ends.

| Service | Window (IST) | cron-job.org ping |
|---|---|---|
| ContractIQ | 10:00–23:00 | every 10 min |
| CodeAtlas | 19:00–23:00 | every 10 min |
| Strategy Lab | 19:00–23:00 | every 10 min |

Manual run: Actions → "Wake Render backends" → Run workflow (type a service
name, or `all`). Change windows in `wake.mjs` and in cron-job.org together.
Keep the total under Render's 750 free hours a month (about 24 hours a day
across all services).
