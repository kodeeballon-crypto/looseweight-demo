import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type {
  DailyRecord,
  Exercise,
  Meal,
  MealChange,
  MealKey,
  NutritionAnalysis,
  NutritionCache,
  PlanChatMessage,
  Profile,
  Settings,
  TrainingPrefs,
  WeekPlan,
  Weekday,
  WorkoutChange,
  WorkoutDay,
  WorkoutLog,
  WorkoutPlan,
} from '../types';
import { sortRecords } from '../domain/calc';
import { applyMealChanges, mergeMemory, trimChat } from '../domain/planChat';
import { applyWorkoutChanges as mergeWorkoutChanges, completeAll, toggleDone } from '../domain/workout';
import { pruneCache } from '../domain/nutrition';
import { toast } from './toast';
import type { ExportData } from './dataio';

export const STORAGE_KEY = 'looseweight-v1';

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-flash',
  directMode: false,
};

interface State {
  profile: Profile | null;
  records: DailyRecord[];
  plan: WeekPlan | null;
  settings: Settings;
  seenBadges: string[];
  /** AI 对话提炼的长期饮食要求 */
  planMemory: string[];
  /** 饮食周表 AI 对话记录（最近 30 条） */
  planChat: PlanChatMessage[];
  /** 训练条件（首次生成前填写） */
  trainingPrefs: TrainingPrefs | null;
  workoutPlan: WorkoutPlan | null;
  /** 每天已完成动作的快照 */
  workoutLog: WorkoutLog;
  /** AI 教练对话记录（最近 30 条） */
  workoutChat: PlanChatMessage[];
  /** AI 教练提炼的长期训练要求 */
  workoutMemory: string[];
  /** 今日营养结构的 AI 分析缓存（最近 14 天，不导出） */
  nutritionCache: NutritionCache;

  setProfile: (p: Profile) => void;
  upsertRecord: (r: DailyRecord) => void;
  deleteRecord: (date: string) => void;
  setEncouragement: (date: string, text: string) => void;
  setPlan: (plan: WeekPlan) => void;
  updateMeal: (weekday: Weekday, key: MealKey, meal: Meal) => void;
  applyChanges: (changes: MealChange[]) => void;
  appendChat: (m: PlanChatMessage) => void;
  markChatApplied: (id: string) => void;
  clearChat: () => void;
  updateMemory: (add: string[], remove: string[]) => void;
  removeMemory: (text: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  markBadgesSeen: (ids: string[]) => void;
  importData: (d: ExportData) => void;
  clearAll: () => void;

  setTrainingPrefs: (p: TrainingPrefs) => void;
  setWorkoutPlan: (p: WorkoutPlan) => void;
  updateWorkoutDay: (weekday: Weekday, day: WorkoutDay) => void;
  updateExercise: (weekday: Weekday, id: string, ex: Exercise) => void;
  applyWorkoutChanges: (changes: WorkoutChange[]) => void;
  toggleExercise: (date: string, ex: Exercise) => void;
  completeToday: (date: string, exercises: Exercise[]) => void;
  appendWorkoutChat: (m: PlanChatMessage) => void;
  markWorkoutChatApplied: (id: string) => void;
  clearWorkoutChat: () => void;
  updateWorkoutMemory: (add: string[], remove: string[]) => void;
  removeWorkoutMemory: (text: string) => void;
  setNutrition: (a: NutritionAnalysis) => void;
}

/** localStorage 写满/不可用时给出提示，而不是静默失败 */
let warned = false;
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      warned = false;
    } catch {
      if (!warned) {
        warned = true;
        toast('本地存储空间已满或不可用，数据可能无法保存，建议到设置页导出备份', 'error');
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: null,
      records: [],
      plan: null,
      settings: DEFAULT_SETTINGS,
      seenBadges: [],
      planMemory: [],
      planChat: [],
      trainingPrefs: null,
      workoutPlan: null,
      workoutLog: {},
      workoutChat: [],
      workoutMemory: [],
      nutritionCache: {},

      setProfile: (profile) => set({ profile }),

      upsertRecord: (r) => {
        const others = get().records.filter((x) => x.date !== r.date);
        set({ records: sortRecords([...others, r]) });
      },

      deleteRecord: (date) => set({ records: get().records.filter((r) => r.date !== date) }),

      setEncouragement: (date, text) =>
        set({ records: get().records.map((r) => (r.date === date ? { ...r, encouragement: text } : r)) }),

      setPlan: (plan) => set({ plan }),

      updateMeal: (weekday, key, meal) => {
        const plan = get().plan;
        if (!plan) return;
        set({
          plan: {
            ...plan,
            days: plan.days.map((d) => (d.weekday === weekday ? { ...d, meals: { ...d.meals, [key]: meal } } : d)),
          },
        });
      },

      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),

      applyChanges: (changes) => {
        const plan = get().plan;
        if (plan) set({ plan: applyMealChanges(plan, changes) });
      },

      appendChat: (m) => set({ planChat: trimChat([...get().planChat, m]) }),

      markChatApplied: (id) => set({ planChat: get().planChat.map((m) => (m.id === id ? { ...m, applied: true } : m)) }),

      clearChat: () => set({ planChat: [] }),

      updateMemory: (add, remove) => set({ planMemory: mergeMemory(get().planMemory, add, remove) }),

      removeMemory: (text) => set({ planMemory: get().planMemory.filter((s) => s !== text) }),

      markBadgesSeen: (ids) => set({ seenBadges: Array.from(new Set([...get().seenBadges, ...ids])) }),

      importData: (d) =>
        set({
          profile: d.profile,
          records: sortRecords(d.records),
          plan: d.plan,
          seenBadges: d.seenBadges,
          planMemory: d.planMemory ?? [],
          planChat: d.planChat ?? [],
          trainingPrefs: d.trainingPrefs ?? null,
          workoutPlan: d.workoutPlan ?? null,
          workoutLog: d.workoutLog ?? {},
          workoutChat: d.workoutChat ?? [],
          workoutMemory: d.workoutMemory ?? [],
          nutritionCache: {},
          // 保留本机的 API Key
          settings: d.settings ? { ...get().settings, ...d.settings, apiKey: get().settings.apiKey } : get().settings,
        }),

      clearAll: () =>
        set({
          profile: null,
          records: [],
          plan: null,
          seenBadges: [],
          planMemory: [],
          planChat: [],
          settings: DEFAULT_SETTINGS,
          trainingPrefs: null,
          workoutPlan: null,
          workoutLog: {},
          workoutChat: [],
          workoutMemory: [],
          nutritionCache: {},
        }),

      setTrainingPrefs: (trainingPrefs) => set({ trainingPrefs }),

      setWorkoutPlan: (workoutPlan) => set({ workoutPlan }),

      updateWorkoutDay: (weekday, day) => {
        const p = get().workoutPlan;
        if (p) set({ workoutPlan: mergeWorkoutChanges(p, [{ weekday, next: day }]) });
      },

      updateExercise: (weekday, id, ex) => {
        const p = get().workoutPlan;
        if (!p) return;
        set({
          workoutPlan: {
            ...p,
            days: p.days.map((d) => (d.weekday === weekday ? { ...d, exercises: d.exercises.map((e) => (e.id === id ? ex : e)) } : d)),
          },
        });
      },

      applyWorkoutChanges: (changes) => {
        const p = get().workoutPlan;
        if (p) set({ workoutPlan: mergeWorkoutChanges(p, changes) });
      },

      toggleExercise: (date, ex) => set({ workoutLog: toggleDone(get().workoutLog, date, ex) }),

      completeToday: (date, exercises) => set({ workoutLog: completeAll(get().workoutLog, date, exercises) }),

      appendWorkoutChat: (m) => set({ workoutChat: trimChat([...get().workoutChat, m]) }),

      markWorkoutChatApplied: (id) => set({ workoutChat: get().workoutChat.map((m) => (m.id === id ? { ...m, applied: true } : m)) }),

      clearWorkoutChat: () => set({ workoutChat: [] }),

      updateWorkoutMemory: (add, remove) => set({ workoutMemory: mergeMemory(get().workoutMemory, add, remove) }),

      removeWorkoutMemory: (text) => set({ workoutMemory: get().workoutMemory.filter((s) => s !== text) }),

      setNutrition: (a) => set({ nutritionCache: pruneCache({ ...get().nutritionCache, [a.date]: a }) }),
    }),
    {
      name: STORAGE_KEY,
      version: 4,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        const arr = (v: unknown) => (Array.isArray(v) ? v : []);
        const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
        return {
          ...s,
          planMemory: arr(s.planMemory),
          planChat: arr(s.planChat),
          trainingPrefs: s.trainingPrefs ?? null,
          workoutPlan: s.workoutPlan ?? null,
          workoutLog: obj(s.workoutLog),
          workoutChat: arr(s.workoutChat),
          workoutMemory: arr(s.workoutMemory),
          nutritionCache: obj(s.nutritionCache),
        } as unknown as State;
      },
      partialize: (s) => ({
        profile: s.profile,
        records: s.records,
        plan: s.plan,
        settings: s.settings,
        seenBadges: s.seenBadges,
        planMemory: s.planMemory,
        planChat: s.planChat,
        trainingPrefs: s.trainingPrefs,
        workoutPlan: s.workoutPlan,
        workoutLog: s.workoutLog,
        workoutChat: s.workoutChat,
        workoutMemory: s.workoutMemory,
        nutritionCache: s.nutritionCache,
      }),
    },
  ),
);
