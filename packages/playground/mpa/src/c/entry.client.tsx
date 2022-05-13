import ReactDOM from 'react-dom/client';
import App from './main';

// eslint-disable-next-line no-console
console.log('custom mount');
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
