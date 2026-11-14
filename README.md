# render-wake

Wakes Abhinav's Render free-tier backends (ContractIQ and CodeAtlas)
at the start of their keep-awake windows, using a headless browser.

Render answers plain pings to a sleeping free service with a 503 "waking up"
page and only starts the server when that page runs in a browser, so the
cron-job.org pings can keep a server awake but can't wake it. This GitHub
Actions job runs every hour from 09:07 to 23:07 IST and opens each backend
whose window is open in Chromium; the cron-job.org pings keep it awake in
between. Running hourly matters because GitHub often starts scheduled runs
late, and cron-job.org switches a job off after too many failed pings.

| Service | Window (IST) | cron-job.org ping |
|---|---|---|
| ContractIQ | 10:00–23:00 | every 10 min |
| CodeAtlas | 19:00–23:00 | every 10 min |

Manual run: Actions → "Wake Render backends" → Run workflow (type a service
name, or `all`). Change windows in `wake.mjs` and in cron-job.org together.
Keep the total under Render's 750 free hours a month (about 24 hours a day
across all services).