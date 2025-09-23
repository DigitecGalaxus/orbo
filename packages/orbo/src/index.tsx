import { createContext, use, useCallback, useEffect, useState } from "react";

/**
 * Base interface for initial values passed to `GlobalStateProvider`.
 *
 * **Type Safety:** Extend this interface using module augmentation for compile-time safety:
 *
 * ```typescript
 * declare module 'orbo' {
 *   interface GlobalStateInitialValues {
 *     cookies: { darkMode?: string };
 *     user: { id: string; name: string } | null;
 *   }
 * }
 * ```
 */
export interface GlobalStateInitialValues {}

interface GlobalStateConfig<T = unknown> {
  /** Function that receives the initial values from `GlobalStateProvider` and returns the initial state */
  initialState: (globalStateInitialValues: GlobalStateInitialValues) => T;
  /**
   * Optional function to synchronize state with external sources
   * 
   * Called when the first component mounts, and can return a cleanup function
   * that is called when the last component unmounts (if `cleanupOnUnmount` is true)
   */
  onMount?: (setState: (newState: T) => void, initalState: T) => void | (() => void);
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

interface GlobalStateContextData {
  initialValues: GlobalStateInitialValues;
  /** Internal state management */
  subContexts: Map<
    GlobalStateConfig<any>,
    {
      value: any;
      listeners: Set<(newState: any) => any>;
      subscribe: (setter: (prev: any) => any) => () => void;
      updateState: (newState: any) => void;
    }
  >;
}

const GlobalStateContext = createContext<GlobalStateContextData | undefined>(
  undefined,
);

/**
 * Root provider that enables global state management for child components.
 *
 * @param initialValues Initial values passed to `initialState` functions
 * @param children React components that can use global state
 *
 * @example
 * ```tsx
 * function App({ cookies, user }) {
 *   return (
 *     <GlobalStateProvider initialValues={{ cookies, user }}>
 *       <MyComponents />
 *     </GlobalStateProvider>
 *   );
 * }
 * ```
 */
export function GlobalStateProvider({
  initialValues,
  children,
}: {
  initialValues: GlobalStateInitialValues;
  children: React.ReactNode;
}) {
  const [contextData] = useState(
    () =>
      ({
        initialValues,
        subContexts: new Map(),
      }) satisfies GlobalStateContextData,
  );
  return (
    <GlobalStateContext.Provider value={contextData}>
      {children}
    </GlobalStateContext.Provider>
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
 * - 🏝️ **Context isolated** - each `GlobalStateProvider` maintains separate state instances
 */
export function createGlobalState<T>(config: GlobalStateConfig<T>) {
  // Create a unique key for this global state instance
  const stateKey = config;
  // Create a new subcontext
  function initializeSubContext(globalStateContext: GlobalStateContextData) {
    let subContext = globalStateContext.subContexts.get(stateKey);
    if (!subContext) {
      const listeners = new Set<(newState: any) => any>();
      const updateState = (newState: T) => {
          if (process.env.NODE_ENV === "development") {
            if (listeners.size === 0) {
              console.warn(
                "[orbo] Warning: Updating global state directly in `onMount`. This is forbidden as it would cause hydration mismatches",
              );
            }
          }
          listeners.forEach((setter) => setter(newState))
      };
      const value = config.initialState(globalStateContext.initialValues);
      const cleanup = config.onMount?.(updateState, value);
      subContext = {
        value,
        listeners,
        subscribe: (setter: (prev: T) => T) => {
          listeners.add(setter);
          return () => {
            listeners.delete(setter);
            if (listeners.size === 0 && config.cleanupOnUnmount) {
              globalStateContext.subContexts.delete(stateKey);
              cleanup?.();
            }
          };
        },
        updateState,
      };
      globalStateContext.subContexts.set(stateKey, subContext);
    }
    return subContext;
  }
  return [
    // Read from global state
    function useGlobalState(): T {
      const globalStateContext = use(GlobalStateContext)!;
      // Initialize state only once using the cache
      const [state, setState] = useState<T>(
        () => initializeSubContext(globalStateContext).value,
      );
      useEffect(
        () => initializeSubContext(globalStateContext).subscribe(setState),
        [globalStateContext],
      );
      return state;
    },
    // Write to global state
    function useSetGlobalState(): (newState: T | ((prev: T) => T)) => void {
      const globalStateContext = use(GlobalStateContext)!;
      useEffect(
        () => initializeSubContext(globalStateContext).subscribe(() => {}),
        [globalStateContext],
      );
      return useCallback(
        (newState: T | ((prev: T) => T)) => {
          const subContext = initializeSubContext(globalStateContext);
          const nextState =
            typeof newState === "function"
              ? (newState as (prev: T) => T)(subContext.value)
              : newState;
          subContext.value = nextState;
          subContext.updateState(nextState);
        },
        [globalStateContext],
      );
    },
  ] as const;
}

const globalStateMemoCache = new WeakMap<
  Function,
  WeakMap<GlobalStateInitialValues, unknown>
>();
/**
 * Memoizes expensive computations based on initial values using WeakMap caching
 *
 * This allows sharing functionality for multiple initializations
 *
 * @param factory Function that computes a value from initial values
 * @returns Memoized function that caches results per initial values object reference
 *
 * @example
 * ```tsx
 * const computeUserPrefs = globalStateMemo((initialValues: { user: User }) =>
 *   processExpensiveUserData(initialValues.user)
 * );
 *
 * const [useUserPrefs] = createGlobalState({
 *   initialState(initialValues): computeUserPrefs(initialValues)
 * });
 * ```
 *
 * **Benefits:**
 * - 🚀 **Performance** - caches expensive computations per initial values object
 * - 🧹 **Memory safe** - WeakMap allows garbage collection of unused initial values
 * - 🔄 **Cache sharing** - same factory function shares cache across multiple uses
 */
export const globalStateMemo = <T,>(
  factory: (initialValues: GlobalStateInitialValues) => T,
): ((initialValues: GlobalStateInitialValues) => T) => {
  let contextCaches = globalStateMemoCache.get(factory);
  if (!contextCaches) {
    contextCaches = new WeakMap();
    globalStateMemoCache.set(factory, contextCaches);
  }
  return (initialValues: GlobalStateInitialValues): T => {
    if (!contextCaches.has(initialValues)) {
      contextCaches.set(initialValues, factory(initialValues));
    }
    return contextCaches.get(initialValues) as T;
  };
};
