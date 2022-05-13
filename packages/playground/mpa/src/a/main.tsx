import React from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routes from 'virtual:conventional-routes/a';
import './main.css';

function RoutesRenderer() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <React.StrictMode>
      <BrowserRouter basename="/base">
        <RoutesRenderer />
      </BrowserRouter>
    </React.StrictMode>
  );
}
