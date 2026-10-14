import { useT } from '../i18n';

interface Props {
  className?: string;
  id?: string;
}

export default function LangSwitch({ className = '', id = 'lang-switch' }: Props) {
  const { lang, setLang } = useT();

  return (
    <div id={id} className={`lang-switch segmented ${className}`} role="group" aria-label="Language selection">
      <button
        type="button"
        className={lang === 'zh' ? 'on' : ''}
        onClick={() => setLang('zh')}
        aria-pressed={lang === 'zh'}
      >
        中
      </button>
      <button
        type="button"
        className={lang === 'en' ? 'on' : ''}
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  );
}
