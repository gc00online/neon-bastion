// 한국어 / 영어. 기기 언어가 한국어면 한국어, 그 외에는 영어. 설정에서 바꿀 수 있다.
export type Lang = 'ko' | 'en';

const KEY = 'neon-bastion-lang';

function detect(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'ko' || v === 'en') return v;
  } catch { /* 무시 */ }
  return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const lang: Lang = detect();

export const L = (ko: string, en: string) => (lang === 'ko' ? ko : en);

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* 무시 */ }
  location.reload();
}
