# vite-plugin-conventional-routes

![npm](https://img.shields.io/npm/v/vite-plugin-conventional-routes)

用于生成约定式路由的 vite 插件。

约定式路由即文件系统路由，当文件路径符合约定的结构时，它会被映射为页面和路由路径，例如 `src/pages/user.tsx` 可以被映射为 `/user`。

## 使用

在 vite.config.ts 中配置插件：

```ts
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import conventionalRoutes from 'vite-plugin-conventional-routes';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), conventionalRoutes()],
});
```

默认情况下，插件会扫描 `src/pages` 下的 `js,jsx,ts,tsx,md,mdx` 文件用于生成页面路由。你可以在应用中通过导入模块 `virtual:conventional-routes` 来获取生成的路由配置：

```tsx
// app.tsx
import { BrowserRouter, useRoutes } from 'react-router-dom';
import routes from 'virtual:conventional-routes';

function RoutesRenderer() {
  return useRoutes(routes);
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback="loading">
        <RoutesRenderer />
      </Suspense>
    </BrowserRouter>
  );
}
```

例如假设你的项目结构如下：
```
└─ src
   └─ pages
      ├─ user.tsx
      └─ index.tsx
```

那对应的路由映射规则就是：
| 文件路径 | 路由路径 |
|-------|---------|
| `src/pages/index.tsx` | `/` |
| `src/pages/user.tsx` |	`/user` |

另外，为了能更方便地组织项目代码，插件在扫描页面文件时默认会忽略一些比较特殊的目录和文件，默认的忽略逻辑见[配置-ignore](#ignore)

## 配置

### src

如果没指定 `pages` 配置，插件默认会基于 `src` 指定的目录来扫描：

- 如果存在 `src/pages` 目录，会扫描该目录下的页面文件
- 如果不存在 `src/pages` 目录，则会遍历 `src` 下的一级目录，看这些目录下是否存在 `pages` 目录，例如 `src/a/pages`

### pages

`pages` 用于自定义扫描规则。例如：

```ts
// vite.config.ts

export default defineConfig({
  plugins: [
    conventionalRoutes({
      pages: {
        /**
         * base route path
         * @default '/'
         */
        basePath: '/docs',
        /**
         * Directory to find pages
         */
        dir: 'docs',
        /**
         * Glob patterns for tracking.
         * @default '**\/*{.js,.jsx,.ts,.tsx,.md,.mdx}'
         */
        pattern: '**/*{.js,.jsx,.md,.mdx}',
        /**
         * Defines files/paths to be ignored.
         */
        ignore: ['**/internal/**', '**/internal.js'],
      }
    }),
  ],
});
```

如果有多个自定义的扫描规则，可以给 `pages` 传递配置数组：

```ts
// vite.config.ts

export default defineConfig({
  plugins: [
    conventionalRoutes({
      pages: [
        { /** ... */ },
        { /** ... */ },
      ],
    }),
  ],
});
```

如果 `basePath` 是 '/'，并且只是想自定义扫描的目录 `dir`，也可以简单地给 `pages` 传递字符串或者字符串数组，例如：
```ts
// vite.config.ts

export default defineConfig({
  plugins: [
    conventionalRoutes({
      pages: 'docs-dir/a',
    }),
  ],
});
```

这等价于：
```ts
// vite.config.ts

export default defineConfig({
  plugins: [
    conventionalRoutes({
      pages: {
        dir: 'docs-dir/a'
      },
    }),
  ],
});
```

### ignore

配置扫描时的忽略规则。默认的忽略逻辑是：

- 忽略目录：`components`、`hooks`、`utils`、`constants`、`services`、`apis`、`styles`、`assets`、`models`、`stores`、`states`、`types`、`tests`、`__tests__`
- 忽略 dts 文件：`*.d.ts`
- 忽略测试文件：`*.test.js`、`*.spec.js`、`*.e2e.js`

### hooks

- onCreatePage
- onCreatePages
- onCreateRoute
- onCreateRoutes
- onGenerateRoutesCode
