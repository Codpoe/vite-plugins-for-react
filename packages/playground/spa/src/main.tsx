import React from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routes from 'virtual:conventional-routes';
import { appContext } from './context';
import './main.css';

function RoutesRenderer() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <appContext.Provider value={{ routes }}>
          <RoutesRenderer />
        </appContext.Provider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
