import type { KcalStatus } from '../types';

export type Scenario =
  | 'first'
  | 'milestone'
  | 'streak30'
  | 'streak7'
  | 'streak3'
  | 'down'
  | 'up'
  | 'kcalOk'
  | 'kcalOver'
  | 'flat';

export interface EncourageContext {
  /** 是否为第一次打卡 */
  isFirst: boolean;
  /** 今日 vs 上一次记录的体重变化（kg），无上一次为 null */
  delta: number | null;
  streak: number;
  kcal: KcalStatus | null;
  /** 本次是否解锁了新的里程碑徽章 */
  newMilestone: boolean;
  /** 累计减重 kg */
  totalLoss: number;
}

/** 波动阈值：±0.1kg 以内视为持平 */
const FLAT = 0.1;

export function pickScenario(ctx: EncourageContext): Scenario {
  if (ctx.isFirst) return 'first';
  if (ctx.newMilestone) return 'milestone';
  if (ctx.streak === 30) return 'streak30';
  if (ctx.streak === 7) return 'streak7';
  if (ctx.streak === 3) return 'streak3';
  if (ctx.delta !== null && ctx.delta <= -FLAT) return 'down';
  if (ctx.delta !== null && ctx.delta >= FLAT) return 'up';
  if (ctx.kcal === 'ok') return 'kcalOk';
  if (ctx.kcal === 'over') return 'kcalOver';
  return 'flat';
}

/** 内置语料；{delta} {loss} {streak} 会被替换 */
export const CORPUS: Record<Scenario, string[]> = {
  first: [
    '第一次打卡完成！🎉 万事开头难，你已经迈出了最关键的一步。接下来每天花 10 秒记录，剩下的交给时间。',
    '欢迎开启轻盈之旅 🌱 今天的数字就是你的起点，不评判、只记录。我们一起慢慢变好。',
    '打卡成功！记录本身就是改变的开始。别给自己太大压力，今天能开始，已经很棒了 💪',
    '新的旅程从今天开始 ✨ 每一个坚持下来的人，都是从“第一天”走过来的。',
    '你好呀，未来更轻盈的自己！第一条记录已保存，明天同一时间再来见我哦 😊',
  ],
  milestone: [
    '解锁新里程碑！🏅 累计已减 {loss} kg，这是实打实的努力换来的，好好为自己骄傲一下！',
    '哇，又一个里程碑达成 🎉 {loss} kg 的变化，身体一定已经感受到了轻松。',
    '里程碑 get！你用行动证明了自己可以。累计 {loss} kg，继续向下一个目标出发 🚀',
    '值得庆祝的一天 🥳 已经减掉 {loss} kg，这份坚持比任何数字都珍贵。',
    '新徽章到手！累计减重 {loss} kg，每一克都是你认真生活的证明 ✨',
  ],
  streak30: [
    '连续打卡 30 天！💎 一个月的坚持，已经不是意志力，而是习惯了。你太厉害了！',
    '整整 30 天不间断 🎊 很多人做不到的事，你做到了。',
    '30 天连续记录达成！习惯的力量正在你身上显现，继续保持这份节奏 💪',
    '一个月了！🔥 回头看看第一天的自己，会感谢现在这么坚持的你。',
    '30 天打卡成就解锁 🏆 稳定比速度更重要，你正走在最正确的路上。',
  ],
  streak7: [
    '连续打卡 7 天！🔥 一整周的坚持，习惯的种子已经发芽了。',
    '一周不间断 🎉 你比自己想象的更有毅力，下一个目标：30 天！',
    '7 天连续记录达成 ✨ 每天的小坚持，正在汇成大改变。',
    '坚持一周啦！给自己一个大大的赞 👍 节奏找到了，就继续这样走下去。',
    '第 7 天打卡成功 🌟 一周前的你如果知道现在这么坚持，一定会很开心。',
  ],
  streak3: [
    '连续 3 天打卡 🔥 最难熬的开头已经过去了，节奏正在形成！',
    '第 3 天！小火苗点燃了 🔥 再坚持几天，你会发现记录变成了自然的事。',
    '已经连续 3 天了，真棒 👏 稳稳地，一天一天来。',
    '三连打卡达成 ✨ 坚持的感觉是不是还不错？',
    '连续 3 天，状态在线 💪 保持住，一周成就就在前方。',
  ],
  down: [
    '比上次轻了 {delta} kg 📉 努力被看见了！今天也要好好吃饭、好好睡觉。',
    '体重下降 {delta} kg，太棒了 🎉 这是你认真对待每一餐的回报。',
    '又轻了 {delta} kg ✨ 身体在回应你的善待，继续保持这个节奏。',
    '数字往下走了 {delta} kg 🌱 不用急，稳稳地减才最健康。',
    '-{delta} kg！为你开心 😊 别忘了多喝水，奖励自己一次早睡吧。',
  ],
  up: [
    '今天比上次重了 {delta} kg，别担心 🤗 水分、盐分、睡眠、生理期都会让体重短期波动，看 7 日均线趋势才更准。',
    '小小的上升 {delta} kg 很正常，可能只是昨晚吃得咸或喝水多了 💧 你依然在正确的路上。',
    '体重有 {delta} kg 的波动，这不代表失败 ❤️ 减重从来不是直线，坚持记录才是关键。',
    '涨了 {delta} kg？深呼吸～身体每天会有 0.5–1kg 的自然起伏，明天继续按计划吃就好 🌈',
    '数字暂时调皮了一下（+{delta} kg），但你坚持打卡这件事本身就很了不起 💪 趋势比单日更重要。',
  ],
  kcalOk: [
    '体重平稳，热量也控制得很好 👍 平台期是身体在调整，坚持就会迎来下一次下降。',
    '今天热量达标 ✅ 好的饮食习惯正在一点点积累，变化会在不经意间到来。',
    '吃得刚刚好，给自控力点个赞 🌟 体重持平也没关系，身体在悄悄变好。',
    '热量达标的一天 🥗 稳住节奏，结果自然会来。',
    '今天的饮食很棒 ✨ 体重稳定也是一种进步，说明你在维持健康的平衡。',
  ],
  kcalOver: [
    '今天吃得稍微多了点也没关系 🤗 一天不会决定结果，明天回到计划就好。',
    '热量超了一点？偶尔放松是正常的 ❤️ 重要的是你依然在记录、依然在坚持。',
    '今天是“放松日”～别有负罪感 😊 明天多走几步、按菜单吃，就能拉回来。',
    '超标一天不要紧 🌈 减重是长跑，享受生活也是坚持下去的一部分。',
    '诚实记录本身就很棒 👏 明天早餐吃好一点，重新出发！',
  ],
  flat: [
    '体重稳稳的 ⚖️ 持平也是一种胜利，说明你没有反弹，继续保持！',
    '今天打卡完成 ✅ 数字暂时没变，但身体内部的改变一直在发生。',
    '平稳的一天 🌿 减重有快有慢，坚持记录的你已经赢过了大多数人。',
    '体重持平，心态也要稳稳的 😊 明天继续按计划吃就好。',
    '又是坚持的一天 💪 累计已减 {loss} kg，每一天都算数。',
  ],
};

import type { Lang } from '../i18n/types';

export const CORPUS_EN: Record<Scenario, string[]> = {
  first: [
    'Welcome on board! The first step is the most important one 🌱 Let’s take it day by day!',
    'First check-in logged! Consistency starts right here ✨ You’ve got this!',
  ],
  milestone: [
    'New milestone unlocked! 🏆 All your dedication is showing in the results!',
    'Congratulations on this achievement! 🌟 Celebrate your hard work today.',
  ],
  streak30: [
    '30-day streak achieved! 💎 Consistency is now your second nature. Outstanding!',
  ],
  streak7: [
    '7 days straight! 🔥 Your healthy routine is firmly in place. Keep the fire going!',
  ],
  streak3: [
    '3 days in a row! 🌿 Great beginning, keep the steady momentum.',
  ],
  down: [
    'Down {delta} kg compared to last time! 📉 Your efforts are truly paying off.',
    'Lighter by {delta} kg today! Total loss stands at {loss} kg 💪 Fantastic progress!',
  ],
  up: [
    'Weight went up by {delta} kg? Completely normal 🤗 Water retention and digestion fluctuate daily.',
    'Small weight fluctuation ❤️ Don’t let the scale discourage you. Stick to the plan and trust the trend.',
  ],
  kcalOk: [
    'Diet was right on target today! 🥗 Eating well is the foundation of sustainable health.',
  ],
  kcalOver: [
    'Ate a little extra today? No guilt! 😊 One meal never breaks your journey. Onward tomorrow!',
    'Ate over target? It happens to everyone ❤️ What matters is you kept logging honestly.',
  ],
  flat: [
    'Weight held steady ⚖️ Plateau or plateau-free, consistency without rebound is a victory.',
    'Another solid day logged 💪 Total weight lost: {loss} kg. Every single day counts!',
  ],
};

function fill(tpl: string, ctx: EncourageContext): string {
  const delta = ctx.delta === null ? '0' : Math.abs(ctx.delta).toFixed(1);
  return tpl
    .replace(/\{delta\}/g, delta)
    .replace(/\{loss\}/g, Math.max(0, ctx.totalLoss).toFixed(1))
    .replace(/\{streak\}/g, String(ctx.streak));
}

/** 离线兜底鼓励语 */
export function offlineEncouragement(ctx: EncourageContext, rand: () => number = Math.random, lang: Lang = 'zh'): string {
  const dict = lang === 'en' ? CORPUS_EN : CORPUS;
  const list = dict[pickScenario(ctx)] || CORPUS[pickScenario(ctx)];
  const tpl = list[Math.floor(rand() * list.length) % list.length];
  return fill(tpl, ctx);
}
