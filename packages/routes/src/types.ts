export interface Page {
  basePath: string;
  routePath: string;
  filePath: string;
  meta: Record<string, any>;
  isLayout: boolean;
  is404: boolean;
}

export interface Route {
  path: string;
  component: any;
  children?: Route[];
  meta: Record<string, any>;
}

export interface PagesConfigItem {
  /**
   * base route path
   * @default '/'
   */
  basePath?: string;
  /**
   * Directory to find pages
   */
  dir: string;
  /**
   * Glob patterns for tracking.
   * @default '**\/*{.js,.jsx,.ts,.tsx,.md,.mdx}'
   */
  pattern?: string | string[];
  /**
   * Defines files/paths to be ignored.
   */
  ignore?: string | string[];
}

export type UserPages = string | PagesConfigItem | (string | PagesConfigItem)[];

export type PagesConfig = Required<PagesConfigItem>[];

export interface PagesConfigWithType {
  type: 'auto' | 'custom';
  config: PagesConfig;
}

export interface UserConfig {
  /**
   * src directory to detect pages
   * @default 'src'
   */
  src?: string;
  /**
   * config to find pages
   * @default auto
   */
  pages?: UserPages;
  /**
   * Defines files/paths to be ignored.
   */
  ignore?: string | string[];
  onCreatePage?: (
    page: Page
  ) => Page | null | undefined | Promise<Page | null | undefined>;
  onCreatePages?: (
    pages: Page[]
  ) => Page[] | null | undefined | Promise<Page[] | null | undefined>;
  onCreateRoute?: (
    route: Route
  ) => Route | null | undefined | Promise<Route | null | undefined>;
  onCreateRoutes?: (
    routes: Route[]
  ) => Route[] | null | undefined | Promise<Route[] | null | undefined>;
  onGenerateRoutesCode?: (
    code: string
  ) => string | null | undefined | Promise<string | null | undefined>;
}

export interface ResolvedConfig extends Omit<UserConfig, 'pages'> {
  root: string;
  src: string;
  pages: PagesConfigWithType;
  ignore: string | string[];
}
