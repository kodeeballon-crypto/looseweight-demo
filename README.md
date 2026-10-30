# Lighten · Weight Loss Tracker (`looseweight-demo`)

A personal weight-loss web application: **Daily Weight Check-in → Trend Charts & Stats → AI Weekly Fat-Loss Meal Plan + Workout Plan → Automatic Calorie Calculation (Intake − Burned) & AI Encouragement**.
All data is stored locally in your browser (`localStorage`, key: `looseweight-v1`). Supports seamless **Chinese / English (`中文` / `EN`)** switching with DeepSeek AI translation for generated plans and encouragement.

## Preview

**Today** · Daily weight check-in, calorie ring (outer net intake / inner red workout burn), AI encouragement, and daily completion progress

![Today](docs/screenshots/dashboard.png)

**AI Meal Plan** · 7 days × 4 meals, with an AI Dietitian chat panel on the right to adjust your plan

![AI Meal Plan](docs/screenshots/meal-plan.png)

**Today's Nutrition Breakdown** · Macronutrient calorie ratio pie chart, Low / Optimal / High ratings, AI dietitian comments & suggestions

![Today's Nutrition Breakdown](docs/screenshots/nutrition.png)

**AI Workout Plan** · Check off today's completed exercises to sync burned calories to the dashboard; AI Coach chat on the right adjusts workouts by day

![AI Workout Plan](docs/screenshots/workout.png)

**Personal Profile** · Daily routine determines recipe complexity, automatically calculating BMI / BMR / TDEE / Daily Calorie Target

![Personal Profile](docs/screenshots/settings.png)

## Quick Start

```powershell
npm install      # First-time setup
npm run dev      # Open http://localhost:5173
```

Other scripts:
- `npm test` — Run Vitest unit tests
- `npm run build` — TypeScript check + production build
- `npm run preview` — Preview the production build (includes the local AI proxy)

## Configure AI

1. Go to **Settings → AI Configuration**, click a preset (**DeepSeek / Qwen / Kimi / OpenAI**) to auto-fill the Base URL and model name, or enter any OpenAI-compatible endpoint manually.
2. Enter your **API Key** (stored locally on your device only; excluded when exporting backups).
3. Click **Test Connection** and verify the connection succeeds.

| Provider | Base URL | Default Model |
|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash` |
| Qwen (DashScope) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Kimi (Moonshot) | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |

**CORS Proxy Note:** By default, requests are sent to local `/ai-proxy/*` and forwarded by the Vite middleware to the target base URL specified in the `x-target-base` header (see [`vite.config.ts`](vite.config.ts)). Therefore, please access the app via `npm run dev` or `npm run preview`. Enable **Direct Mode** only if your API endpoint natively supports browser CORS.

When AI is not configured, check-in encouragement uses built-in offline templates, and the Meal Plan / Workout Plan pages will prompt you to configure AI first.

## Workflow

1. **First Launch** → Fill out your **Personal Profile** (height, starting weight, target weight, age, activity level, dietary preferences) → Automatically calculates BMI, BMR, TDEE, and your Daily Calorie Target.
2. **Meal Plan** → Click **Generate Weekly Plan** (7 days × 4 meals, with today's column highlighted). Click any cell to edit manually, or click **🔄 Swap** on hover to replace a single meal. Below the table, click **Analyze Today** in **🥧 Today's Nutrition Breakdown** to let AI estimate protein, carbs, and fat grams, render a calorie-share pie chart, rate each macro (Low / Optimal / High), and provide actionable suggestions.
3. **Workout Plan** → Set your **Workout Preferences** (location, duration per session, days per week, fitness level, physical limitations) → Generate a 7-day workout plan (today's column highlighted in red). Check off completed exercises or click **🔥 Complete All Today** to sync burned calories to the Today calorie ring, Today's Completion card, and Stats chart. Use the **AI Coach** chat on the right to ask form questions or adjust workouts day by day.
4. **Today** → Enter today's weight, check which planned meals you ate, and log any extra calories → Click **Check In 💪**. Automatically computes net calories (`Intake − Burned`), generates a personalized encouragement message, and unlocks milestone badges. Use the **中文 / EN** switch in the top-right corner of the Today page to switch languages at any time.
5. **Stats** → View weight trend (with 7-day moving average & target line), calorie chart (intake bars + red burned bars + net intake line), estimated goal date, and edit/delete historical check-in records.
6. **Settings** → View the badge wall, export / import JSON backups (including workout logs and AI memory), or clear all local data.

## Data Integrity

- **Meal snapshots** — each check-in stores a snapshot (name, portions, kcal) of the meals you ticked, just like completed workouts. Editing, swapping, or regenerating the meal plan later never changes historical intake or the on-track rate.
- **Migration caveat** — records created before snapshots existed (storage v4 and older, or older backups) are frozen once using the meal plan saved at upgrade/import time. Meals that had already been overwritten before that cannot be recovered.
- **Backup import** — imported files are validated *and* normalized before replacing local data: numeric strings such as `"400"` become numbers, real calendar dates, value ranges (see [`src/config/limits.ts`](src/config/limits.ts)), activity levels, unique dates/weekdays, and settings types are checked. English encouragement and meal snapshots survive an export → import round trip; the API key is never exported.
- **AI translation** — translated text is written back only if the Chinese source still matches what was sent; responses that arrive after the plan was edited, regenerated, cleared, or replaced by an import are discarded. Failed translations are retried the next time the data or language changes.

## Project Structure

```
src/
  config/      limits (shared input ranges for forms and backup import),
               ai (provider presets, default settings, per-scenario timeouts & temperatures)
  domain/      Pure domain logic: calc (BMI/BMR/TDEE/stats/projection), records (check-in meal snapshots),
               badges (streaks & milestones), encourage (offline templates), workout (burn/completion/net intake),
               nutrition (macro shares & ratings)
  ai/          client (OpenAI-compatible caller + error normalization), prompts (meal & encourage prompts),
               parse (JSON extraction & validation), workoutPrompts / parseWorkout, nutritionPrompts / parseNutrition
  i18n/        Bilingual dictionary (zh / en), reactive language store, interpolation helpers,
               LocalizedError (error codes translated at throw time: AI, parse, backup import)
  store/       useStore (Zustand + localStorage persistence), toast, dataio (backup export + import validation/normalization)
  services/    encourage (AI encouragement + offline fallback), aiTranslate (DeepSeek Zh→En sync),
               translateMerge (stale-safe merging of translation results)
  hooks/       useWide (responsive breakpoint hook)
  components/  pages/ (lazy-loaded per route)  styles/
```

Charts use on-demand ECharts imports (line / bar / pie + the components actually used), and pages are code-split with `React.lazy`.

> ⚕️ AI diet and workout suggestions are for reference only. If you have chronic conditions, injuries, or physical discomfort, please consult a physician, registered dietitian, or certified fitness coach.
