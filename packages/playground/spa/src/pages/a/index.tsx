/**
 * @title aaa
 */
import { useContext } from 'react';
import { Link, matchRoutes, resolvePath, useLocation } from 'react-router-dom';
import { appContext } from '../../context';
import './index.css';

export const meta = {
  str: 'This is meta str',
  num: 123,
  bool: true,
  arr: ['a', 'b', { c: { d: 1 } }, 'e'],
  obj: { a: { b: 1 }, c: 2 },
};

export default function A() {
  const { routes } = useContext(appContext);
  const { pathname } = useLocation();

  return (
    <div>
      a page
      <div>
        <Link
          to="../user"
          onMouseEnter={() => {
            const targetPath = resolvePath('../user', pathname);
            const routeMatches = matchRoutes(routes, targetPath);
            routeMatches?.forEach(m => {
              (m.route as any).component?.prefetch?.();
            });
          }}
        >
          to user page (hover to prefetch)
        </Link>
      </div>
    </div>
  );
}
