export const DEFAULT_LOCALE = 'es';
export const SUPPORTED_LOCALES = ['es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LANGUAGE_COOKIE = 'gpool-language';
