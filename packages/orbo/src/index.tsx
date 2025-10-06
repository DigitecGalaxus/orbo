import {
  createContext,
  memo,
  use,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
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

// \!/ All props with a leading underscore are internal and must not be used outside of Orbo \!/
// In the production build these props are renamed to single-letter names for minimal bundle size
// e.g. _initialValues -> a, _subContexts -> b, _isHydrated -> c, etc.

interface GlobalStateContextData {
  _initialValues: GlobalStateInitialValues;
  /** Internal state management */
  _subContexts: Map<GlobalStateConfig<any>, SubContext<any>>;
  /** Flag that is true after the first client-side render */
  _isHydrated: boolean;
}

/** Internal statement API of Orbo */
interface SubContext<T> {
  /** Current state value */
  _value: T;
  /** Keep track if onSubscribe has been called already */
  _initialized: boolean;
  /**
   * Use a Set to store unique listener references
   * Set automatically prevents duplicate function references
   */
  _listeners: Set<(newState: T) => void>;
  _subscribe: (setter: (prev: T) => void) => () => void;
  _updateState: (newState: T | ((prev: T) => T)) => void;
  /** Cleanup function returned by onSubscribe */
  _cleanup: null | void | undefined | (() => void);
  /**
   * Internal helper to call onSubscribe once the first component subscribes
   * it is safe to call this multiple times as it checks the _initialized flag
   */
  _triggerOnSubscribe: () => void;
}

const GlobalStateContext = createContext<GlobalStateContextData | null>(null);
const subscribeToNothing = () => () => {};
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;
const HydrationStateContext = createContext<boolean>(false);

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
export const GlobalStateProvider = memo(
  ({
    initialValues,
    ...props
  }: {
    initialValues: GlobalStateInitialValues;
    children: React.ReactNode;
  }) => {
    const isHydrated = useDeferredValue(
      useSyncExternalStore(
        subscribeToNothing,
        getClientHydrationState,
        getServerHydrationState,
      ),
    );
    const contextData = useRef({
      _initialValues: initialValues,
      _subContexts: new Map(),
      _isHydrated: false,
    }).current;
    useEffect(() => {
      if (isHydrated) {
        contextData._isHydrated = true;
        // Trigger onSubscribe now that hydration is done
        contextData._subContexts.forEach((subContext) =>
          subContext._triggerOnSubscribe(),
        );
      }
    }, [isHydrated]);
    return (
      <GlobalStateContext value={contextData}>
        <HydrationStateContext value={isHydrated}>
          {props.children}
        </HydrationStateContext>
      </GlobalStateContext>
    );
  },
  // Initial value changes should never trigger a rerender
  () => true,
);

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
export const createGlobalState = <T,>(config: GlobalStateConfig<T>) => {
  // Only call onSubscribe on client-side (not during SSR)
  const onSubscribe = config.onSubscribe;
  // Create a new subcontext
  const initializeSubContext = (
    globalStateContext: GlobalStateContextData,
  ): SubContext<T> => {
    const subContextFromCache = globalStateContext._subContexts.get(config);
    const listeners: Set<(newState: any) => any> = new Set();
    const subContext =
      subContextFromCache ||
      ({
        // Helper flag which is set to false after the last subscriber unmounts
        // (needed for persistState: true)
        _initialized: false,
        // Calculating the initial state on sub context creation (SSR & client)
        _value: config.initialState(
          globalStateContext._initialValues,
          globalStateContext._isHydrated,
        ),
        // Update state has the same shape like React's setState
        // and can be called in onSubscribe or by the global state setter hook
        _updateState: (newState: T | ((prev: T) => T)) => {
          subContext._value =
            typeof newState === "function"
              ? (newState as (prev: T) => T)(subContext._value)
              : newState;
          listeners.forEach((setter) => setter(subContext._value));
        },
        // The cleanup function is the return value of onSubscribe
        _cleanup: null,
        // Internal helper to fire onSubscribe once the first component subscribes
        _triggerOnSubscribe: () => {
          // Call it directly if the page is already hydrated otherwise
          // wait for it to be called from useEffect in GlobalStateProvider
          if (globalStateContext._isHydrated && !subContext._initialized) {
            subContext._cleanup = onSubscribe?.(
              subContext._updateState,
              subContext._value,
            );
            subContext._initialized = true;
          }
        },
        // Listeners from all components watching the state value of this subcontext
        _listeners: listeners,
        // The internal subscribe function for the orbo hooks factory
        _subscribe: (setter: (newState: any) => void) => {
          listeners.add(setter);
          return () => {
            listeners.delete(setter);
            // Cleanup after the last listener unsubscribes
            if (!listeners.size) {
              // Ensure re-initialization on next subscribe
              subContext._initialized = false;
              if (config.persistState === false) {
                globalStateContext._subContexts.delete(config);
              }
              subContext._cleanup?.();
            }
          };
        },
      } satisfies SubContext<T>);

    // Attach the subcontext to the GlobalState provider to ensure separate instances
    // for multiple SSR Requests
    if (!subContextFromCache) {
      globalStateContext._subContexts.set(
        config,
        subContext as SubContext<any>,
      );
    }

    // (Re-)initialize once the first component subscribes
    subContext._triggerOnSubscribe();
    return subContext as SubContext<T>;
  };
  return [
    // Read from global state
    (): T => {
      const globalStateContext = use(GlobalStateContext)!;
      // Initialize state only once
      const [state, setState] = useState<T>(
        () => initializeSubContext(globalStateContext)._value,
      );
      // Rerender if the global state changes
      useEffect(
        () => initializeSubContext(globalStateContext)._subscribe(setState),
        [],
      );
      return state;
    },
    // Write to global state
    (): ((newState: T | ((prev: T) => T)) => void) => {
      const globalStateContext = use(GlobalStateContext)!;
      // This effect prevents a cleanup as long as at least one setter is mounted
      useEffect(
        () =>
          initializeSubContext(globalStateContext)._subscribe(() => {
            /* no rerender for the setter */
          }),
        [],
      );
      return useCallback((newState: T | ((prev: T) => T)) => {
        initializeSubContext(globalStateContext)._updateState(newState);
      }, []);
    },
  ] as const;
};

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

/** Hook to access the initial values passed to the nearest GlobalStateProvider */
export const useInitialValues = (): Readonly<GlobalStateInitialValues> => use(GlobalStateContext)!._initialValues;