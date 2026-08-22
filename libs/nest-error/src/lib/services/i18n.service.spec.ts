import { I18nService } from './i18n.service';
import type { LocalizationOptions } from '../interfaces/localization-options.interface';

function makeI18n(messages: Record<string, Record<string, string>>) {
  const options: LocalizationOptions = {
    messages,
    defaultLang: 'en',
    supportedLangs: ['en', 'am'],
  };
  return new I18nService(options);
}

describe('I18nService', () => {
  it('interpolates {placeholder} params', () => {
    const i18n = makeI18n({
      en: { GREET: 'Hello {name}' },
      am: { GREET: 'ሰላም {name}' },
    });
    expect(i18n.translate('GREET', { name: 'Abe' }, 'en')).toBe('Hello Abe');
    expect(i18n.translate('GREET', { name: 'Abe' }, 'am')).toBe('ሰላም Abe');
  });

  it('falls back to defaultLang when key missing in active language', () => {
    const i18n = makeI18n({ en: { ONLY_EN: 'English only' } });
    // 'am' inherits the english default
    expect(i18n.translate('ONLY_EN', {}, 'am')).toBe('English only');
    expect(i18n.hasKey('ONLY_EN', 'am')).toBe(true);
  });

  it('falls back to the code itself when key is unknown everywhere', () => {
    const i18n = makeI18n({});
    expect(i18n.translate('UNKNOWN_X', {}, 'fr')).toBe('UNKNOWN_X');
    expect(i18n.hasKey('UNKNOWN_X', 'fr')).toBe(false);
  });

  it('respects supportedLangs + defaultLang getters', () => {
    const i18n = makeI18n({ en: {}, am: {} });
    expect(i18n.getDefaultLang()).toBe('en');
    expect(i18n.getSupportedLangs().sort()).toEqual(['am', 'en']);
  });

  it('deep-merges user messages over library defaults', () => {
    const i18n = makeI18n({
      en: { CRUD_RESOURCE_NOT_FOUND: 'Overridden EN' },
    });
    expect(i18n.translate('CRUD_RESOURCE_NOT_FOUND', {}, 'en')).toBe(
      'Overridden EN'
    );
    // a default key that the user did not override still resolves
    expect(i18n.translate('INTERNAL_ERROR', {}, 'en')).toContain(
      'unexpected error'
    );
  });
});
