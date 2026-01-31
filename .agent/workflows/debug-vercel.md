---
description: Fetch and analyze Vercel production logs to debug deployment issues
---

1. Fetch the latest production logs (limit 100 lines to capture startup/runtime context) and save to artifact
   // turbo
   npx vercel logs --limit 100 > vercel_logs_latest.txt 2>&1

2. Check for explicit "Error" or "Exception" keywords (Case insensitive)
   // turbo
   grep -E -i "error|exception|timeout|crash" vercel_logs_latest.txt || echo "✅ No obvious error keywords found."

3. View the captured log file for analysis
   // turbo
   cat vercel_logs_latest.txt
