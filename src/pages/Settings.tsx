import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { toast } from '../store/toast';
import { latestRecord } from '../domain/calc';
import { allBadges, unlockedBadges } from '../domain/badges';
import { todayStr } from '../services/encourage';
import ProfileForm from '../components/settings/ProfileForm';
import AiConfig from '../components/settings/AiConfig';
import DataManage from '../components/settings/DataManage';

export default function Settings() {
  const profile = useStore((s) => s.profile);
  const records = useStore((s) => s.records);
  const setProfile = useStore((s) => s.setProfile);
  const navigate = useNavigate();
  const onboarding = !profile;
  const latest = latestRecord(records);

  const unlocked = profile ? new Set(unlockedBadges(profile, records, todayStr()).map((b) => b.id)) : new Set<string>();

  return (
    <>
      {onboarding ? (
        <div className="onboard-banner fade-up">
          <h1 style={{ fontSize: 26 }}>👋 欢迎来到「轻盈」</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            先花 1 分钟填写个人档案，我会帮你算出每日热量目标，再由 AI 为你定制一周减脂菜单。
          </p>
        </div>
      ) : (
        <div className="page-head">
          <div>
            <h1>设置</h1>
            <p>个人档案、AI 配置与数据管理</p>
          </div>
        </div>
      )}

      <div className="stack">
        <section className="card">
          <div className="card-title">
            <h2>🧍 个人档案</h2>
            {onboarding && <span className="tag tag-ok">第 1 步</span>}
          </div>
          <ProfileForm
            key={profile ? 'edit' : 'new'}
            initial={profile}
            currentWeight={latest?.weightKg ?? null}
            saveLabel={onboarding ? '开始我的轻盈之旅 →' : '保存档案'}
            onSave={(p) => {
              setProfile(p);
              toast(onboarding ? '档案已创建，开始打卡吧！' : '档案已保存', 'success');
              if (onboarding) navigate('/');
            }}
          />
        </section>

        <section className="card" style={{ animationDelay: '80ms' }}>
          <div className="card-title">
            <h2>🤖 AI 配置</h2>
            <span className="card-sub">OpenAI 兼容接口，修改即自动保存</span>
          </div>
          <AiConfig />
        </section>

        {profile && (
          <section className="card" style={{ animationDelay: '140ms' }}>
            <div className="card-title">
              <h2>🏅 徽章墙</h2>
              <span className="card-sub">
                已解锁 {unlocked.size} / {allBadges().length}
              </span>
            </div>
            <div className="badge-wall">
              {allBadges().map((b) => (
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
            <h2>💾 数据管理</h2>
            <span className="card-sub">数据只保存在本机浏览器，换设备前请导出备份</span>
          </div>
          <DataManage />
        </section>
      </div>
    </>
  );
}
