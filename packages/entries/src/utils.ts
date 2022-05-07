import path from 'upath';

export function normalizeRoutePath(routePath: string) {
  return path.normalize('/' + routePath.replace(/\/+$/, ''));
}

export function cleanUrl(url: string): string {
  return url.replace(/#.*$/s, '').replace(/\?.*$/s, '');
}
