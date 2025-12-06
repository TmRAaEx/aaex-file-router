# AAEX File Router

A file-based routing system for React projects that automatically generates routes from your file structure. Similar to Next.js App Router or Remix file conventions.

## V. 1.4.4 
**Bugfixes**

Added support for loading components

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [1. Create your pages structure](#1-create-your-pages-structure)
  - [2. Configure Vite](#2-configure-vite)
  - [3. Use in your app](#3-use-in-your-app)
    - [Using createBrowserRouter](#1-using-createbrowserrouter-recommended-for-most-users)
    - [Using nested Route elements](#2-using-nested-route-elements)
- [File Conventions](#file-conventions)
- [Route Resolution Examples](#route-resolution-examples)
- [Import strategy](#import-strategy)
- [Layouts](#layouts)
- [FileLink component](#filelink-component)
- [Usage](#usage)
- [Generated files](#generated-files)
- [API Reference](#api-reference)
- [How It Works](#how-it-works)
- [Performance Considerations](#performance-considerations)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- **Automatic Route Generation**: Routes are generated based on your file and folder structure
- **Layout Support**: Create `layout.tsx` files to wrap nested routes
- **Slug Support**: Creates dynamic routes for [slug] files
- **Static & Lazy Loading**: Top-level routes use static imports, nested routes use lazy loading
- **Hot Reload**: Vite plugin watches for file changes and regenerates routes automatically
- **TypeScript Support**: Full TypeScript support with generated route types
- **Type safe link component**: Link component that knows what routes are available

## Installation

```bash
npm install aaex-file-router
```

## Quick Start

### 1. Create your pages structure

```
src/pages/
└── dashboard/
    ├── loading.tsx      ← Used as fallback for ALL lazy imports below
    ├── index.tsx
    ├── stats/
    │   ├── loading.tsx  ← Overrides parent
    │   └── weekly.tsx
    └── users/
        └── [id].tsx     ← used for dynamic routes ex :users/123

```

### 2. Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { aaexFileRouter } from "aaex-file-router/plugin";

export default defineConfig({
  plugins: [
    react(),
    aaexFileRouter({
      pagesDir: "./src/pages", //page files location(optional: default ./src/pages)
      outputFile: "./src/routes.ts", //generated routes (default: ./src/routes.ts)
    }),
  ],
});
```

### 3. Use in your app

### Note: Since v1.4.0 every lazy-loaded route is automatically wrapped in a Suspense boundary, using the nearest loading.tsx file as the fallback.

#### 1. Using createBrowserRouter (recommended for most users)

```typescript
// src/App.tsx
import "./App.css";
import routes from "./routes";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Suspense } from "react";

function App() {
  const router = createBrowserRouter(routes);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default App;
```

### 2. Using nested Route elements

**Note** I will probably create a custom route provider using this version later since this is the only solution that works with VITE-SSR if you wrap client in `<BrowserRouter/>` and server in `<StaticRouter/>`

```tsx
//src/App.tsx
import {
  BrowserRouter,
  Routes,
  Route,
  type RouteObject,
} from "react-router-dom";
import routes from "./routes";
import { Suspense } from "react";
import "./App.css";

//recursivly creates nested routes
function createRoutes(route: RouteObject) {
  return (
    <Route key={route.path} path={route.path} element={route.element}>
      {route.children?.map((child) => createRoutes(child))}
    </Route>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>{routes.map((route) => createRoutes(route))}</Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
```

## File Conventions

### `index.tsx`

Renders at the parent route path.

```
pages/index.tsx       → "/"
pages/about/index.tsx → "/about"
```

### `layout.tsx`

Wraps all sibling and nested routes. Children are rendered in an `<Outlet />`.

```tsx
// pages/admin/layout.tsx
import { Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div>
      <nav>Admin Navigation</nav>
      <Outlet /> {/* Nested routes render here */}
    </div>
  );
}
```

### `loading.tsx`

Folder level loading component <br>
Autmatically gets rendered instead of files waiting on lazy import

```tsx
// src/pages/test/loading.tsx
export default function Test() {
  return <div>Loading...</div>;
}
```

### Slug files

Filenames wrapper in square brackets `[filename]` will resolve to a dynamic route

```
src/pages/test/[<filename>].tsx → "/test/:<filename>"
```

```tsx
// src/pages/test/[slug].tsx

import { useParams } from "react-router-dom";

export default function TestWithSlug() {
  // replace slug with what the file is called
  const { slug } = useParams();

  return <div>{slug}</div>;
}
```

### Named files

Any other `.tsx` file becomes a route based on its filename.

```
pages/about.tsx       → "/about"
pages/blog/post.tsx   → "/blog/post"
```

<!-- ## Generated Routes File

The plugin generates a `routes.ts` file with all your routes:

```typescript
// src/routes.ts
// AUTO GENERATED: DO NOT EDIT
import React from "react";
import Index from "./pages/index.tsx";
import AdminLayout from "./pages/admin/layout.tsx";
import type { RouteObject } from "react-router-dom";

const routes: RouteObject[] = [
  {
    path: "/",
    element: React.createElement(Index),
  },
  {
    path: "admin",
    element: React.createElement(AdminLayout),
    children: [
      // nested routes...
    ],
  },
];

export default routes;
``` -->

## Route Resolution Examples

| File Structure                          | Route Path           |
| --------------------------------------- | -------------------- |
| `src/pages/index.tsx`                   | `/`                  |
| `src/pages/about.tsx`                   | `/about`             |
| `src/pages/blog/index.tsx`              | `/blog`              |
| `src/pages/blog/post.tsx`               | `/blog/post`         |
| `src/pages/admin/layout.tsx` + children | `/admin/*` (grouped) |

## Layouts

Layouts wrap their child routes and provide shared UI:

```typescript
// src/pages/dashboard/layout.tsx
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

All routes in `src/pages/dashboard/*` will render inside this layout.

## Import Strategy

| File type                             |     |     | Import style  |     |
| ------------------------------------- | --- | --- | ------------- | --- |
| pages/\*.tsx (top level)              |     |     | static import |     |
| Files inside a folder with layout.tsx |     |     | Lazy loaded   |     |
| Files inside a folder without layout  |     |     | Lazy loaded   |     |
| layout.tsx                            |     |     | Static import |
| loading.tsx                           |     |     | Static import |
--- 
Top-level pages are always statically imported for faster initial navigation.
All nested pages are lazy-loaded and wrapped in a Suspense boundary.

## FileLink component

The FileLink component is a type safe wrapper for the Link component in react router that uses an autogenerated type to check which routes are available.

## Notice!

At the moment it can only do the basic routing where the "to" prop is a string.
React Router's normal Link still works in cases where type safety is less important.

## Usage

If reades the type file that is automatically generated

`users/{string}` is what users/:slug gets translated to this means users/ allows any string after even if the route dosnt exist. Will look into better solution

```ts
// src/routeTypes.ts
// * AUTO GENERATED: DO NOT EDIT
/
export type FileRoutes = "/" | "test" | "users/{string}";
```

```tsx
// src/pages/index.tsx
import { FileLink } from "aaex-file-router";
import type { FileRoutes } from "../routeTypes"; //import type

export default function Home() {
  return (
    <>
      Hello Home!
      {/* FileRoutes is optional and not required it will work fine with any string if not passed */}
      <FileLink<FileRoutes> to="test">Test safe</FileLink>
      {/* or without type safety */}
      <FileLink to="some-route">Non safe</FileLink>
    </>
  );
}
```

## Generated files

### routes.ts

Generated route definition file

```ts
// src/routes.ts
...imports
export default routes = [
    {
        path: "/",
        element: React.createElement(Index)},
    {
        path: "test",
        element: React.createElement(TestLayout),
        children:
        [
            {
            path: "",
            element: React.createElement(
                React.Suspense,
                { fallback: React.createElement(TestLoading) },
                React.createElement(React.lazy(() => import("./pages/test/index.tsx")))
            )
            },
            ...
        ]
    }
    ]

```

### routeTypes.ts

Exports TypeScript union type of existing routes

```ts
export type FileRoutes = `/` | `test`;
```

## API Reference

### FileScanner

Scans the file system and converts files into a structured format.

```typescript
import { FileScanner } from "aaex-file-router/core";

const scanner = new FileScanner("./src/pages");
const fileData = await scanner.get_file_data();
```

### RouteGenerator

Converts file structure into React Router route configuration.

```typescript
import { RouteGenerator } from "aaex-file-router/core";

const generator = new RouteGenerator();
const routesCode = await generator.generateRoutesFile(fileData);
```

### aaexFileRouter (Vite Plugin)

Automatically watches for file changes and regenerates routes.

```typescript
import { aaexFileRouter } from "aaex-file-router/plugin";

export default defineConfig({
  plugins: [
    aaexFileRouter({
      pagesDir: "./src/pages",
      outputFile: "./src/routes.ts",
    }),
  ],
});
```

## How It Works

1. **File Scanning**: Recursively scans your pages directory and builds a file tree
2. **Route Generation**: Converts the file structure into React Router `RouteObject` format
3. **Smart Importing**:
   - Top-level files use static imports for faster initial load
   - Nested/grouped routes use lazy loading for code splitting
   - Layout files are statically imported as route wrappers
4. **Auto-Regeneration**: Vite plugin watches for changes and automatically regenerates `routes.ts`

## Performance Considerations

- **Static Imports**: Top-level routes are statically imported, included in the main bundle
- **Code Splitting**: Routes nested in layout groups are lazy-loaded, improving initial bundle size
- **Watch Mode**: File watching only runs in development (`vite serve`), not in production builds

## Common Patterns

### Shared Layout

```sh
pages/
├── layout.tsx         # Wraps entire app
├── index.tsx
└── about.tsx
```

### Nested Layouts

```sh
pages/
├── layout.tsx                 # Root layout
├── admin/
│   ├── layout.tsx            # Admin layout (inherits from root)
│   ├── index.tsx
│   └── users.tsx
```

### Route Groups Without Layout

```sh
pages/
├── blog/
│   ├── post.tsx              # Routes as /blog/post (no grouping)
│   └── author.tsx            # Routes as /blog/author
```

## Troubleshooting

### Routes not updating on file change

- Ensure Vite dev server is running (`npm run dev`)
- Check that `pagesDir` in vite config matches your actual pages directory

### Duplicate imports in generated file

- This shouldn't happen, but if it does, try restarting the dev server
- Check for files with the same name in different directories

### Unexpected route paths

- Remember: `index.tsx` files inherit their parent's path
- Directories without `layout.tsx` flatten their children into absolute routes
- File names are converted to lowercase for routes

<!-- ## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. -->

## License

MIT

<!-- ## Support

For issues, questions, or suggestions, please open an issue on GitHub. -->
