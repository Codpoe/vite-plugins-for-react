import path from 'upath';
import { extract, parse } from 'jest-docblock';
import matter from 'gray-matter';

export function normalizeRoutePath(routePath: string) {
  return path.normalize('/' + routePath.replace(/\/+$/, ''));
}

/**
 * Extract and parse doc block in file content
 */
export function extractDocBlock(fileContent: string) {
  return parse(extract(fileContent));
}

/**
 * Extract the meta export
 * @example
 * export const meta = { title: 'abc' };
 * -> { title: 'abc' }
 */
export function extractMetaExport(fileContent: string) {
  const matchArr = fileContent.match(
    /^\s*export\s+const\s+meta\s+=\s+(\{[\s|\S]*?\})(;|(\n){2,}|$)/m
  );

  if (!matchArr) {
    return {};
  }

  try {
    return JSON.parse(
      matchArr[1]
        // remove trailing comma
        .replace(/,\s*(]|})/g, '$1')
        // ' -> "
        .replaceAll(`'`, `"`)
        // put double quotes on the object's key
        .replace(/[{|\s](\w*?):/g, (m, p1: string) => m.replace(p1, `"${p1}"`))
    );
  } catch (err) {
    throw new Error(
      'Extract meta fail. Please check that the exported meta data is correct.'
    );
  }
}

/**
 * Extract front matter in markdown
 */
export function extractFrontMatter(fileContent: string) {
  const { data: frontMatter, content } = matter(fileContent);

  if (!frontMatter.title) {
    frontMatter.title = extractMarkdownTitle(content);
  }

  return frontMatter;
}

/**
 * Extract markdown title (h1)
 */
export function extractMarkdownTitle(content: string) {
  const match = content.match(/^#\s+(.*)$/m);
  return match?.[1];
}

export function hasDefaultExport(content: string) {
  return /(^|\n)export default/.test(content);
}

export function toArray<T>(data: T | T[] | undefined): T[] {
  if (typeof data === 'undefined') {
    return [];
  }
  return Array.isArray(data) ? data : [data];
}
