import { useRef } from 'react';
import dayjs from 'dayjs';
import { useStore } from '../../store/useStore';
import { toast } from '../../store/toast';
import { validateImport, type ExportData } from '../../store/dataio';
import { confirmDialog } from '../Modal';

export default function DataManage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importData = useStore((s) => s.importData);
  const clearAll = useStore((s) => s.clearAll);
  const count = useStore((s) => s.records.length);

  const doExport = () => {
    const s = useStore.getState();
    const { apiKey: _omit, ...safeSettings } = s.settings;
    void _omit;
    const data: ExportData = {
      app: 'looseweight',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      records: s.records,
      plan: s.plan,
      seenBadges: s.seenBadges,
      planMemory: s.planMemory,
      planChat: s.planChat,
      settings: safeSettings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `looseweight-backup-${dayjs().format('YYYYMMDD-HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出备份文件', 'success');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let data: ExportData;
    try {
      data = validateImport(JSON.parse(await file.text()));
    } catch (err) {
      toast(`导入失败：${err instanceof Error ? err.message : '文件不是合法的 JSON'}`, 'error');
      return;
    }
    const ok = await confirmDialog({
      title: '覆盖当前数据？',
      message: `备份包含 ${data.records.length} 条打卡记录${data.plan ? '和一份饮食计划' : ''}。\n导入后将覆盖本机现有数据（API Key 保留）。`,
      okText: '确认导入',
      danger: true,
    });
    if (!ok) return;
    importData(data);
    toast('导入成功', 'success');
  };

  const doClear = async () => {
    const ok1 = await confirmDialog({
      title: '清空所有数据？',
      message: `将删除档案、${count} 条打卡记录、饮食计划和 AI 配置。此操作无法撤销，建议先导出备份。`,
      okText: '我确定要清空',
      danger: true,
    });
    if (!ok1) return;
    const ok2 = await confirmDialog({ title: '最后确认', message: '真的要清空吗？', okText: '清空', danger: true });
    if (!ok2) return;
    clearAll();
    toast('已清空所有数据');
  };

  return (
    <div className="row wrap">
      <button id="data-export" className="btn" onClick={doExport}>
        📤 导出 JSON
      </button>
      <button id="data-import" className="btn" onClick={() => fileRef.current?.click()}>
        📥 导入 JSON
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      <button id="data-clear" className="btn btn-danger" onClick={doClear} style={{ marginLeft: 'auto' }}>
        🗑️ 清空所有数据
      </button>
    </div>
  );
}
