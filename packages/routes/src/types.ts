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
  meta?: Record<string, any>;
}

export interface PageData {
  basePath: string;
  routePath: string;
  filePath: string;
  meta?: Record<string, any>;
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
  onCreatePage?: (page: Page) => Page | void | Promise<Page | void>;
  onCreatePages?: (pages: Page[]) => Page[] | void | Promise<Page[] | void>;
  onCreateRoute?: (route: Route) => Route | void | Promise<Route | void>;
  onCreateRoutes?: (
    routes: Route[]
  ) => Route[] | void | Promise<Route[] | void>;
  onGenerateRoutesCode?: (
    code: string
  ) => string | void | Promise<string | void>;
  onCreatePageData?: (
    pageData: PageData
  ) => PageData | void | Promise<PageData | void>;
  onCreatePagesData?: (
    pagesData: Record<string, PageData>
  ) =>
    | Record<string, PageData>
    | void
    | Promise<Record<string, PageData> | void>;
}

export interface ResolvedConfig extends Omit<UserConfig, 'pages'> {
  root: string;
  src: string;
  pages: PagesConfigWithType;
  ignore: string | string[];
}
