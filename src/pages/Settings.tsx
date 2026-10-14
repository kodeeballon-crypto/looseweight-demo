import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import { latestRecord } from '../domain/calc';
import { allBadges, unlockedBadges } from '../domain/badges';
import { todayStr } from '../services/encourage';
import ProfileForm from '../components/settings/ProfileForm';
import AiConfig from '../components/settings/AiConfig';
import DataManage from '../components/settings/DataManage';
import LangSwitch from '../components/LangSwitch';
import { useT } from '../i18n';

export default function Settings() {
  const profile = useStore((s) => s.profile);
  const records = useStore((s) => s.records);
  const setProfile = useStore((s) => s.setProfile);
  const navigate = useNavigate();
  const { lang } = useT();
  const onboarding = !profile;
  const latest = latestRecord(records);

  const unlocked = profile ? new Set(unlockedBadges(profile, records, todayStr(), lang).map((b) => b.id)) : new Set<string>();
  const badgesList = allBadges(lang);

  return (
    <>
      {onboarding ? (
        <div className="onboard-banner fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26 }}>{lang === 'en' ? '👋 Welcome to Lighten' : '👋 欢迎来到「轻盈」'}</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {lang === 'en'
                ? 'Spend 1 minute setting up your profile. We will calculate your daily calorie target, and AI will craft a personalized weekly meal plan.'
                : '先花 1 分钟填写个人档案，我会帮你算出每日热量目标，再由 AI 为你定制一周减脂菜单。'}
            </p>
          </div>
          <LangSwitch />
        </div>
      ) : (
        <div className="page-head">
          <div>
            <h1>{lang === 'en' ? 'Settings' : '设置'}</h1>
            <p>{lang === 'en' ? 'Profile, AI configuration, and data management' : '个人档案、AI 配置与数据管理'}</p>
          </div>
          <div className="row">
            <LangSwitch />
          </div>
        </div>
      )}

      <div className="stack">
        <section className="card">
          <div className="card-title">
            <h2>🧍 {lang === 'en' ? 'Profile' : '个人档案'}</h2>
            {onboarding && <span className="tag tag-ok">{lang === 'en' ? 'Step 1' : '第 1 步'}</span>}
          </div>
          <ProfileForm
            key={profile ? 'edit' : 'new'}
            initial={profile}
            currentWeight={latest?.weightKg ?? null}
            saveLabel={onboarding ? (lang === 'en' ? 'Start My Journey →' : '开始我的轻盈之旅 →') : (lang === 'en' ? 'Save Profile' : '保存档案')}
            onSave={(p) => {
              setProfile(p);
              toast(
                onboarding
                  ? (lang === 'en' ? 'Profile created! Time to check in.' : '档案已创建，开始打卡吧！')
                  : (lang === 'en' ? 'Profile saved' : '档案已保存'),
                'success'
              );
              if (onboarding) navigate('/');
            }}
          />
        </section>

        <section className="card" style={{ animationDelay: '80ms' }}>
          <div className="card-title">
            <h2>🤖 {lang === 'en' ? 'AI Configuration' : 'AI 配置'}</h2>
            <span className="card-sub">{lang === 'en' ? 'OpenAI-compatible API, auto-saved upon change' : 'OpenAI 兼容接口，修改即自动保存'}</span>
          </div>
          <AiConfig />
        </section>

        {profile && (
          <section className="card" style={{ animationDelay: '140ms' }}>
            <div className="card-title">
              <h2>🏅 {lang === 'en' ? 'Badge Wall' : '徽章墙'}</h2>
              <span className="card-sub">
                {lang === 'en' ? `Unlocked ${unlocked.size} / ${badgesList.length}` : `已解锁 ${unlocked.size} / ${badgesList.length}`}
              </span>
            </div>
            <div className="badge-wall">
              {badgesList.map((b) => (
                <div key={b.id} className={`badge-tile ${unlocked.has(b.id) ? '' : 'locked'}`} title={b.desc}>
                  <div className="e">{b.emoji}</div>
                  <div className="t">{b.title}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card" style={{ animationDelay: '200ms' }}>
          <div className="card-title">
            <h2>💾 {lang === 'en' ? 'Data Management' : '数据管理'}</h2>
            <span className="card-sub">{lang === 'en' ? 'Data is stored locally in your browser. Export a backup before switching devices.' : '数据只保存在本机浏览器，换设备前请导出备份'}</span>
          </div>
          <DataManage />
        </section>
      </div>
    </>
  );
}
