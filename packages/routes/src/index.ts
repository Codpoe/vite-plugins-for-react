import path from 'upath';
import {
  Plugin,
  transformWithEsbuild,
  ResolvedConfig as ResolvedViteConfig,
} from 'vite';
import { resolveConfig } from './config';
import { RESOLVED_ROUTES_MODULE_ID, ROUTES_MODULE_ID } from './constants';
import { PagesService } from './PagesService';
import { ResolvedConfig, UserConfig } from './types';
import { normalizeRoutePath, toArray } from './utils';

export * from './types';

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
                // will have the same chunk name: "index", ant it's a little confusing.
                //
                // To avoid duplicate chunk names, we should custom the names here.
                // eg: src/pages/a/b/index.js -> page~a~b
                //     src/pages/c/index.js   -> page~c
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
    async load(id) {
      if (id.startsWith(RESOLVED_ROUTES_MODULE_ID)) {
        const query = new URLSearchParams(id.split('?')[1]);
        const basePath = normalizeRoutePath(query.get('basePath') || '/');

        const code = await pagesService.generateRoutesCode(basePath);

        return transformWithEsbuild(code, RESOLVED_ROUTES_MODULE_ID, {
          loader: 'jsx',
        });
      }
    },
    // expose pages
    getPages() {
      return pagesService.getPages();
    },
  } as Plugin;
}

export default conventionalRoutes;
