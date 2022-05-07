declare module 'virtual:conventional-routes*' {
  export interface Route {
    path: string;
    component: any;
    children?: Route[];
  }

  const routes: Route[];
  export default routes;
}
