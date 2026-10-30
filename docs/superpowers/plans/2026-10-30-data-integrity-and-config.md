# Data integrity and configuration implementation plan

> **For agentic workers:** Use test-driven-development for behavioral fixes; independent file groups may use dispatching-parallel-agents. Review the combined working tree before completion.

**Goal:** Fix the four reviewed data consistency problems and consolidate duplicated configuration and untranslated UI literals.

**Architecture:** Daily records own immutable meal snapshots. Import validates and normalizes data before replacing state. AI translations apply only when their source still matches current data. Shared configuration owns AI presets/timeouts and input constraints; existing domain policies retain their values.

**Tech Stack:** React, TypeScript, Zustand persist, Vite, Vitest, ECharts.

## Constraints and decisions

- Work in the explicitly named existing project at `D:/FanHua/my-project/code/looseweight-demo`; preserve the user's existing dirty files and screenshots.
- Do not move the project, replace installed dependencies, call paid AI services, or commit/publish changes.
- User's “一起修改” authorizes the preceding review recommendations and hardcoding cleanup; proceed without another design approval.
- Keep the existing storage key and default ports to retain browser data access.
- Legacy records have no original menu: capture the currently stored plan once during migration/import; document that older overwritten meals cannot be recovered.
- UI colors, calendar constants, and established health formulas remain domain/design rules; do not make every literal a setting.

## Task 1: Record snapshots and robust imports (root)

Files: `src/types.ts`, `src/domain/calc.ts`, `src/domain/nutrition.ts`, `src/domain/validation.ts`, `src/config/limits.ts`, `src/store/useStore.ts`, `src/store/dataio.ts`, corresponding tests, `CheckInForm.tsx`, `ProfileForm.tsx`, `Stats.tsx`.

- [ ] Add regression tests that store a 400 kcal breakfast, replace the plan with 900 kcal, and still read 400; also test editing weight, migration, and empty plans.
- [ ] Add round-trip import tests for English encouragement and meal snapshots; reject invalid dates/profiles/settings/duplicate days and normalize string kcal to numbers.
- [ ] Run focused tests and observe the reviewed failures.
- [ ] Add `DailyRecord.mealSnapshot?: Partial<Record<MealKey, Meal>>`, `snapshotRecord(record, plan)`, and `recordMeals(record, plan)`; use snapshots for display/intake/nutrition and preserve record metadata on update.
- [ ] Migrate persistence to version 5, freeze legacy records once, and use normalized objects when importing.
- [ ] Centralize input ranges shared by profile/check-in/import validation. Keep established limits unchanged.
- [ ] Run focused tests until passing.

## Task 2: Translation consistency (independent files)

Files: `src/services/aiTranslate.ts`, new translation helper/test modules only.

- [ ] Reproduce late responses applying old names to a new plan, clear/import while pending, changes under the same createdAt, and retries after a failed response.
- [ ] Separate pure translation output from guarded state commits; compare full source content, not just weekday/createdAt.
- [ ] Keep current exports compatible with App/components. Preserve current translations while guarding stale results and handle meal/workout/nutrition/encouragement paths.
- [ ] Run focused regression tests.

## Task 3: Configuration, UI literals, and bundle size (independent files)

Files: `src/config/ai.ts`, `src/ai/client.ts`, its tests, `AiConfig.tsx`, AI call sites except translation/store files, `Charts.tsx`, `MacroPie.tsx`, `Modal.tsx`, dictionaries, `App.tsx`, `EChart.tsx`.

- [ ] Centralize existing provider defaults and request timeout values; presets remain editable through current Settings UI. Root integrates the store default.
- [ ] Move Chinese-only chart/confirmation/loading/error labels into existing bilingual dictionaries.
- [ ] Cover meaningful AI client behavior with regression tests, including timeout while consuming a response body if changed.
- [ ] Import only used ECharts components and lazy-load pages; keep functional chart features.
- [ ] Run focused tests/type checking and report measured build sizes.

## Final integration

- [ ] Reconcile shared AI settings/timeouts and test all store/import/translation changes together.
- [ ] Run `npm test`, `npm run build`, `git diff --check`.
- [ ] Request an independent review of the changed working tree; fix material findings and run relevant regressions.
- [ ] Update README with config locations, migration caveat, and validation results. Report actual scope and any remaining limitations.

## Progress

- Baseline: 152 tests pass; production build passes, main JS 1,551.65 kB / gzip 516.37 kB.
- Review reproductions: old intake 400→900; imported string 400→4000; English encouragement omitted on import; old Egg translation applied to new noodles.
- Done (2026-10-30):
  - Task 1: `DailyRecord.mealSnapshot`, `src/domain/records.ts`, snapshot-first `intakeOf` / `todayMeals`, store freezes on upsert/import, persist v5 migration, `src/config/limits.ts`; `validateImport` rebuilt to normalize (`"400"`→400), validate real dates/ranges/activity/duplicate dates & weekdays/settings, keep `encouragementEn` + snapshots; `buildExport` + round-trip test; Stats edit keeps `encouragementEn`.
  - Task 2: `src/services/translateMerge.ts` guarded merges (source text must match; cleared plan never resurrected); content signatures instead of `createdAt`; failed translations retry on next change.
  - Task 3 (bundle only): ECharts on-demand imports + `React.lazy` pages. Entry JS 334.85 kB / gzip 113.30 kB; EChart chunk 585.56 kB / gzip 198.35 kB (loaded only by chart pages).
  - Verification: 178 tests pass, `npm run build` passes.
- Not done (out of scope of the review fix): AI preset/timeout centralization and remaining Chinese-only chart/dialog literals.
- Done (2026-10-30, hardcoding pass):
  - `src/config/ai.ts`: `AI_PRESETS`, `DEFAULT_SETTINGS`, `AI_TIMEOUT`, `AI_TEMPERATURE`; all 15 timeout and 8 temperature literals replaced.
  - `src/i18n/errors.ts` `LocalizedError`: `AiError`, `ParseError` and backup-import errors now use codes, and their messages follow the UI language.
  - Localized GoalProgress, chart legends/target labels, confirm dialog buttons, badge popup, AI disclaimer (`constants.ts` removed), chat aria-label, Qwen preset label, storage-full toast, default workout focus, document title / `<html lang>`.
  - `WorkoutDay.rest` explicit flag (prompt + parser); keyword fallback uses `/\brest\b/i`.
  - `SEX_LABEL` deduplicated across prompt files.
  - Verification: 184 tests pass, build passes; EN screenshots of Stats / Goal Progress / AI config checked.
- Still open: ~350 inline `lang === 'en' ? … : …` ternaries (migrate to dictionary in batches); chart colors → theme config; BMI standard for English users (product decision).
