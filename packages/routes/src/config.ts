import path from 'upath';
import fs from 'fs-extra';
import {
  ResolvedConfig,
  PagesConfig,
  UserConfig,
  PagesConfigWithType,
  UserPages,
  PagesConfigItem,
} from './types';
import { normalizeRoutePath, toArray } from './utils';
import { DEFAULT_IGNORE, PAGE_EXTS } from './constants';

function autoDetectPages(src: string, root: string): UserPages | undefined {
  src = path.resolve(root, src);

  const pagesDir = path.resolve(src, 'pages');

  if (fs.existsSync(pagesDir)) {
    return pagesDir;
  }

  const pages = fs
    .readdirSync(src)
    .map<PagesConfigItem | null>(fileName => {
      const entryDir = path.resolve(src, fileName);
      const pagesDir = path.resolve(entryDir, 'pages');

      if (fs.existsSync(pagesDir)) {
        return {
          basePath: normalizeRoutePath(fileName),
          dir: pagesDir,
        };
      }

      return null;
    })
    .filter((x): x is PagesConfigItem => Boolean(x));

  if (pages.length) {
    return pages;
  }

  return undefined;
}

/**
 * resolve pages config
 */
export function resolvePagesConfig(
  root: string,
  src: string | undefined,
  pages: UserPages | undefined,
  defaultIgnore: string | string[]
): PagesConfigWithType {
  let type: PagesConfigWithType['type'];

  // if pages is not defined, auto detect pages in src
  if (!pages && src) {
    type = 'auto';
    pages = autoDetectPages(src, root);
  } else {
    type = 'custom';
  }

  const pagesConfig: PagesConfig = toArray(pages).map(item => {
    if (typeof item === 'string') {
      item = {
        dir: item,
      };
    }

    const ignore = item.ignore || defaultIgnore;

    return {
      basePath: normalizeRoutePath(item.basePath || '/'),
      dir: path.resolve(root, item.dir),
      pattern: item.pattern || `**/*{${PAGE_EXTS.join(',')}}`,
      ignore: ['**/node_modules/**', '**/.git/**', ...toArray(ignore)],
    };
  });

  return {
    type,
    config: pagesConfig,
  };
}

export async function resolveConfig(
  root: string,
  userConfig: UserConfig = {}
): Promise<ResolvedConfig> {
  const {
    src = 'src',
    pages,
    ignore = DEFAULT_IGNORE,
    ...restConfig
  } = userConfig;

  const resolvedPages = resolvePagesConfig(root, src, pages, ignore);

  return {
    ...restConfig,
    root,
    src,
    pages: resolvedPages,
    ignore,
  };
}
