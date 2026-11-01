/**
 * Domain and executable-name normalisation. Pure functions shared by the
 * renderer (input validation) and the main process (hosts file generation).
 */

const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EXE_RE = /^[\w .()+-]{1,120}\.exe$/i;

export const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'vk.com',
  'reddit.com',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'netflix.com',
  'twitch.tv'
];

export const DEFAULT_BLOCKED_APPS = ['Discord.exe', 'Telegram.exe', 'steam.exe'];

/** Turns "https://www.YouTube.com/watch?v=1" into "youtube.com". Returns null if invalid. */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split(/[/?#]/)[0] ?? '';
  value = value.replace(/:\d+$/, '').replace(/\.$/, '');
  if (value.startsWith('www.')) value = value.slice(4);
  return DOMAIN_RE.test(value) ? value : null;
}

/** Host names written to the hosts file for one blocked domain. */
export function expandDomain(domain: string): string[] {
  return [domain, `www.${domain}`, `m.${domain}`];
}

/** Accepts "discord" or "Discord.exe"; returns "Discord.exe" or null. */
export function normalizeExeName(input: string): string | null {
  let value = input.trim().replace(/^.*[\\/]/, '');
  if (!value) return null;
  if (!/\.exe$/i.test(value)) value = `${value}.exe`;
  return EXE_RE.test(value) ? value : null;
}

export function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
