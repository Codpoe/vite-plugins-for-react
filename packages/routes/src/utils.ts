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
export function extractMetaExport(fileContent: string): {
  start?: number;
  end?: number;
  meta?: Record<string, any>;
} {
  const matchArr = fileContent.match(/^\s*export\s+const\s+meta\s+=\s+\{/m);

  if (matchArr?.index == null) {
    return {};
  }

  const re = /\{|\}/g;
  const metaExport = fileContent.slice(matchArr.index);
  let execArr: RegExpExecArray | null = null;
  let metaStart: number | null = null;
  let metaEnd: number | null = null;
  let braceFlag = 0;

  while ((execArr = re.exec(metaExport)) != null) {
    if (execArr[0] === '{') {
      braceFlag++;
    } else {
      braceFlag--;
    }

    if (braceFlag === 1 && !metaStart) {
      metaStart = matchArr.index + execArr.index;
    }

    if (braceFlag === 0) {
      metaEnd = matchArr.index + execArr.index + 1;
      break;
    }
  }

  if (!metaStart || !metaEnd) {
    return {};
  }

  try {
    const meta = JSON.parse(
      fileContent
        .substring(metaStart, metaEnd)
        // remove trailing comma
        .replace(/,\s*(]|})/g, '$1')
        // ' -> "
        .replaceAll(`'`, `"`)
        // put double quotes on the object's key
        .replace(/[{|\s](\w*?):/g, (m, p1: string) => m.replace(p1, `"${p1}"`))
    );
    return {
      start: matchArr.index,
      end: metaEnd,
      meta,
    };
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
