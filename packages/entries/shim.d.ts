declare module 'virtual:conventional-entries' {
  export interface Entry {
    entryPath: string;
    routePath: string;
    serverPath: string;
    htmlPath: string;
  }

  const entries: Entry[];
  export default entries;
}
