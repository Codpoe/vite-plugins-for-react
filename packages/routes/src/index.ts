import path from 'upath';
import { Plugin, transformWithEsbuild } from 'vite';
import { resolveConfig } from './config';
import { RESOLVED_ROUTES_MODULE_ID, ROUTES_MODULE_ID } from './constants';
import { PagesService } from './PagesService';
import { ResolvedConfig, UserConfig } from './types';
import { normalizeRoutePath } from './utils';

export function conventionalRoutes(userConfig?: UserConfig): Plugin {
  let config: ResolvedConfig;
  let pagesService: PagesService;

  return {
    name: 'vite-plugin-conventional-routes',
    async configResolved(viteConfig) {
      config = await resolveConfig(path.normalize(viteConfig.root), userConfig);
      pagesService = new PagesService(config);
      pagesService.start();
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
  };
}

export default conventionalRoutes;
