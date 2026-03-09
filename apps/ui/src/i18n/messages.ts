import type { Locale } from './config';
import { loadLocalMessages } from './local';
import { loadRemoteMessages } from './remote';

export async function loadMessages(locale: Locale) {
  const remote = await loadRemoteMessages(locale);
  if (remote) return remote;

  const local = await loadLocalMessages(locale);
  if (local) return local;

  throw new Error(
    `Translations not available for locale "${locale}". ` +
      'Provide local message files or configure Tolgee (TOLGEE_API_URL, TOLGEE_PROJECT_ID, TOLGEE_API_KEY).',
  );
}
