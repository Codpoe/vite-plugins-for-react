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
