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
}

export interface ResolvedConfig extends Required<UserConfig> {}
