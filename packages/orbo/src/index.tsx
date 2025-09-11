import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
} from "react";

export interface AppContextValues {
  // This interface can be module-augmented by users to provide type safety
  // Example:
  // declare module 'orbo' {
  //   interface AppContextValues {
  //     cookies: { darkMode?: string }
  //     user: { id: string, name: string }
  //   }
  // }
}

interface GlobalStateConfig<T = unknown> {
  initialState: (appContextValues: AppContextValues) => T;
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
