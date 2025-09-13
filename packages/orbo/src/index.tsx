import { createContext, use, useCallback, useEffect, useState } from "react";

/**
 * Base interface for context values passed to `AppContextProvider`.
 *
 * **Type Safety:** Extend this interface using module augmentation for compile-time safety:
 *
 * ```typescript
 * declare module 'orbo' {
 *   interface AppContextValues {
 *     cookies: { darkMode?: string };
 *     user: { id: string; name: string } | null;
 *   }
 * }
 * ```
 */
export interface AppContextValues {}

interface GlobalStateConfig<T = unknown> {
  /** Function that receives context values and returns the initial state */
  initialState: (appContextValues: AppContextValues) => T;
  /**
   * When true, automatically cleans up global state when no components are using it
   * anymore
   *
   * - **false (default)**: State persists across component mount/unmount cycles
   * - **true**: State is reset to initial value when all consuming components unmount
   *
   * Use cleanup when you want fresh state for each component lifecycle,
   * or to prevent memory leaks with large state objects.
   */
  cleanupOnUnmount?: boolean;
}

interface AppContextData {
  values: AppContextValues;
  /** Internal state management */
  subContexts: Map<
    GlobalStateConfig,
    {
      value: any;
      listeners: Set<(newState: any) => any>;
      subscribe: (setter: (prev: any) => any) => () => void;
      updateState: (newState: any) => void;
    }
  >;
}

const AppContext = createContext<AppContextData | undefined>(undefined);

/**
 * Root provider that enables global state management for child components.
 *
 * @param values Context values passed to `initialState` functions
 * @param children React components that can use global state
 *
 * @example
 * ```tsx
 * function App({ cookies, user }) {
 *   return (
 *     <AppContextProvider values={{ cookies, user }}>
 *       <MyComponents />
 *     </AppContextProvider>
 *   );
 * }
 * ```
 */
export function AppContextProvider({
  values,
  children,
}: {
  values: AppContextValues;
  children: React.ReactNode;
}) {
  const [contextData] = useState(
    () =>
      ({
        values,
        subContexts: new Map(),
      }) satisfies AppContextData,
  );
  return (
    <AppContext.Provider value={contextData}>{children}</AppContext.Provider>
  );
}

/**
 * Creates a pair of hooks for managing global state that is shared across components.
 *
 * @param config Configuration object with `initialState` function and optional `cleanupOnUnmount`
 * @returns A tuple `[useValue, useSetValue]` - hooks for reading and updating the global state
 *
 * @example
 * ```tsx
 * const [useCount, useSetCount] = createGlobalState({
 *   initialState: () => 0
 * });
 *
 * function Counter() {
 *   const count = useCount();
 *   const setCount = useSetCount();
 *   return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
 * }
 * ```
 *
 * **Key Features:**
 * - ⚡ **Lazy initialization** - state only initializes when first component uses it
 * - 🔗 **Automatic sharing** - all components using the same state share exact object references
 * - 🔒 **SSR safe** - no hydration mismatches, works with server-side rendering
 * - 🏝️ **Context isolated** - each `AppContextProvider` maintains separate state instances
 */
export function createGlobalState<T>(config: GlobalStateConfig<T>) {
  // Create a unique key for this global state instance
  const stateKey = config;
  // Create a new subcontext
  function initializeSubContext(appContext: AppContextData) {
    let subContext = appContext.subContexts.get(stateKey);
    if (!subContext) {
      const listeners = new Set<(newState: any) => any>();
      subContext = {
        value: config.initialState(appContext.values),
        listeners,
        subscribe: (setter: (prev: T) => T) => {
          listeners.add(setter);
          return () => {
            listeners.delete(setter);
            if (listeners.size === 0 && config.cleanupOnUnmount) {
              appContext.subContexts.delete(stateKey);
            }
          };
        },
        updateState: (newState: T) =>
          listeners.forEach((setter) => setter(newState)),
      };
      appContext.subContexts.set(stateKey, subContext);
    }
    return subContext;
  }
  return [
    // Read from global state
    function useGlobalState(): T {
      const appContext = use(AppContext)!;
      // Initialize state only once using the cache
      const [state, setState] = useState<T>(
        () => initializeSubContext(appContext).value,
      );
      useEffect(
        () => initializeSubContext(appContext).subscribe(setState),
        [appContext],
      );
      return state;
    },
    // Write to global state
    function useSetGlobalState(): (newState: T | ((prev: T) => T)) => void {
      const appContext = use(AppContext)!;
      useEffect(
        () => initializeSubContext(appContext).subscribe(() => {}),
        [appContext],
      );
      return useCallback(
        (newState: T | ((prev: T) => T)) => {
          const subContext = initializeSubContext(appContext);
          const nextState =
            typeof newState === "function"
              ? (newState as (prev: T) => T)(subContext.value)
              : newState;
          subContext.value = nextState;
          subContext.updateState(nextState);
        },
        [appContext],
      );
    },
  ] as const;
}

const globalStateMemoCache = new WeakMap<
  Function,
  WeakMap<AppContextValues, unknown>
>();
/**
 * Memoizes expensive computations based on context values using WeakMap caching
 *
 * This allows sharing functionality for multiple initializations
 *
 * @param factory Function that computes a value from context values
 * @returns Memoized function that caches results per context object reference
 *
 * @example
 * ```tsx
 * const computeUserPrefs = globalStateMemo((context: { user: User }) =>
 *   processExpensiveUserData(context.user)
 * );
 *
 * const [useUserPrefs] = createGlobalState({
 *   initialState(context): computeUserPrefs(context)
 * });
 * ```
 *
 * **Benefits:**
 * - 🚀 **Performance** - caches expensive computations per context object
 * - 🧹 **Memory safe** - WeakMap allows garbage collection of unused contexts
 * - 🔄 **Cache sharing** - same factory function shares cache across multiple uses
 */
export const globalStateMemo = <T,>(
  factory: (values: AppContextValues) => T,
): ((values: AppContextValues) => T) => {
  let contextCaches = globalStateMemoCache.get(factory);
  if (!contextCaches) {
    contextCaches = new WeakMap();
    globalStateMemoCache.set(factory, contextCaches);
  }
  return (values: AppContextValues): T => {
    if (!contextCaches.has(values)) {
      contextCaches.set(values, factory(values));
    }
    return contextCaches.get(values) as T;
  };
};
