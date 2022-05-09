declare module 'virtual:conventional-routes*' {
  export interface Route {
    path: string;
    component: any;
    children?: Route[];
    meta: Record<string, any>;
  }

  const routes: Route[];
  export default routes;
}
