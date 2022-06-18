import path from 'upath';
import {
  Plugin,
  transformWithEsbuild,
  ResolvedConfig as ResolvedViteConfig,
} from 'vite';
import { resolveConfig, resolvePagesConfig } from './config';
import { RESOLVED_ROUTES_MODULE_ID, ROUTES_MODULE_ID } from './constants';
import { PagesService } from './PagesService';
import { Page, ResolvedConfig, UserConfig } from './types';
import { normalizeRoutePath, toArray } from './utils';

export * from './types';

export { resolvePagesConfig, RESOLVED_ROUTES_MODULE_ID };

declare module 'vite' {
  export interface Plugin {
    api?: {
      /**
       * expose pages
       */
      getPages?: () => Page[];
    };
  }
}

export function conventionalRoutes(userConfig?: UserConfig): Plugin {
  let viteConfig: ResolvedViteConfig;
  let config: ResolvedConfig;
  let pagesService: PagesService;

  return {
    name: 'vite-plugin-conventional-routes',
    async config(viteUserConfig) {
      const root = path.normalize(
        viteUserConfig.root ? path.resolve(viteUserConfig.root) : process.cwd()
      );

      config = await resolveConfig(path.normalize(root), userConfig);
      pagesService = new PagesService(config);
      pagesService.start();

      const optimizeEntries = config.pages.config.flatMap(
        ({ dir, pattern, ignore }) => {
          const dirFromRoot = path.relative(root, dir);
          const positive = toArray(pattern).map(p => `${dirFromRoot}/${p}`);
          // vite's optimizeDeps.entries do not provide ignore configuration,
          // so we manually convert ignore to negative patterns
          const negative = toArray(ignore).map(p => `!${dirFromRoot}/${p}`);

          return positive.concat(negative);
        }
      );

      return {
        optimizeDeps: {
          entries: optimizeEntries,
        },
        build: {
          rollupOptions: {
            output: {
              chunkFileNames(chunkInfo) {
                const assetsDir = viteConfig.build.assetsDir;

                // By default, "src/pages/a/b/index.js" and "src/pages/c/index.js"
                // will have the same chunk name: "index", and it's a little confusing.
                //
                // To avoid duplicate chunk names, we should custom the names here.
                // eg: src/pages/a/b/index.js -> page~a~b
                //     src/pages/c/index.js   -> page~c
                //     src/pages/d/[id].js    -> page~d~{id}
                //     src/pages/e/[...all].js    -> page~e~{all}
                if (chunkInfo.isDynamicEntry && chunkInfo.facadeModuleId) {
                  const pageConfigItem = pagesService.checkPageFile(
                    chunkInfo.facadeModuleId
                  );

                  if (pageConfigItem) {
                    const withBase = path.join(
                      pageConfigItem.basePath,
                      path.relative(
                        pageConfigItem.dir,
                        chunkInfo.facadeModuleId
                      )
                    );

                    const name = path
                      .trimExt(withBase)
                      .replace(/^(.+)\/(index|README)/, '$1') // remove trailing /index or /README
                      .replace(/\[(?:\.{3})?(.*?)\]/g, '{$1}') // transform [id] or [...id] to {id}
                      .split('/')
                      .filter(Boolean) // remove leading slash
                      .join('~'); // a/b/c -> a~b~c

                    return path.join(assetsDir, `page~${name}.[hash].js`);
                  }
                }

                return path.join(assetsDir, '[name].[hash].js');
              },
            },
          },
        },
      };
    },
    async configResolved(resolvedViteConfig) {
      viteConfig = resolvedViteConfig;
    },
    configureServer(server) {
      pagesService.setupServer(server);
    },
    closeBundle() {
      pagesService.close();
    },
    resolveId(source) {
      // virtual:conventional-routes/a -> \0virtual:conventional-routes/a
      if (source.startsWith(ROUTES_MODULE_ID)) {
        const basePath = normalizeRoutePath(
          source.replace(ROUTES_MODULE_ID, '')
        );
        return `${RESOLVED_ROUTES_MODULE_ID}?basePath=${basePath}`;
      }
    },
    async load(id, opts) {
      if (id.startsWith(RESOLVED_ROUTES_MODULE_ID)) {
        const query = new URLSearchParams(id.split('?')[1]);
        const basePath = normalizeRoutePath(query.get('basePath') || '/');

        const code = await pagesService.generateRoutesCode(
          basePath,
          viteConfig,
          opts?.ssr
        );

        return transformWithEsbuild(code, RESOLVED_ROUTES_MODULE_ID, {
          loader: 'jsx',
        });
      }
    },
    transform(code, id) {
      // export meta will affect @vitejs/plugin-react's judgment of react refresh boundary,
      // so we need to handle hmr for meta export.
      // https://github.com/vitejs/vite/blob/9baa70b788ec0b0fc419db30d627567242c6af7d/packages/plugin-react/src/fast-refresh.ts#L87
      if (
        pagesService.checkPageFile(id) &&
        code.includes('export const meta =') &&
        !code.includes('import.meta.hot.accept()')
      ) {
        return `${code}
          if (import.meta.hot) {
            // cache meta
            import.meta.hot.data.meta = import.meta.hot.data.meta || meta;

            import.meta.hot.accept(newModule => {
              // if the meta has changed, invalidate the module
              if (JSON.stringify(newModule.meta) !== JSON.stringify(import.meta.hot.data.meta)) {
                import.meta.hot.invalidate();
              }
            })
          }
        `;
      }
    },
    api: {
      getPages() {
        return pagesService.getPages();
      },
    },
  };
}

export default conventionalRoutes;
