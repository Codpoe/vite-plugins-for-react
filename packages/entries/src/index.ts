import { BuildOptions, ResolvedConfig, PluginOption } from 'vite';
import path from 'upath';
import fs from 'fs-extra';
import fg from 'fast-glob';
import mm from 'micromatch';
import { Entry, UserConfig } from './types';
import { normalizeRoutePath } from './utils';
import { DEFAULT_HTML_PATH, MIDDLE_ENTRY_MODULE_ID } from './constants';
import { spaFallbackMiddleware, transformHtml } from './html';

function resolveEntries(
  root: string,
  src: string,
  pattern: string | string[]
): Entry[] {
  const nodeModulesDir = path.resolve(root, 'node_modules');
  const outputDir = path.resolve(nodeModulesDir, '.conventional-entries');

  if (!fs.existsSync(path.resolve(root, 'node_modules'))) {
    throw new Error('node_modules directory is not found');
  }

  fs.ensureDirSync(outputDir);
  fs.emptyDirSync(outputDir);

  return fg
    .sync(pattern, { cwd: src, absolute: true })
    .sort((a, b) => b.length - a.length)
    .map<Entry>(entryPath => {
      const routePath = normalizeRoutePath(
        path.relative(src, path.dirname(entryPath))
      );
      const serverPath = normalizeRoutePath(path.relative(root, entryPath));
      // will create symlink for html path later
      const htmlPath = path.resolve(
        outputDir,
        // flat route path, eg. /a/b/c -> a~b~c.html
        `${routePath.replace(/^\//, '').replace('/', '~') || 'index'}.html`
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

  return entries.reduce<Record<string, string>>((res, entry) => {
    const key = path.basename(entry.htmlPath, path.extname(entry.htmlPath));

    ensureLinkHtmlPath(root, entry);
    res[key] = entry.htmlPath;

    return res;
  }, {});
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

export function conventionalEntries(userConfig: UserConfig = {}): PluginOption {
  const { pattern = '**/main.{js,jsx,ts,tsx}' } = userConfig;

  let viteConfig: ResolvedConfig;
  let src: string;
  let entries: Entry[];

  return [
    {
      name: 'vite-plugin-conventional-entries',
      enforce: 'pre',
      config(config) {
        const root = config.root || process.cwd();

        src = path.resolve(root, userConfig?.src || 'src');
        entries = resolveEntries(root, src, pattern);

        const input = resolveInput(root, entries);

        return {
          build: {
            rollupOptions: {
              input,
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

        server.middlewares.use(spaFallbackMiddleware(viteConfig.root, entries));

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
        if (source.startsWith(MIDDLE_ENTRY_MODULE_ID)) {
          return source;
        }
      },
      async load(id) {
        if (id.startsWith(MIDDLE_ENTRY_MODULE_ID)) {
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
    },
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
              'html/'
            );
          }
        });
      },
    },
  ];
}

export default conventionalEntries;