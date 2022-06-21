import { Options as PrettierOptions } from 'prettier';
import { Options as HtmlMinifierOptions } from 'html-minifier-terser';

export interface Entry {
  entryPath: string;
  routePath: string;
  serverPath: string;
  htmlPath: string;
}

export interface UserEntryConfigItem {
  /**
   * base route path
   * @default '/'
   */
  basePath?: string;
  /**
   * Directory to find entries
   */
  dir: string;
  /**
   * Glob patterns to find entries
   * @default '**\/main.{js,jsx,ts,tsx}'
   */
  pattern?: string | string[];
  /**
   * Defines files/paths to be ignored.
   */
  ignore?: string | string[];
}

export interface UserConfig {
  entries?: string | UserEntryConfigItem | (string | UserEntryConfigItem)[];
  /**
   * use prettier to format html
   */
  prettifyHtml?: boolean | PrettierOptions;
  /**
   * minify html
   */
  minifyHtml?: boolean | HtmlMinifierOptions;
}
