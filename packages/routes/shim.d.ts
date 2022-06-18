declare module 'virtual:conventional-routes*' {
  export interface Route {
    path: string;
    component: any;
    element: any;
    children?: Route[];
    meta?: Record<string, any>;
  }

  const routes: Route[];
  export default routes;
}

declare module 'virtual:conventional-pages-data' {
  export interface PageData {
    basePath: string;
    routePath: string;
    filePath: string;
    meta?: Record<string, any>;
  }

  const pagesData: Record<string, PageData>;
  export default pagesData;
}
