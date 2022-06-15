import path from 'upath';
import fs from 'fs-extra';
import { camelCase, uniq } from 'lodash';
import {
  Connect,
  normalizePath,
  send,
  ServerOptions,
  ViteDevServer,
} from 'vite';
import history, { Rewrite } from 'connect-history-api-fallback';
import { format } from 'prettier';
import { minify } from 'html-minifier-terser';
import { Entry, UserConfig } from './types';
import {
  BODY_INJECT_RE,
  BODY_PREPEND_INJECT_RE,
  DEFAULT_ENTRY_MODULE_ID,
  DEFAULT_HTML_PATH,
  HEAD_INJECT_RE,
  HEAD_PREPEND_INJECT_RE,
} from './constants';
import { cleanUrl, normalizeRoutePath } from './utils';

function resolveRewrites(server: ViteDevServer, entries: Entry[]): Rewrite[] {
  return entries.map<Rewrite>(entry => {
    return {
      from: new RegExp(`^${entry.routePath}.*`),
      to() {
        // priority use of index.html in the entry
        if (fs.existsSync(entry.htmlPath)) {
          return normalizeRoutePath(
            server.config.base +
              '/' +
              path.relative(server.config.root, entry.htmlPath)
          );
        }
        return `/index.html`;
      },
    };
  });
}

function checkMatchProxy(proxy: ServerOptions['proxy'], url: string): boolean {
  if (!proxy) {
    return false;
  }

  return Object.keys(proxy).some(key =>
    key.startsWith('^') ? new RegExp(key).test(url) : url.startsWith(key)
  );
}

export function spaFallbackMiddleware(
  server: ViteDevServer,
  entries: Entry[]
): Connect.NextHandleFunction {
  // setup rewrites so that each route can correctly find the corresponding html file
  const rewrites = resolveRewrites(server, entries);

  const historyMiddleware = history({
    // logger: console.log.bind(console),
    htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    rewrites,
  }) as Connect.NextHandleFunction;

  return function viteSpaFallbackMiddleware(req, res, next) {
    // The path of virtual module usually starts with @, we shouldn't rewrite it
    if (
      !req.url ||
      req.url.startsWith('/@') ||
      req.url.startsWith(server.config.base + '@')
    ) {
      return next();
    }

    // If match proxy config, skip rewrite
    if (checkMatchProxy(server.config.server.proxy, req.url)) {
      return next();
    }

    const ext = path.extname(cleanUrl(req.url));

    // Do not rewrite paths with non-html ext
    if (ext && ext !== '.html') {
      return next();
    }

    return historyMiddleware(req, res, next);
  };
}

/**
 * Based on vite html middleware, support default html
 */
export function htmlMiddleware(
  server: ViteDevServer
): Connect.NextHandleFunction {
  return async function viteHtmlMiddleware(req, res, next) {
    if (res.writableEnded) {
      return next();
    }

    const url = req.url && cleanUrl(req.url);

    if (url?.endsWith('.html') && req.headers['sec-fetch-dest'] !== 'script') {
      const filePath = normalizePath(
        path.join(server.config.root, url.slice(1))
      );
      // if the html file dose not exist, use the default html instead
      let html = fs.readFileSync(
        fs.existsSync(filePath) ? filePath : DEFAULT_HTML_PATH,
        'utf-8'
      );

      try {
        html = await server.transformIndexHtml(url, html, req.originalUrl);
        return send(req, res, html, 'html', {
          headers: server.config.server.headers,
        });
      } catch (e) {
        return next(e);
      }
    }
    next();
  };
}

type InjectHtmlType = 'head-prepend' | 'head' | 'body-prepend' | 'body';

function getHtml(entry: Entry, type: InjectHtmlType): string | null {
  const fileNames = uniq([type, camelCase(type)]);

  for (const name of fileNames) {
    const htmlPath = path.resolve(
      path.dirname(entry.entryPath),
      `${name}.html`
    );

    if (fs.existsSync(htmlPath)) {
      return fs.readFileSync(htmlPath, 'utf-8');
    }
  }

  return null;
}

function incrementIndent(content: string, indent = ''): string {
  indent = `${indent}${indent[0] === '\t' ? '\t' : '  '}`;

  return content
    .trim()
    .split('\n')
    .map(line => `${indent}${line}`)
    .join('\n');
}

function injectHtml(
  html: string,
  type: InjectHtmlType,
  content: string | null
): string {
  if (!content) {
    return html;
  }

  if (type === 'head-prepend') {
    // inject as the first element of head
    if (HEAD_PREPEND_INJECT_RE.test(html)) {
      const res = html.replace(
        HEAD_PREPEND_INJECT_RE,
        (match, p1) => `${match}\n${incrementIndent(content, p1)}`
      );

      return res;
    }
  } else if (type === 'head') {
    // inject before head close
    if (HEAD_INJECT_RE.test(html)) {
      return html.replace(
        HEAD_INJECT_RE,
        (match, p1) => `${incrementIndent(content, p1)}\n${match}`
      );
    }
  } else if (type === 'body-prepend') {
    // inject after body open
    if (BODY_PREPEND_INJECT_RE.test(html)) {
      return html.replace(
        BODY_PREPEND_INJECT_RE,
        (match, p1) => `${match}\n${incrementIndent(content, p1)}`
      );
    }
  } else {
    // inject before body close
    if (BODY_INJECT_RE.test(html)) {
      return html.replace(
        BODY_INJECT_RE,
        (match, p1) => `${incrementIndent(content, p1)}\n${match}`
      );
    }
  }

  return html;
}

/**
 * Find entry.client.{js,jsx,ts,tsx}, fallback to DEFAULT_ENTRY_MODULE_ID
 */
function getEntryClientPath(entry: Entry): string {
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    const entryClientPath = path.resolve(
      path.dirname(entry.entryPath),
      `entry.client${ext}`
    );

    if (fs.existsSync(entryClientPath)) {
      return entryClientPath;
    }
  }

  return `${DEFAULT_ENTRY_MODULE_ID}?routePath=${entry.routePath}`;
}

function injectEntryScript(html: string, entry: Entry): string {
  // if html already has entry script，return directly to avoid repeated injection
  if (new RegExp(`src=['"]${entry.serverPath}['"]`).test(html)) {
    return html;
  }

  return injectHtml(
    html,
    'body',
    `<script type="module" src="${getEntryClientPath(entry)}"></script>`
  );
}

export function transformHtml(html: string, entry: Entry): string {
  const types: InjectHtmlType[] = [
    'head-prepend',
    'head',
    'body-prepend',
    'body',
  ];

  html = types.reduce(
    (res, type) => injectHtml(res, type, getHtml(entry, type)),
    html
  );

  html = injectEntryScript(html, entry);

  return html;
}

export function prettifyHtml(
  html: string,
  options: NonNullable<UserConfig['prettifyHtml']>
) {
  if (options === false) {
    return html;
  }
  return format(html, {
    parser: 'html',
    ...(options === true ? {} : options),
  });
}

export async function minifyHtml(
  html: string,
  options: NonNullable<UserConfig['minifyHtml']>
) {
  if (options === false) {
    return html;
  }
  return minify(
    html,
    options === true
      ? {
          collapseWhitespace: true,
          keepClosingSlash: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
          minifyCSS: true,
        }
      : options
  );
}
