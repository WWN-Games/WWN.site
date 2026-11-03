import { formatTemplate } from "../lib/utils";
import { en } from "./en";
import { ru } from "./ru";

export type Lang = "ru" | "en";
export type DictKey = keyof typeof ru;
const dicts = { ru, en } as const satisfies Record<Lang, Record<DictKey, string>>;

const substitute = formatTemplate;
const pluralRules = new Map<Lang, Intl.PluralRules>();

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
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  const category = rules.select(n);
  const form = forms[category] ?? forms.other;
  return substitute(form, { n, ...vars });
}
