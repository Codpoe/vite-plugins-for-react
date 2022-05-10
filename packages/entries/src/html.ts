import path from 'upath';
import fs from 'fs-extra';
import { camelCase, uniq } from 'lodash';
import { Connect, normalizePath, send, ViteDevServer } from 'vite';
import history, { Rewrite } from 'connect-history-api-fallback';
import { Entry } from './types';
import {
  BODY_INJECT_RE,
  BODY_PREPEND_INJECT_RE,
  DEFAULT_HTML_PATH,
  HEAD_INJECT_RE,
  HEAD_PREPEND_INJECT_RE,
  MIDDLE_ENTRY_MODULE_ID,
} from './constants';
import { cleanUrl, normalizeRoutePath } from './utils';

function resolveRewrites(root: string, entries: Entry[]): Rewrite[] {
  return entries.map<Rewrite>(entry => {
    return {
      from: new RegExp(`^${entry.routePath}.*`),
      to() {
        // priority use of index.html in the entry
        if (fs.existsSync(entry.htmlPath)) {
          return normalizeRoutePath(path.relative(root, entry.htmlPath));
        }
        return `/index.html`;
      },
    };
  });
}

export function spaFallbackMiddleware(
  root: string,
  entries: Entry[]
): Connect.NextHandleFunction {
  // setup rewrites so that each route can correctly find the corresponding html file
  const rewrites = resolveRewrites(root, entries);

  const historyMiddleware = history({
    // logger: console.log.bind(console),
    htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    rewrites,
  }) as Connect.NextHandleFunction;

  return function viteSpaFallbackMiddleware(req, res, next) {
    if (!req.url) {
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

function injectEntryScript(html: string, entry: Entry): string {
  // if html already has entry script，return directly to avoid repeated injection
  if (new RegExp(`src=['"]${entry.serverPath}['"]`).test(html)) {
    return html;
  }

  const hasDefaultExport = /(^|\n)export default/.test(
    fs.readFileSync(entry.entryPath, 'utf-8')
  );
  const src = hasDefaultExport
    ? `${MIDDLE_ENTRY_MODULE_ID}?routePath=${entry.routePath}`
    : entry.serverPath;

  return injectHtml(
    html,
    'body',
    `<script type="module" src="${src}"></script>`
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
