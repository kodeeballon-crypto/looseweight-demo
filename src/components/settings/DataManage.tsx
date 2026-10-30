import { useRef } from 'react';
import dayjs from 'dayjs';
import { useStore } from '../../store/useStore';
import { toast } from '../../store/toast';
import { buildExport, validateImport, type ExportData } from '../../store/dataio';
import { confirmDialog } from '../Modal';
import { useT } from '../../i18n';

export default function DataManage() {
  const { t, lang } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const importData = useStore((s) => s.importData);
  const clearAll = useStore((s) => s.clearAll);
  const count = useStore((s) => s.records.length);

  const doExport = () => {
    const data = buildExport(useStore.getState());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `looseweight-backup-${dayjs().format('YYYYMMDD-HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(lang === 'en' ? 'Backup file exported' : '已导出备份文件', 'success');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let data: ExportData;
    try {
      data = validateImport(JSON.parse(await file.text()));
    } catch (err) {
      // JSON.parse 抛出的 SyntaxError 是浏览器英文原文，统一换成本地化提示
      const reason = err instanceof Error && !(err instanceof SyntaxError) ? err.message : t('importError.invalidJson');
      toast(lang === 'en' ? `Import failed: ${reason}` : `导入失败：${reason}`, 'error');
      return;
    }
    const ok = await confirmDialog({
      title: lang === 'en' ? 'Overwrite current data?' : '覆盖当前数据？',
      message: lang === 'en'
        ? `Backup contains ${data.records.length} check-in records${data.plan ? ' and a meal plan' : ''}.\nImporting will overwrite local data (API Key preserved).`
        : `备份包含 ${data.records.length} 条打卡记录${data.plan ? '和一份饮食计划' : ''}。\n导入后将覆盖本机现有数据（API Key 保留）。`,
      okText: lang === 'en' ? 'Confirm Import' : '确认导入',
      danger: true,
    });
    if (!ok) return;
    importData(data);
    toast(lang === 'en' ? 'Import successful' : '导入成功', 'success');
  };

  const doClear = async () => {
    const ok1 = await confirmDialog({
      title: lang === 'en' ? 'Clear all data?' : '清空所有数据？',
      message: lang === 'en'
        ? `This will delete your profile, ${count} check-in records, meal & workout plans, and AI configuration. This action cannot be undone. We recommend exporting a backup first.`
        : `将删除档案、${count} 条打卡记录、饮食与训练计划和 AI 配置。此操作无法撤销，建议先导出备份。`,
      okText: lang === 'en' ? 'Yes, clear all' : '我确定要清空',
      danger: true,
    });
    if (!ok1) return;
    const ok2 = await confirmDialog({
      title: lang === 'en' ? 'Final confirmation' : '最后确认',
      message: lang === 'en' ? 'Are you sure you want to clear all data?' : '真的要清空吗？',
      okText: lang === 'en' ? 'Clear Data' : '清空',
      danger: true,
    });
    if (!ok2) return;
    clearAll();
    toast(lang === 'en' ? 'All data cleared' : '已清空所有数据');
  };

  return (
    <div className="row wrap">
      <button id="data-export" className="btn" onClick={doExport}>
        📤 {lang === 'en' ? 'Export JSON' : '导出 JSON'}
      </button>
      <button id="data-import" className="btn" onClick={() => fileRef.current?.click()}>
        📥 {lang === 'en' ? 'Import JSON' : '导入 JSON'}
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      <button id="data-clear" className="btn btn-danger" onClick={doClear} style={{ marginLeft: 'auto' }}>
        🗑️ {lang === 'en' ? 'Clear All Data' : '清空所有数据'}
      </button>
    </div>
  );
}
