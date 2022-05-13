import React from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routes from 'virtual:conventional-routes';
import './main.css';

function RoutesRenderer() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <RoutesRenderer />
      </BrowserRouter>
    </React.StrictMode>
  );
}
