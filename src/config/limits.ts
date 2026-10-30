/** 表单输入与备份导入共用的数值范围（含边界） */
export const LIMITS = {
  heightCm: [100, 250],
  weightKg: [30, 300],
  age: [10, 100],
  extraKcal: [0, 10000],
  /** 单餐热量：与 AI 对话调整的校验保持一致的宽松上限 */
  mealKcal: [1, 3000],
  dailyKcalTarget: [800, 6000],
} as const satisfies Record<string, readonly [number, number]>;

export type LimitKey = keyof typeof LIMITS;

export function inRange(n: unknown, key: LimitKey): n is number {
  const [min, max] = LIMITS[key];
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

