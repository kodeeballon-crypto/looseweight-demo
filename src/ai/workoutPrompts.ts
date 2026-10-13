import type { ChatMessage } from './client';
import type { Exercise, PlanChatMessage, Profile, TrainingPrefs, WorkoutDay, WorkoutPlan } from '../types';
import { WEEKDAY_LABELS } from '../types';
import { bmiLevel, calcBmi, round1 } from '../domain/calc';
import { prefsText } from '../domain/workout';
import { CHAT_HISTORY_MAX } from './prompts';

const SEX_LABEL = { male: '男', female: '女' } as const;

const COACH_SYSTEM = `你是一名持证健身教练，擅长为减脂人群设计安全、循序渐进、可在家/健身房/户外完成的训练计划。
你只输出一个合法的 JSON 对象，不要输出任何解释文字、不要使用 markdown 代码块。`;

const PLAN_EXAMPLE = `{
  "days": [
    { "weekday": 1, "focus": "下肢力量", "exercises": [
      { "name": "徒手深蹲", "detail": "4 组 × 12 次，膝盖与脚尖同向", "kcal": 60 },
      { "name": "快走", "detail": "20 分钟，微微出汗的速度", "kcal": 110 }
    ] },
    { "weekday": 2, "focus": "休息·拉伸", "exercises": [{ "name": "全身拉伸", "detail": "10 分钟，每个动作保持 30 秒", "kcal": 25 }] }
  ],
  "tips": ["要点1", "要点2"]
}`;

function personText(profile: Profile, weightKg: number): string {
  const bmi = calcBmi(weightKg, profile.heightCm);
  return `${SEX_LABEL[profile.sex]}，${profile.age} 岁，身高 ${profile.heightCm} cm，当前体重 ${round1(weightKg)} kg，目标体重 ${profile.targetWeightKg} kg，BMI ${bmi.toFixed(1)}（${bmiLevel(bmi).label}）`;
}

// ---------- 生成训练周表 ----------

export function workoutPlanMessages(profile: Profile, weightKg: number, prefs: TrainingPrefs, memory: string[] = []): ChatMessage[] {
  const memoryBlock = memory.length ? `\n【长期要求】（必须遵守）\n${memory.map((s) => `- ${s}`).join('\n')}\n` : '';
  const user = `请为我制定一周（周一到周日）的减脂训练计划。

【个人信息】${personText(profile, weightKg)}
【训练条件】${prefsText(prefs)}
${memoryBlock}
【要求】
1. 7 天中安排 ${prefs.daysPerWeek} 个训练日，其余为休息日：休息日 focus 写“休息”或“休息·拉伸”，exercises 为 0–2 个轻量动作。
2. 训练日 2–5 个动作，当天总时长不超过 ${prefs.minutes} 分钟；力量与有氧交替，避免同一肌群连续两天训练。
3. 动作必须适合训练条件里的场地；新手选择低冲击、易掌握的动作；严格避开伤病/限制中提到的部位和动作。
4. detail 写清组数×次数或时长，并附一句动作要点。
5. kcal 按我当前体重估算该动作的热量消耗，整数，单个动作 10–800。
6. tips 给出 3 条以内简短实用的训练要点。
7. days 数组必须正好 7 项，weekday 依次为 1–7（周一=1）。

【输出 JSON 结构示例（只示意 2 天，你需要输出完整 7 天）】
${PLAN_EXAMPLE}`;

  return [
    { role: 'system', content: COACH_SYSTEM },
    { role: 'user', content: user },
  ];
}

// ---------- 换一个动作 ----------

export function replaceExerciseMessages(profile: Profile, prefs: TrainingPrefs, day: WorkoutDay, ex: Exercise): ChatMessage[] {
  const min = Math.max(10, Math.round(ex.kcal * 0.8));
  const max = Math.round(ex.kcal * 1.2);
  const others = day.exercises
    .filter((e) => e.id !== ex.id)
    .map((e) => `- ${e.name}（${e.detail}）`)
    .join('\n');

  const user = `请把当天（重点：${day.focus}）的【${ex.name}】换成另一个动作。

原动作：${ex.name}（${ex.detail}，约 ${ex.kcal} kcal）
当天其他动作：
${others || '- 无'}
【个人信息】${SEX_LABEL[profile.sex]}，${profile.age} 岁
【训练条件】${prefsText(prefs)}

要求：
1. 消耗在 ${min}–${max} kcal 之间。
2. 与原动作和当天其他动作不重复，训练目的与当天重点一致。
3. 适合训练条件里的场地与基础，避开伤病/限制。
4. detail 写清组数×次数或时长，并附一句动作要点。

只输出 JSON：{ "name": "动作名", "detail": "组数/时长与要点", "kcal": 整数 }`;

  return [
    { role: 'system', content: COACH_SYSTEM },
    { role: 'user', content: user },
  ];
}

// ---------- 教练对话 ----------

/** 周表压缩为文本：周一｜重点｜动作｜组数/时长｜kcal；休息日无动作输出一行 */
export function workoutToText(plan: WorkoutPlan): string {
  const days = [...plan.days].sort((a, b) => a.weekday - b.weekday);
  return days
    .flatMap((d) => {
      const w = WEEKDAY_LABELS[d.weekday - 1];
      return d.exercises.length ? d.exercises.map((e) => `${w}｜${d.focus}｜${e.name}｜${e.detail}｜${e.kcal}`) : [`${w}｜${d.focus}｜（无动作）`];
    })
    .join('\n');
}

export interface WorkoutAdjustInput {
  profile: Profile;
  weightKg: number;
  prefs: TrainingPrefs;
  plan: WorkoutPlan;
  memory: string[];
  history: PlanChatMessage[];
  userText: string;
}

const ADJUST_SYSTEM = `${COACH_SYSTEM}
你同时是用户的私人教练：会根据用户反馈（时间、器械、身体感受、伤病）对现有训练周表做最小必要的修改，也会耐心回答动作要领、训练安排、酸痛恢复等问题。`;

export function adjustWorkoutMessages({ profile, weightKg, prefs, plan, memory, history, userText }: WorkoutAdjustInput): ChatMessage[] {
  const ctx = `【个人信息】${personText(profile, weightKg)}
【训练条件】${prefsText(prefs)}
【长期要求】${memory.length ? memory.join('；') : '暂无'}

【当前训练周表】（星期｜重点｜动作｜组数/时长｜kcal）
${workoutToText(plan)}

【我的新消息】
${userText}

【要求】
1. 如果我只是提问或寻求指导，changes 为空数组，在 reply 中直接给出具体、可操作的指导（不超过 200 字）。
2. 需要修改周表时，以“整天”为单位给出修改后的完整一天（focus + 全部 exercises），只改与我的消息相关的天，其他天不要动；reply 用 40–120 字说明改了什么、为什么。
3. 新动作必须符合训练条件与长期要求；训练日 2–5 个动作，当天总时长不超过 ${prefs.minutes} 分钟；kcal 按我当前体重估算，单个 10–800 的整数；detail 写组数×次数或时长并附要点。
4. 如果我表达了长期适用的约束（如“膝盖不好”“只有一副哑铃”），写入 memoryAdd（每条不超过 20 字）；如果我撤销了某条已有长期要求，把原文写入 memoryRemove。一次性情况（如“今天加班”）不要写入记忆。
5. 不做医疗诊断；提到疼痛或伤病时提醒必要时就医，并给出更安全的替代动作。
6. weekday 为 1–7（周一=1）。

只输出 JSON：{ "reply": "说明或指导", "changes": [{ "weekday": 3, "focus": "重点", "exercises": [{ "name": "动作", "detail": "组数/时长与要点", "kcal": 整数 }] }], "memoryAdd": [], "memoryRemove": [] }`;

  return [
    { role: 'system', content: ADJUST_SYSTEM },
    ...history.slice(-CHAT_HISTORY_MAX).map((h) => ({ role: h.role, content: h.text }) as ChatMessage),
    { role: 'user', content: ctx },
  ];
}
