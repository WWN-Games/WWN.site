import { en } from "./en";
import { ru } from "./ru";

export type Lang = "ru" | "en";
export type DictKey = keyof typeof ru;
export const dicts = { ru, en } as const satisfies Record<Lang, Record<DictKey, string>>;

/** Подстановка {var}-плейсхолдеров: неизвестные имена остаются как есть. */
function substitute(value: string, vars: Record<string, string | number>): string {
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

/** Подстановка {var}-плейсхолдеров. */
export function t(lang: Lang, key: DictKey, vars?: Record<string, string | number>): string {
  const value = dicts[lang][key];
  return vars ? substitute(value, vars) : value;
}

/** Выбор формы по Intl.PluralRules; forms.other обязателен. */
export function plural(
  lang: Lang,
  n: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
  vars?: Record<string, string | number>,
): string {
  const category = new Intl.PluralRules(lang).select(n);
  const form = forms[category] ?? forms.other;
  return substitute(form, { n, ...vars });
}
