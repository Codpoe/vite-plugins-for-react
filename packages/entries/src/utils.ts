import path from 'upath';

export function normalizeRoutePath(routePath: string) {
  return path.normalize('/' + routePath.replace(/\/+$/, ''));
}

/**
 * Flatten path.
 * @example /a/b/c -> a~b~c
 */
export function flattenPath(p: string): string {
  return p.replace(/^\//, '').replace(/\//g, '~');
}

export function cleanUrl(url: string): string {
  return url.replace(/#.*$/s, '').replace(/\?.*$/s, '');
}

export function toArray<T>(data: T | T[] | undefined): T[] {
  if (typeof data === 'undefined') {
    return [];
  }
  return Array.isArray(data) ? data : [data];
}
