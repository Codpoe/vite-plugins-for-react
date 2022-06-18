import pagesData from 'virtual:conventional-pages-data';
import './index.css';

export default function User() {
  return (
    <div>
      user page
      <pre>{JSON.stringify(pagesData, null, 2)}</pre>
    </div>
  );
}
