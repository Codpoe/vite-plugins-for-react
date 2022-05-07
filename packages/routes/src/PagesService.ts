import EventEmitter from 'events';
import path from 'upath';
import fs from 'fs-extra';
import fg from 'fast-glob';
import mm from 'micromatch';
import { ModuleNode, ViteDevServer } from 'vite';
import {
  extractDocBlock,
  extractFrontMatter,
  hasDefaultExport,
  normalizeRoutePath,
} from './utils';
import { Page, ResolvedConfig, Route } from './types';
import { PAGE_EXTS, RESOLVED_ROUTES_MODULE_ID } from './constants';

/**
 * - parse doc block for normal page
 * - parse front matter for markdown page
 */
export function resolvePageMeta(
  filePath: string,
  fileContent?: string
): Record<string, any> {
  fileContent ??= fs.readFileSync(filePath, 'utf-8');

  // parse doc block for js / ts
  if (/\.(js|ts)x?$/.test(filePath)) {
    return extractDocBlock(fileContent);
  }

  // parse front matter for markdown
  if (/\.mdx?$/.test(filePath)) {
    return extractFrontMatter(fileContent);
  }

  return {};
}

function resolveRoutePath(basePath: string, relFilePath: string) {
  let routePath = path
    .trimExt(normalizeRoutePath(relFilePath)) // remove ext
    .replace(/^(\/index){2}$/, '') // remove '/index/index'
    .replace(/\/index$/, '') // remove '/index'
    .replace(/\/README$/i, '') // remove '/README'
    .replace(/\/_layout$/, '') // remove '/_layout'
    .replace(/\/404$/, '/*') // transform '/404' to '/*' so this route acts like a catch-all for URLs that we don't have explicit routes for
    .replace(/\/\[(.*?)\]/g, '/:$1'); // transform 'user/[id]' to 'user/:id'

  routePath = normalizeRoutePath(path.join(basePath, routePath));

  return routePath;
}

function isLayoutFile(filePath: string) {
  return path.basename(filePath, path.extname(filePath)) === '_layout';
}

function is404File(filePath: string) {
  return path.basename(filePath, path.extname(filePath)) === '404';
}

export class PagesService extends EventEmitter {
  private _startPromise: Promise<any> | null = null;
  private _server: ViteDevServer | null = null;
  private _pages: Page[] = [];

  constructor(private config: ResolvedConfig) {
    super();
  }

  async start() {
    if (this._startPromise) {
      return;
    }

    return (this._startPromise = Promise.all(
      this.config.pages.config.map(
        async ({ basePath, dir, pattern, ignore }) => {
          pattern = [
            '**/_layout.{js,jsx,ts,tsx,md,mdx}',
            ...(Array.isArray(pattern) ? pattern : [pattern]),
          ];
          ignore = Array.isArray(ignore) ? ignore : [ignore];

          const relFilePaths = fg.sync(pattern, { cwd: dir, ignore });

          await Promise.all(
            relFilePaths.map(relFilePath =>
              this.createPage(basePath, dir, relFilePath)
            )
          );
        }
      )
    ));
  }

  async setupServer(server: ViteDevServer) {
    if (this._server === server) {
      return;
    }

    this._server = server;

    server.watcher
      .on('add', async filePath => {
        const pagesConfigItem = this.checkPageFile(filePath, true);
        // if match current pages config, create page directly
        if (pagesConfigItem) {
          await this.createPage(
            pagesConfigItem.basePath,
            pagesConfigItem.dir,
            filePath
          );
          this.onPagesChanged();
          return;
        }

        // if not matched current pages config but it should to auto detected,
        // then restart server to resolve the new pages config
        if (this.shouldAutoDetect(filePath)) {
          server.restart();
          return;
        }
      })
      .on('unlink', filePath => {
        const pagesConfigItem = this.checkPageFile(filePath);

        if (pagesConfigItem) {
          this.removePage(path.resolve(this.config.root, filePath));
          this.onPagesChanged();
        }
      })
      .on('change', async filePath => {
        const absFilePath = path.resolve(this.config.root, filePath);

        // if the file is already in pages, return directly
        if (this._pages.some(page => page.filePath === absFilePath)) {
          return;
        }

        const pagesConfigItem = this.checkPageFile(filePath, true);
        // if match current pages config, create page
        if (pagesConfigItem) {
          await this.createPage(
            pagesConfigItem.basePath,
            pagesConfigItem.dir,
            filePath
          );
          this.onPagesChanged();
        }
      });
  }

  close() {
    if (!this._startPromise) {
      throw new Error('PagesService is not started yet');
    }

    this._startPromise = null;
    this._server = null;
    this._pages = [];
  }

  /**
   * Check the file whether is a page
   */
  checkPageFile(filePath: string, checkFileContent = false) {
    filePath = path.resolve(this.config.root, filePath);

    const pagesConfigItem = this.config.pages.config.find(
      ({ dir, pattern, ignore }) =>
        mm.isMatch(filePath, pattern, { cwd: dir, ignore })
    );

    if (pagesConfigItem && checkFileContent) {
      if (!fs.existsSync(filePath)) {
        return undefined;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      if (hasDefaultExport(fileContent)) {
        return pagesConfigItem;
      }
    }

    return pagesConfigItem;
  }

  shouldAutoDetect(filePath: string) {
    filePath = path.resolve(this.config.root, filePath);

    return (
      this.config.pages.type === 'auto' &&
      mm.isMatch(filePath, `**/pages/*{${PAGE_EXTS.join(',')}}`, {
        cwd: this.config.src,
        ignore: this.config.ignore,
      })
    );
  }

  onPagesChanged() {
    if (!this._server) {
      return;
    }

    const mods = this._server.moduleGraph.getModulesByFile(
      RESOLVED_ROUTES_MODULE_ID
    );

    if (mods) {
      const seen = new Set<ModuleNode>();
      mods.forEach(mod => {
        this._server?.moduleGraph.invalidateModule(mod, seen);
      });
    }

    this._server.ws.send({
      type: 'full-reload',
    });
  }

  async createPage(basePath: string, dir: string, filePath: string) {
    const relFilePath = path.isAbsolute(filePath)
      ? path.relative(dir, filePath)
      : path.normalize(filePath);
    const absFilePath = path.resolve(dir, filePath);
    const routePath = resolveRoutePath(basePath, relFilePath);
    const meta = resolvePageMeta(absFilePath);

    let page: Page = {
      basePath,
      routePath,
      filePath: absFilePath,
      meta,
      isLayout: isLayoutFile(relFilePath),
      is404: is404File(relFilePath),
    };

    // run hook: onCreatePage
    page = (await this.config.onCreatePage?.(page)) || page;

    this._pages.push(page);
    return page;
  }

  removePage(filePath: string) {
    const absFilePath = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(this.config.root, filePath);

    const pageIndex = this._pages.findIndex(
      page => page.filePath === absFilePath
    );

    if (pageIndex < 0) {
      return null;
    }

    const [page] = this._pages.splice(pageIndex, 1);
    return page;
  }

  async createRoutes(basePath: string): Promise<Route[]> {
    if (!this._startPromise) {
      throw new Error('PagesService is not started yet');
    }

    await this._startPromise;

    let pages = this._pages.filter(page => page.basePath === basePath);
    // run hook: onCreatePages
    pages = (await this.config.onCreatePages?.(pages)) || pages;

    pages.sort((a, b) => {
      const compareRes = a.routePath.localeCompare(b.routePath);
      // layout first
      return compareRes === 0 && a.isLayout ? -1 : compareRes;
    });

    let routes: Route[] = [];
    const layoutRouteStack: Route[] = [];

    for (const page of pages) {
      let route: Route = {
        path: page.routePath,
        component: page.filePath, // TODO: relative to vite root?
        children: page.isLayout ? [] : undefined,
      };

      // run hook: onCreateRoute
      route = (await this.config.onCreateRoute?.(route)) || route;

      while (layoutRouteStack.length) {
        const layout = layoutRouteStack[layoutRouteStack.length - 1];

        // - root layout
        // - same level layout
        // - sub level layout
        if (
          layout.path === '/' ||
          layout.path === route.path ||
          route.path.startsWith(layout.path + '/')
        ) {
          layout.children?.push(route);
          break;
        }

        layoutRouteStack.pop();
      }

      if (!layoutRouteStack.length) {
        routes.push(route);
      }

      if (page.isLayout) {
        layoutRouteStack.push(route);
      }
    }

    // run hook: onCreateRoutes
    routes = (await this.config.onCreateRoutes?.(routes)) || routes;

    return routes;
  }

  async generateRoutesCode(basePath: string): Promise<string> {
    const routes = await this.createRoutes(basePath);
    const rootLayout = routes[0]?.children ? routes[0] : null;

    let index = 0;
    let importCode = `import React from 'react';\n`;

    let routesCode = JSON.stringify(routes, null, 2).replace(
      /"component":\s"(.*?)"/g,
      (_str: string, component: string) => {
        const localName = `__ConventionalRoute__${index++}`;

        if (rootLayout && component === rootLayout.component) {
          importCode += `import ${localName} from '${component}';\n`;
        } else {
          importCode += `const ${localName} = React.lazy(() => import('${component}'));\n`;
        }

        return `"element": <${localName} />`;
      }
    );

    // prepend import code
    routesCode = `${importCode}
const routes = ${routesCode};
export default routes;
`;

    // run hook: onGenerateRoutesCode
    routesCode =
      (await this.config.onGenerateRoutesCode?.(routesCode)) || routesCode;

    return routesCode;
  }
}
