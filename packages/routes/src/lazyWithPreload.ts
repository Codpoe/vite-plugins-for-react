import { ResolvedConfig } from 'vite';

declare const seen: Record<string, boolean>;
declare const base: string;
declare const assetsDir: string;
declare const document: any;

/**
 * Add preload function to `React.lazy`.
 * This function will be injected into routes code
 */
function lazyWithPreload(factory: () => Promise<any>) {
  const relativeBase = base === '' || base.startsWith('.');

  const links = factory
    .toString()
    .match(/('|")(.*?)\1/g)
    ?.map(link => {
      // remove quotes
      link = link.slice(1, -1);

      if (link.startsWith('/')) {
        return link;
      }

      if (link.startsWith('./')) {
        link = assetsDir + link.slice(1);
      }

      return relativeBase ? new URL(link, base).href : base + link;
    });

  // @ts-ignore
  const LazyComponent = React.lazy(factory);

  LazyComponent.preload = async function preload() {
    if (!links || !links.length) {
      return;
    }

    links.forEach(link => {
      if (link in seen) {
        return;
      }
      seen[link] = true;

      const isCss = link.endsWith('.css');

      // check if the file is already prefetched / preloaded
      if (document.querySelector(`link[href="${link}"]`)) {
        return;
      }

      const el = document.createElement('link');

      el.rel = 'prefetch';
      if (!isCss) {
        el.as = 'script';
        el.crossOrigin = '';
      }
      el.href = link;

      document.head.appendChild(el);
    });
  };

  return LazyComponent;
}

export function generateLazyCode(viteConfig: ResolvedConfig) {
  return `const seen = {};
const base = '${viteConfig.base}';
const assetsDir = '${viteConfig.build.assetsDir}';
${lazyWithPreload.toString()}`;
}
