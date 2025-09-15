# Orbo

[![npm version](https://img.shields.io/npm/v/orbo)](https://www.npmjs.com/package/orbo)

![Orbo](https://raw.githubusercontent.com/DigitecGalaxus/orbo/refs/heads/main/logo.jpg)


Minimal, lazy-initialized global state for React. Zero nested providers, true bundle splitting, useState-familiar API

## Why Orbo?

React applications inevitably accumulate global state: dark mode, user preferences, feature flags, A/B tests. The traditional solution creates a maintenance nightmare of nested Context providers:

```tsx
<DomainProvider>
  <FeaturesProvider>
    <PreferencesProvider>
      <CartProvider>
        <ModalProvider>
          <YourApp />
```

Every new feature adds another provider, every page loads all state logic regardless of usage, and your `_app.tsx` becomes a dumping ground for cross-team dependencies

Orbo takes a different approach: **What if global state was as easy as useState, automatically lazy initialized, and completely decoupled from your app shell?**

Built from the ground up for modern React applications that demand both performance and developer experience. 140 lines of code. Zero dependencies. TypeScript-first

> [!WARNING]
> Orbo is designed specifically for **singleton global states** (dark mode, user preferences, feature flags, ...) -> It is **not a full state management solution** like Redux or Zustand

## Features

- 🚫 **Zero nested providers** - Single `AppContextProvider` replaces all provider nesting
- 📦 **True bundle splitting** - State code loads only when components that use it render
- ⚡ **useState-familiar API** - `const count = useCount()` and `setCount(5)` - that's it
- 🔒 **SSR safe** - No hydration mismatches, no useEffect hacks
- 🎯 **TypeScript first** - Compile-time safety with module augmentation
- 🪶 **Minimal** - 140 lines, zero dependencies, tree-shakeable

## Installation

```bash
npm install orbo
```

## Quick Start

```tsx
import { createGlobalState, AppContextProvider } from "orbo";

// State definition stays with your component - not in _app.tsx
const [useCount, useSetCount] = createGlobalState({
  initialState: () => 0,
});

function Counter() {
  const count = useCount();
  const setCount = useSetCount();

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

function App() {
  return (
    <AppContextProvider values={{}}>
      <Counter />
    </AppContextProvider>
  );
}
```

That's it. No provider nesting, no complex setup, no `_app.tsx` modifications.

## Real-World Example

Here's how you'd handle a typical dark mode implementation:

```tsx
// useDarkMode.ts - lives with your component, not in _app.tsx
import { createGlobalState } from "orbo";

const [useDarkMode, useSetDarkMode] = createGlobalState({
  initialState: ({ cookies }) => cookies.darkMode === "true",
});

export { useDarkMode, useSetDarkMode };

// DarkModeToggle.tsx
import { useDarkMode, useSetDarkMode } from "./useDarkMode";

export function DarkModeToggle() {
  const isDark = useDarkMode();
  const setDarkMode = useSetDarkMode();

  return (
    <button onClick={() => setDarkMode(!isDark)}>{isDark ? "🌙" : "☀️"}</button>
  );
}

// _app.tsx - clean and minimal
function App({ pageProps, cookies }) {
  return (
    <AppContextProvider values={{ cookies }}>
      <Component {...pageProps} />
    </AppContextProvider>
  );
}
```

In this example the dark mode logic is completely decoupled from your app shell. Components that don't use dark mode never load its code. New developers can understand and modify the feature without touching `_app.tsx`

## TypeScript Support

Orbo provides compile-time safety through module augmentation (same pattern as styled-components):

```typescript
// types.ts
// Import to enable module augmentation
import 'orbo';
declare module "orbo" {
  interface AppContextValues {
    cookies: { darkMode?: string };
    user: { id: string; name: string } | null;
    hostname: string;
  }
}

// Now your initialState functions are fully typed
const [useUser] = createGlobalState({
  initialState: (context) => {
    // context.user <- TypeScript knows this exists and its shape
    // context.invalidProp <- TypeScript error!
    return context.user;
  },
});
```

## Architecture

Orbo's design is based on three key insights:

1. **Lazy Initialization**: State code should only be initialized when the components that use it actually render
2. **Decoupling**: State definitions should live with components, not in central configuration files
3. **Explicit Contracts**: Dependencies should be compile-time safe, not runtime discoveries

This results in:

- Better performance through **automatic code splitting**
- Better maintainability through **colocation**
- Better reliability through **TypeScript contracts**

## API Reference

### `createGlobalState<T>(config)`

Creates a pair of hooks for reading and writing global state.

```tsx
const [useValue, useSetValue] = createGlobalState({
  initialState: (appContext) => computeInitialValue(appContext),
});
```

**Parameters:**

- `config.initialState`: Function that receives app context values and returns the initial state

**Returns:**

- `[useGlobalState, useSetGlobalState]` - React hooks for reading and writing the state

### `AppContextProvider`

Root provider that manages state isolation and provides context values

```tsx
<AppContextProvider values={{ cookies, user }}>{children}</AppContextProvider>
```

**Props:**

- `values`: Object containing context values passed to `initialState` functions
- `children`: React children

## Examples

Check out the `/examples` directory for complete implementations:

- **Dark Mode** - Theme switching with cookie persistence
- **User State** - Authentication state management
- **Feature Flags** - A/B testing and feature toggling

## License

[MIT](LICENSE)
