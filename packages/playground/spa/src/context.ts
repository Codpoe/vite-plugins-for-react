import { createContext } from 'react';
import { Route } from 'virtual:conventional-routes';

export const appContext = createContext<{ routes: Route[] }>({ routes: [] });
