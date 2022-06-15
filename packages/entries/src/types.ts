import { Options as PrettierOptions } from 'prettier';
import { Options as HtmlMinifierOptions } from 'html-minifier-terser';

export interface Entry {
  entryPath: string;
  routePath: string;
  serverPath: string;
  htmlPath: string;
}

export interface UserConfig {
  /**
   * src directory to get entries
   * @default 'src'
   */
  src?: string;
  /**
   * pattern to get entries
   * @default '**\/main.{js,jsx,ts,tsx}'
   */
  pattern?: string | string[];
  /**
   * base route path
   * @default '/'
   */
  basePath?: string;
  /**
   * use prettier to format html
   */
  prettifyHtml?: boolean | PrettierOptions;
  /**
   * minify html
   */
  minifyHtml?: boolean | HtmlMinifierOptions;
}
