import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  initialState: (
    globalStateInitialValues: GlobalStateInitialValues,
    isHydrated: boolean,
  ) => T;
  /**
   * Optional client side exclusive function to run after hydration
   *
   * Note: This function is NOT called during server-side rendering
   */
  onHydrate: () => void;
  /**
   * Optional client side exclusive function to synchronize state with external sources
   *
   * Called when the first component subscribes (mounts), and can return a cleanup function
   * that is called when the last component unsubscribes (unmounts)
   *
   * that is called when the last component unsubscribes (unmounts)
   * Note: This function is NOT called during server-side rendering
   */
  onSubscribe?: (
    setState: (newState: T | ((prev: T) => T)) => void,
    initialState: T,
  ) => void | (() => void);
  /**
   * When true, keeps the state value in memory even after all components unmount
   *
   * - **true (default)**: State persists across component mount/unmount cycles
   * - **false**: State is reset to initial value when all consuming components unmount
   *
   * Use persistState: false when you want fresh state for each component lifecycle,
   * or to prevent memory leaks with large state objects.
   */
  persistState?: boolean;
}

interface GlobalStateContextData {
  initialValues: GlobalStateInitialValues;
  /** Internal state management */
  subContexts: Map<GlobalStateConfig<any>, SubContext<any>>;
  /** Flag that is true after the first client-side render */
  isHydrated: boolean;
}

// Internal statement API of Orbo
interface SubContext<T> {
  value: T;
  initialized: boolean;
  listeners: Set<(newState: T) => void>;
  subscribe: (setter: (prev: T) => void) => () => void;
  onHydrate: () => void;
  updateState: (newState: T | ((prev: T) => T)) => void;
  cleanup: void | undefined | (() => void);
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
  const contextData = useRef<GlobalStateContextData>({
    initialValues,
    subContexts: new Map(),
    isHydrated: false,
  });
  useEffect(() => {
    // Mark as hydrated after the first client-side render
    // to distinguish global state initializations during hydration
    // from later state initializations caused by user interactions
    contextData.current.isHydrated = true;
    // Call onHydrate for all subcontexts
    contextData.current.subContexts.forEach((subContext) => {
      subContext.onHydrate();
    });
  }, []);
  return (
    <GlobalStateContext.Provider value={contextData.current}>
      {children}
    </GlobalStateContext.Provider>
  );
}

/**
 * Creates a pair of hooks for managing global state that is shared across components.
 *
 * @param config Configuration object with `initialState` function and optional `onSubscribe` and `persistState`
 * @returns A tuple `[useValue, useSetValue]` - hooks for reading and updating the global state
 *
 * @example
 * ```tsx
 * const [useCount, useSetCount] = createGlobalState({
 *   initialState: () => 0,
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
 * - 🔒 **SSR safe** - no hydration mismatches, `onSubscribe` only runs client-side
 * - 🏝️ **Context isolated** - each `GlobalStateProvider` maintains separate state instances
 * - 🎯 **Clear separation** - `persistState` for memory, `onSubscribe` for external resources
 */
export function createGlobalState<T>(config: GlobalStateConfig<T>) {
  // Create a unique key for this global state instance
  const stateKey = config;
  // Only call onSubscribe on client-side (not during SSR)
  const onSubscribe =
    (typeof window !== "undefined" && config.onSubscribe) || (() => {});
  // Only call onHydrate on client-side (not during SSR)
  const onHydrate =
    (typeof window !== "undefined" && config.onHydrate) || (() => {});
  // Create a new subcontext
  function initializeSubContext(
    globalStateContext: GlobalStateContextData,
  ): SubContext<T> {
    let subContext = globalStateContext.subContexts.get(stateKey);
    if (!subContext) {
      const listeners = new Set<(newState: any) => any>();
      const newSubContext: SubContext<T> = {
        // Helper flag which is set to false after the last subscriber unmounts
        // (needed for persistState: true)
        initialized: true,
        // Calculating the initial state on sub context creation (SSR & client)
        value: config.initialState(
          globalStateContext.initialValues,
          globalStateContext.isHydrated,
        ),
        // Update state has the same shape like React's setState
        // and can be called in onSubscribe or by the global state setter hook
        updateState: (newState: T | ((prev: T) => T)) => {
          newSubContext.value =
            typeof newState === "function"
              ? (newState as (prev: T) => T)(newSubContext.value)
              : newState;
          listeners.forEach((setter) => setter(newSubContext.value));
        },
        // The cleanup function is the return value of onSubscribe
        cleanup: undefined,
        listeners,
        // The internal subscribe function for the orbo hooks factory
        subscribe: (setter: (newState: any) => void) => {
          listeners.add(setter);
          return () => {
            listeners.delete(setter);
            if (listeners.size === 0) {
              // Ensure re-initialization on next subscribe
              newSubContext.initialized = false;
              if (config.persistState === false) {
                globalStateContext.subContexts.delete(stateKey);
              }
              // Always call cleanup when last subscriber unmounts
              newSubContext.cleanup?.();
            }
          };
        },
        onHydrate,
      };
      // Call onSubscribe when the subcontext is created
      // This must happen after newSubContext is fully initialized as it allows
      // calling updateState in onSubscribe
      newSubContext.cleanup = onSubscribe(
        newSubContext.updateState,
        newSubContext.value,
      );
      // Attach the subcontext to the GlobalState provider to ensure separate instances
      // for multiple SSR Requests
      globalStateContext.subContexts.set(
        stateKey,
        newSubContext as SubContext<any>,
      );
      return newSubContext;
    } else if (!subContext.initialized) {
      // Re-initialize once the first component subscribes again
      // This is necessary if persistState is true and the last component unsubscribed
      // as no new subcontext will be created but onSubscribe must be called again
      subContext.cleanup = onSubscribe(
        subContext.updateState,
        subContext.value,
      );
      subContext.initialized = true;
    }
    return subContext;
  }
  return [
    // Read from global state
    function useGlobalState(): T {
      const globalStateContext = use(GlobalStateContext)!;
      // Initialize state only once
      const [state, setState] = useState<T>(
        () => initializeSubContext(globalStateContext).value,
      );
      // Rerender if the global state changes
      useEffect(
        () => initializeSubContext(globalStateContext).subscribe(setState),
        [globalStateContext],
      );
      return state;
    },
    // Write to global state
    function useSetGlobalState(): (newState: T | ((prev: T) => T)) => void {
      const globalStateContext = use(GlobalStateContext)!;
      // This effect prevents a cleanup as long as at least one setter is mounted
      useEffect(
        () =>
          initializeSubContext(globalStateContext).subscribe(() => {
            /* no rerender for the setter */
          }),
        [globalStateContext],
      );
      return useCallback(
        (newState: T | ((prev: T) => T)) => {
          initializeSubContext(globalStateContext).updateState(newState);
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
