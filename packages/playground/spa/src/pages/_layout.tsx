import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div>
      123456122133
      <Suspense>
        <Outlet />
      </Suspense>
    </div>
  );
}
