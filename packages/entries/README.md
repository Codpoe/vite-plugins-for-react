# vite-plugin-conventional-entries

![npm](https://img.shields.io/npm/v/vite-plugin-conventional-entries)

用于自动识别入口的 vite 插件，支持多入口。

## 为什么

虽然 vite 支持多页面应用，但是需要在对应的路径上放置 `index.html` 文件，并且需要在 `build.rollupOptions.input` 中配置好各个入口点，具体说明参考 [vite 文档](https://vitejs.dev/guide/build.html#multi-page-app)。这些配置略显麻烦，并且有点奇怪，所以我写了这个插件，以我认为的更优雅的方式来解决这个问题。

默认情况下，插件会扫描 `src` 下的 `main.{js,jsx,ts,tsx}` 作为页面入口文件。你并不需要在对应的路径上放置 `index.html`，因为插件自带了一个非常简单的 html 文件，并且会自动设置好 JavaScript 入口。当然，你还是可以很方便地自定义 html，详见[自定义 html](#自定义-html)。

## 使用

### 配置插件

在 vite.config.ts 中配置插件：
```ts
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import conventionalEntries from 'vite-plugin-conventional-entries';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), conventionalEntries()],
});
```

### 在入口文件导出根组件

例如：
```tsx
// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
  return <div>Hello World</div>;
}
```

插件会自动把该组件挂载到 root 节点上。

### 自定义挂载逻辑

如果想自定义挂载逻辑，例如挂载到非 root 节点，或者在挂载前进行一些额外处理，可以在 `main.tsx` 的同级目录下创建 `entry.client.tsx`：
```tsx
// src/entry.client.tsx.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './main';

// 挂载到 app 节点
const appEl = document.getElementById('app');
ReactDOM.createRoot(appEl).render(<App />);
```

> 为什么文件名是 `entry.client.tsx`，而不是直接 `entry.tsx`？因为在 SSR 场景下可能还会有 `entry.server.tsx`，这样名称能更统一。

### 自定义 html

在入口文件 `main.js` 的同级目录下，支持创建下面四种 html 片段：
- head.html
- body.html
- head-prepend.html
- body-prepend.html

这些 html 片段会被插件注入到 html 模板的相应位置上。默认的 html 模板如下，`head`、`body`、`head-prepend`、`body-prepend` 的位置也标注出来了：
```html
<!DOCTYPE html>
<html>
  <head>
    <!-- head-prepend.html -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- head.html -->
  </head>
  <body>
    <!-- body-prepend.html -->
    <noscript>
      We're sorry but react app doesn't work properly without JavaScript
      enabled. Please enable it to continue.
    </noscript>
    <div id="root"></div>
    <!-- body.html -->
  </body>
</html>
```

如果想完全自定义 html 模板，可以在入口文件的同级目录下创建 `index.html`，这样插件就会直接使用该 html，而不是上述的默认 html。

对于多页面应用，如果想使用同一个 html 模板，可以在项目根目录下创建 `index.html`，该文件会被用作所有页面的 html 模板。

> html 模板的优先级为：与入口文件同级的 index.html > 项目根目录下的 index.html > 插件内置的默认 html。

## 配置项

### src

指定目录来扫描入口文件，默认是 `src`。这个配置会影响生成的入口路由，假设目录结构如下：
```
- vite.config.ts
- src/
  - main.ts
```

那么在访问 `/` 时会获取到 `src/main.ts`。而如果把 `src` 设置为项目根目录，那么就需要访问 `/src` 才会获取到 `/src/main.ts` 了。

### pattern

设置入口文件的 glob 规则，默认是 `**/main.{js,jsx,ts,tsx}`。

### basePath

设置入口的基础路径。
