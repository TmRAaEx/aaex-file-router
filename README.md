# AAEX File Router

A file-based routing system for React projects that automatically generates routes from your file structure. Similar to Next.js App Router or Remix file conventions.

## V. 1.0.1
Fixed issue that required --legacy-peer-deps flag for installation


## Features

- **Automatic Route Generation**: Routes are generated based on your file and folder structure
- **Layout Support**: Create `layout.tsx` files to wrap nested routes
- **Static & Lazy Loading**: Top-level routes use static imports, nested routes use lazy loading
- **Hot Reload**: Vite plugin watches for file changes and regenerates routes automatically
- **TypeScript Support**: Full TypeScript support with generated route types

## Installation

```bash
npm install aaex-file-router
```

## Quick Start

### 1. Create your pages structure

```
src/pages/
├── index.tsx          # Root page "/"
├── about.tsx          # Route "/about"
└── test/
    ├── layout.tsx     # Layout wrapper for /test/* routes
    ├── index.tsx      # Route "/test"
    └── hello.tsx      # Route "/test/hello"
```

### 2. Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aaexFileRouter } from 'aaex-file-router';

export default defineConfig({
  plugins: [
    react(),
    aaexFileRouter({
      pagesDir: './src/pages', //page files location(optional: default ./src/pages)
      outputFile: './src/routes.ts', //generated routes (default: ./src/routes.ts)
    }),
  ],
});
```

### 3. Use in your app

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import routes from './routes';

const router = createBrowserRouter(routes);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
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
```typescript
// pages/admin/layout.tsx
import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div>
      <nav>Admin Navigation</nav>
      <Outlet /> {/* Nested routes render here */}
    </div>
  );
}
```

### Named files
Any other `.tsx` file becomes a route based on its filename.
```
pages/about.tsx       → "/about"
pages/blog/post.tsx   → "/blog/post"
```

## Generated Routes File

The plugin generates a `routes.ts` file with all your routes:

```typescript
// src/routes.ts
// AUTO GENERATED: DO NOT EDIT
import React from 'react';
import Index from './pages/index.tsx';
import AdminLayout from './pages/admin/layout.tsx';
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = [
  {
    path: '/',
    element: React.createElement(Index),
  },
  {
    path: 'admin',
    element: React.createElement(AdminLayout),
    children: [
      // nested routes...
    ],
  },
];

export default routes;
```

## Route Resolution Examples

| File Structure | Route Path |
|---|---|
| `pages/index.tsx` | `/` |
| `pages/about.tsx` | `/about` |
| `pages/blog/index.tsx` | `/blog` |
| `pages/blog/post.tsx` | `/blog/post` |
| `pages/admin/layout.tsx` + children | `/admin/*` (grouped) |

## Layouts

Layouts wrap their child routes and provide shared UI:

```typescript
// pages/dashboard/layout.tsx
import { Outlet } from 'react-router-dom';

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

All routes in `pages/dashboard/*` will render inside this layout.

## API Reference

### FileScanner
Scans the file system and converts files into a structured format.

```typescript
import { FileScanner } from 'aaex-file-router';

const scanner = new FileScanner('./src/pages');
const fileData = await scanner.get_file_data();
```

### RouteGenerator
Converts file structure into React Router route configuration.

```typescript
import { RouteGenerator } from 'aaex-file-router';

const generator = new RouteGenerator();
const routesCode = await generator.generateComponentsMap(fileData);
```

### aaexFileRouter (Vite Plugin)
Automatically watches for file changes and regenerates routes.

```typescript
import { aaexFileRouter } from 'aaex-file-router';

export default defineConfig({
  plugins: [
    aaexFileRouter({
      pagesDir: './src/pages',
      outputFile: './src/routes.ts',
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
```
pages/
├── layout.tsx         # Wraps entire app
├── index.tsx
└── about.tsx
```

### Nested Layouts
```
pages/
├── layout.tsx                 # Root layout
├── admin/
│   ├── layout.tsx            # Admin layout (inherits from root)
│   ├── index.tsx
│   └── users.tsx
```

### Route Groups Without Layout
```
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
