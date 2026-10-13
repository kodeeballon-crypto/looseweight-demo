import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { DailyRecord, Meal, MealChange, MealKey, PlanChatMessage, Profile, Settings, WeekPlan, Weekday } from '../types';
import { sortRecords } from '../domain/calc';
import { applyMealChanges, mergeMemory, trimChat } from '../domain/planChat';
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
          // 保留本机的 API Key
          settings: d.settings ? { ...get().settings, ...d.settings, apiKey: get().settings.apiKey } : get().settings,
        }),

      clearAll: () =>
        set({ profile: null, records: [], plan: null, seenBadges: [], planMemory: [], planChat: [], settings: DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        return { ...s, planMemory: Array.isArray(s.planMemory) ? s.planMemory : [], planChat: Array.isArray(s.planChat) ? s.planChat : [] } as unknown as State;
      },
      partialize: (s) => ({
        profile: s.profile,
        records: s.records,
        plan: s.plan,
        settings: s.settings,
        seenBadges: s.seenBadges,
        planMemory: s.planMemory,
        planChat: s.planChat,
      }),
    },
  ),
);
