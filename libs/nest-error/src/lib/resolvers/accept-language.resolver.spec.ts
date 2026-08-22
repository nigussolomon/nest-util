import {
  parseAcceptLanguage,
  negotiateLanguage,
} from './accept-language.resolver';
import { LangResolverService } from '../services/lang-resolver.service';
import type { LocalizationOptions } from '../interfaces/localization-options.interface';

function makeResolver(opts: Partial<{
  defaultLang: string;
  supportedLangs: string[];
  allowHeaderOverride: boolean;
}>) {
  const options: LocalizationOptions = {
    messages: {},
    defaultLang: 'en',
    supportedLangs: ['en', 'am'],
    allowHeaderOverride: false,
    ...opts,
  };
  return new LangResolverService(options);
}

describe('parseAcceptLanguage', () => {
  it('parses simple tags', () => {
    expect(parseAcceptLanguage('en, am')).toEqual(['en', 'am']);
  });

  it('orders by q-value', () => {
    expect(parseAcceptLanguage('am;q=0.9, en;q=0.8, fr;q=1.0')).toEqual([
      'fr',
      'am',
      'en',
    ]);
  });

  it('strips region subtags', () => {
    expect(parseAcceptLanguage('en-US, am-ET')).toEqual(['en', 'am']);
  });

  it('returns [] for empty/undefined', () => {
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });
});

describe('negotiateLanguage', () => {
  it('returns the first supported match', () => {
    expect(negotiateLanguage(['fr', 'am'], ['en', 'am'])).toBe('am');
  });
  it('returns null when nothing matches', () => {
    expect(negotiateLanguage(['fr', 'de'], ['en', 'am'])).toBeNull();
  });
});

describe('LangResolverService', () => {
  it('uses Accept-Language negotiation clamped to supportedLangs', () => {
    const r = makeResolver({});
    const lang = r.resolve({
      headers: { 'accept-language': 'fr;q=0.9, am;q=0.8' },
    } as any);
    expect(lang).toBe('am');
  });

  it('falls back to defaultLang when nothing matches', () => {
    const r = makeResolver({});
    const lang = r.resolve({
      headers: { 'accept-language': 'fr;q=0.9, de;q=0.8' },
    } as any);
    expect(lang).toBe('en');
  });

  it('ignores x-lang override when disabled', () => {
    const r = makeResolver({ allowHeaderOverride: false });
    const lang = r.resolve({
      headers: { 'accept-language': 'en', 'x-lang': 'am' },
    } as any);
    expect(lang).toBe('en');
  });

  it('honors a valid x-lang override when enabled', () => {
    const r = makeResolver({ allowHeaderOverride: true });
    const lang = r.resolve({
      headers: { 'accept-language': 'en', 'x-lang': 'am' },
    } as any);
    expect(lang).toBe('am');
  });

  it('rejects an unsupported x-lang override', () => {
    const r = makeResolver({ allowHeaderOverride: true });
    const lang = r.resolve({
      headers: { 'accept-language': 'en', 'x-lang': 'zz' },
    } as any);
    expect(lang).toBe('en');
  });
});
