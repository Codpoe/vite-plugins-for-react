import { BuildOptions, ResolvedConfig, Plugin } from 'vite';
import path from 'upath';
import fs from 'fs-extra';
import fg from 'fast-glob';
import mm from 'micromatch';
import { Entry, UserConfig } from './types';
import { normalizeRoutePath, toArray } from './utils';
import { DEFAULT_ENTRY_MODULE_ID, DEFAULT_HTML_PATH } from './constants';
import { spaFallbackMiddleware, transformHtml } from './html';

export * from './types';

function resolveEntries(
  root: string,
  src: string,
  pattern: string | string[],
  basePath: string
): Entry[] {
  const nodeModulesDir = path.resolve(root, 'node_modules');
  const outputDir = path.resolve(nodeModulesDir, '.conventional-entries');

  if (!fs.existsSync(nodeModulesDir)) {
    throw new Error('node_modules directory is not found');
  }

  fs.ensureDirSync(outputDir);
  fs.emptyDirSync(outputDir);

  return fg
    .sync(pattern, { cwd: src, absolute: true })
    .sort((a, b) => b.length - a.length)
    .map<Entry>(entryPath => {
      const routePath = normalizeRoutePath(
        basePath + '/' + path.relative(src, path.dirname(entryPath))
      );
      const serverPath = normalizeRoutePath(path.relative(root, entryPath));
      // will create symlink for html path later
      const htmlPath = path.resolve(
        outputDir,
        `${routePath.replace(basePath, '').replace(/^\//, '') || 'index'}.html`
      );

      return {
        entryPath,
        routePath,
        serverPath,
        htmlPath,
      };
    });
}

function resolveInput(
  root: string,
  entries: Entry[]
): NonNullable<BuildOptions['rollupOptions']>['input'] {
  const nodeModulesDir = path.resolve(root, 'node_modules');
  const outputDir = path.resolve(nodeModulesDir, '.conventional-entries');

  fs.ensureDirSync(outputDir);
  fs.emptyDirSync(outputDir);

  /**
   * SPA:
   * {
   *   'entry~main': 'node_modules/.conventional-entries/index.html',
   * }
   *
   * MPA:
   * {
   *   'entry~a': 'node_modules/.conventional-entries/a.html',
   *   'entry~b~c': 'node_modules/.conventional-entries/b/c.html'
   * }
   */
  const input = entries.reduce<Record<string, string>>((res, entry) => {
    ensureLinkHtmlPath(root, entry);

    const inputKey =
      'entry~' +
      (entry.routePath.replace(/^\//, '').replace('/', '~') || 'main');

    res[inputKey] = entry.htmlPath;
    return res;
  }, {});

  return input;
}

function ensureLinkHtmlPath(root: string, entry: Entry) {
  const rootHtmlPath = path.resolve(root, 'index.html');
  const entryHtmlPath = path.resolve(
    path.dirname(entry.entryPath),
    'index.html'
  );

  for (const htmlPath of [entryHtmlPath, rootHtmlPath, DEFAULT_HTML_PATH]) {
    if (fs.existsSync(htmlPath)) {
      fs.ensureLinkSync(htmlPath, entry.htmlPath);
      return;
    }
  }
}

export function conventionalEntries(userConfig: UserConfig = {}): Plugin[] {
  const { pattern = '**/main.{js,jsx,ts,tsx}', basePath = '/' } = userConfig;

  let viteConfig: ResolvedConfig;
  let src: string;
  let entries: Entry[];

  return [
    {
      name: 'vite-plugin-conventional-entries',
      enforce: 'pre',
      config(viteUserConfig) {
        const root = path.normalize(
          viteUserConfig.root
            ? path.resolve(viteUserConfig.root)
            : process.cwd()
        );

        src = path.resolve(root, userConfig?.src || 'src');
        entries = resolveEntries(root, src, pattern, basePath);

        const srcFromRoot = path.relative(root, src);

        return {
          // Since html may dynamically append the page entry after starting the server,
          // we cannot rely on vite's default optimization strategy.
          // We need to manually write the entries here,
          // so that vite can perform dependency crawling and optimization
          optimizeDeps: {
            entries: toArray(pattern).map(p => `${srcFromRoot}/${p}`),
            include: ['react', 'react-dom/client'],
          },
          build: {
            rollupOptions: {
              input: resolveInput(root, entries),
            },
          },
        };
      },
      configResolved(config) {
        viteConfig = config;
      },
      configureServer(server) {
        function listener(filePath: string) {
          if (!mm.isMatch(filePath, pattern, { cwd: src })) {
            return;
          }

          const isInEntries = entries.some(
            entry => entry.entryPath === filePath
          );
          // file is deleted but in current entries, restart server to resolve entries again
          if (!fs.existsSync(filePath)) {
            if (isInEntries) {
              server.restart();
            }
            return;
          }

          // file exists but not in current entries, restart server to resolve entries again
          if (!isInEntries) {
            server.restart();
          }
        }

        server.watcher
          .on('add', listener)
          .on('change', listener)
          .on('unlink', listener);

        server.middlewares.use(
          spaFallbackMiddleware(viteConfig.root, viteConfig.base, entries)
        );

        // return () => {
        //   server.middlewares.use(htmlMiddleware(server));
        // };
      },
      transformIndexHtml: {
        enforce: 'pre',
        transform(html, ctx) {
          const entry = entries.find(entry => ctx.filename === entry.htmlPath);

          if (entry) {
            return transformHtml(html, entry);
          }
        },
      },
      resolveId(source) {
        if (source.startsWith(DEFAULT_ENTRY_MODULE_ID)) {
          return source;
        }
      },
      async load(id) {
        if (id.startsWith(DEFAULT_ENTRY_MODULE_ID)) {
          const query = new URLSearchParams(id.split('?')[1]);
          const routePath = normalizeRoutePath(query.get('routePath') || '/');
          const entry = entries.find(entry => entry.routePath === routePath);

          if (!entry) {
            return;
          }

          const code = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${entry.serverPath}';

const rootEl = document.getElementById('root');

if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<App />);
} else if (process.env.NODE_ENV === 'development') {
  console.error('[conventional-entries] Cannot find element whose id is "root"');
}
`;
          return code;
        }
      },
      // expose entries
      getEntries() {
        return entries;
      },
    } as Plugin,
    // vite will emit html with fileName which is relative(root, id),
    // for example: 'dist/node_modules/.conventional-entries/index.html'.
    // In order to have a clearer directory structure, we should rewrite html fileName here.
    // see also: https://github.com/vitejs/vite/blob/1878f465d26d1c61a29ede72882d54d7e95c1042/packages/vite/src/node/plugins/html.ts#L672
    {
      name: 'vite-plugin-conventional-entries:transform-html-path',
      enforce: 'post',
      generateBundle(_options, bundle) {
        Object.values(bundle).forEach(chunkOrAsset => {
          if (
            chunkOrAsset.type === 'asset' &&
            chunkOrAsset.fileName.endsWith('.html')
          ) {
            chunkOrAsset.fileName = chunkOrAsset.fileName.replace(
              'node_modules/.conventional-entries/',
              ''
            );
          }
        });
      },
    },
  ];
}

export default conventionalEntries;
