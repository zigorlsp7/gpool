export type Messages = Record<string, string>;
export type TranslationParams = Record<string, string | number>;

export function createTranslator(messages: Messages) {
  return (key: string, params?: TranslationParams) => {
    const template = messages[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, token) => {
      if (params[token] === undefined || params[token] === null) return match;
      return String(params[token]);
    });
  };
}
