import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, test, expect, vi, afterEach } from "vitest";
import {
  createGlobalState,
  AppContextProvider,
  AppContextValues,
} from "../index";
import { renderAndHydrate } from "./reactRendering";

// Test context interfaces
interface CookieContext extends AppContextValues {
  cookies: { darkMode?: string };
}

interface ThemeContext extends AppContextValues {
  theme: string;
}

interface DataContext extends AppContextValues {
  data: string;
}

interface UserContext extends AppContextValues {
  user: { id: string; name: string };
}

describe("Orbo - createGlobalState", () => {
  let cleanupFunctions: (() => void)[] = [];

  afterEach(() => {
    // Clean up all test containers
    cleanupFunctions.forEach((cleanup) => cleanup());
    cleanupFunctions = [];
  });

  describe("SSR/Hydration Consistency", () => {
    test("server and client render identical state", async () => {
      const [useDarkMode] = createGlobalState({
        initialState: (context) =>
          (context as CookieContext).cookies.darkMode === "true",
      });

      const TestComponent = () => {
        const darkMode = useDarkMode();
        return <div data-testid="theme">{darkMode ? "dark" : "light"}</div>;
      };

      const app = (
        <AppContextProvider values={{ cookies: { darkMode: "true" } }}>
          <TestComponent />
        </AppContextProvider>
      );

      const { container, ssrHtml, cleanup } = await renderAndHydrate(app);
      cleanupFunctions.push(cleanup);

      expect(ssrHtml).toContain("dark");
      expect(
        container.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("dark");
    });

    test("hydration works with falsy initial state", async () => {
      const [useCounter] = createGlobalState({
        initialState: () => 0,
      });

      const TestComponent = () => {
        const count = useCounter();
        return <div data-testid="count">{count}</div>;
      };

      const app = (
        <AppContextProvider values={{}}>
          <TestComponent />
        </AppContextProvider>
      );

      const { container, ssrHtml, cleanup } = await renderAndHydrate(app);
      cleanupFunctions.push(cleanup);

      expect(ssrHtml).toContain("0");
      expect(
        container.querySelector('[data-testid="count"]'),
      ).toHaveTextContent("0");
    });
  });

  describe("True Lazy Initialization", () => {
    test("unused state never gets initialized", async () => {
      const initSpy = vi.fn();
      createGlobalState({
        initialState: () => {
          initSpy();
          return { expensive: "data" };
        },
      });

      const ComponentNotUsingState = () => <div>No state used</div>;

      const { cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <ComponentNotUsingState />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(initSpy).not.toHaveBeenCalled();
    });

    test("state initializes only when first accessed", async () => {
      const initSpy = vi.fn();
      const [useTestState] = createGlobalState({
        initialState: () => {
          initSpy();
          return "initialized";
        },
      });

      const LazyComponent = ({
        shouldUseState,
      }: {
        shouldUseState: boolean;
      }) => {
        const state = shouldUseState ? useTestState() : null;
        return <div data-testid="content">{state || "not loaded"}</div>;
      };

      // First render without using state
      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <LazyComponent shouldUseState={false} />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(initSpy).not.toHaveBeenCalled();
      expect(
        container.querySelector('[data-testid="content"]'),
      ).toHaveTextContent("not loaded");

      // Re-render with state usage by creating a new render
      const { container: container2, cleanup: cleanup2 } =
        await renderAndHydrate(
          <AppContextProvider values={{}}>
            <LazyComponent shouldUseState={true} />
          </AppContextProvider>,
        );
      cleanupFunctions.push(cleanup2);

      expect(initSpy).toHaveBeenCalledOnce();
      expect(
        container2.querySelector('[data-testid="content"]'),
      ).toHaveTextContent("initialized");
    });
  });

  describe("State Sharing & Isolation", () => {
    test("multiple components share same state instance and object references", async () => {
      const [useCounter, useSetCounter] = createGlobalState({
        initialState: () => 0,
      });
      const [useUser] = createGlobalState({
        initialState: () => ({
          id: "123",
          name: "John",
          preferences: { theme: "dark" },
        }),
      });

      let userRefA: {
        id: string;
        name: string;
        preferences: { theme: string };
      } | null = null;
      let userRefB: {
        id: string;
        name: string;
        preferences: { theme: string };
      } | null = null;

      const ComponentA = () => {
        const count = useCounter();
        const setCount = useSetCounter();
        userRefA = useUser();
        return (
          <>
            <button data-testid="button-a" onClick={() => setCount(count + 1)}>
              A: {count}
            </button>
            <div data-testid="user-a">{userRefA.name}</div>
          </>
        );
      };

      const ComponentB = () => {
        const count = useCounter();
        userRefB = useUser();
        return (
          <>
            <div data-testid="count-b">B: {count}</div>
            <div data-testid="user-b">{userRefB.id}</div>
          </>
        );
      };

      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <ComponentA />
          <ComponentB />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      // Test state sharing
      fireEvent.click(container.querySelector('[data-testid="button-a"]')!);
      expect(
        container.querySelector('[data-testid="count-b"]'),
      ).toHaveTextContent("B: 1");

      // Test object reference sharing
      expect(
        container.querySelector('[data-testid="user-a"]'),
      ).toHaveTextContent("John");
      expect(
        container.querySelector('[data-testid="user-b"]'),
      ).toHaveTextContent("123");
      expect(userRefA).toBe(userRefB);
      expect(userRefA!.preferences).toBe(userRefB!.preferences);
    });

    test("different AppContextProvider instances in same render are isolated", () => {
      const [useTheme] = createGlobalState({
        initialState: (context) => (context as ThemeContext).theme,
      });

      const ThemeDisplay = () => {
        const theme = useTheme();
        return <div data-testid="theme">{theme}</div>;
      };

      const { container } = render(
        <div>
          <AppContextProvider values={{ theme: "dark" }}>
            <ThemeDisplay />
          </AppContextProvider>
          <AppContextProvider values={{ theme: "light" }}>
            <ThemeDisplay />
          </AppContextProvider>
        </div>,
      );

      const themes = container.querySelectorAll('[data-testid="theme"]');
      expect(themes[0]).toHaveTextContent("dark");
      expect(themes[1]).toHaveTextContent("light");
    });
  });

  describe("Performance: No Unnecessary Re-renders", () => {
    test("components using different state don't interfere with each other", async () => {
      const [useStateA, useSetStateA] = createGlobalState({
        initialState: () => "A",
      });
      const [useStateB] = createGlobalState({
        initialState: () => "B",
      });

      const ComponentA = () => {
        const stateA = useStateA();
        const setStateA = useSetStateA();
        return (
          <button data-testid="button-a" onClick={() => setStateA("A-updated")}>
            {stateA}
          </button>
        );
      };

      const ComponentB = () => {
        const stateB = useStateB();
        return <div data-testid="state-b">{stateB}</div>;
      };

      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <ComponentA />
          <ComponentB />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(
        container.querySelector('[data-testid="button-a"]'),
      ).toHaveTextContent("A");
      expect(
        container.querySelector('[data-testid="state-b"]'),
      ).toHaveTextContent("B");

      fireEvent.click(container.querySelector('[data-testid="button-a"]')!);

      expect(
        container.querySelector('[data-testid="button-a"]'),
      ).toHaveTextContent("A-updated");
      expect(
        container.querySelector('[data-testid="state-b"]'),
      ).toHaveTextContent("B");
    });

    test("functional state updates work correctly", async () => {
      const [useCounter, useSetCounter] = createGlobalState({
        initialState: () => 0,
      });

      const Counter = () => {
        const count = useCounter();
        const setCount = useSetCounter();
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button
              data-testid="increment"
              onClick={() => setCount((prev) => prev + 1)}
            >
              Increment
            </button>
          </div>
        );
      };

      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <Counter />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      const button = container.querySelector('[data-testid="increment"]')!;
      const countDisplay = container.querySelector('[data-testid="count"]')!;

      expect(countDisplay).toHaveTextContent("0");

      fireEvent.click(button);
      expect(countDisplay).toHaveTextContent("1");

      fireEvent.click(button);
      expect(countDisplay).toHaveTextContent("2");
    });
  });

  describe("Cleanup Behavior", () => {
    test("cleanup removes unused state when enabled", async () => {
      const initSpy = vi.fn();
      const [useCounter, useSetCounter] = createGlobalState({
        initialState: () => {
          initSpy();
          return 0;
        },
        cleanupOnUnmount: true,
      });

      const SecondComponent = () => {
        const counter = useCounter();
        const setCounter = useSetCounter();
        return (
          <div>
            <div data-testid="counter">{counter}</div>
            <button
              data-testid="increment"
              onClick={() => setCounter(counter + 1)}
            >
              Increment
            </button>
          </div>
        );
      };

      const ParentComponent = () => {
        const [showSecond, setShowSecond] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle"
              onClick={() => setShowSecond(!showSecond)}
            >
              Toggle Second Component
            </button>
            {showSecond && <SecondComponent />}
          </div>
        );
      };

      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <ParentComponent />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      // Initial state: counter should be 0, initialization called once
      expect(initSpy).toHaveBeenCalledOnce();
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");

      // First interaction: increment counter (0 → 1)
      fireEvent.click(container.querySelector('[data-testid="increment"]')!);
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("1");

      // Second interaction: unmount second component
      fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      expect(container.querySelector('[data-testid="counter"]')).toBeNull();

      // Third interaction: remount second component
      fireEvent.click(container.querySelector('[data-testid="toggle"]')!);

      // Verification: state should be reset to 0 (initialization called 3 times:
      // 1. SSR render, 2. Client hydration, 3. After cleanup and remount)
      expect(initSpy).toHaveBeenCalledTimes(3);
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");
    });

    test("cleanup is disabled by default", async () => {
      const [useCounter, useSetCounter] = createGlobalState({
        initialState: () => 0,
      });

      const SecondComponent = () => {
        const counter = useCounter();
        const setCounter = useSetCounter();
        return (
          <div>
            <div data-testid="counter">{counter}</div>
            <button
              data-testid="increment"
              onClick={() => setCounter(counter + 1)}
            >
              Increment
            </button>
          </div>
        );
      };

      const ParentComponent = () => {
        const [showSecond, setShowSecond] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle"
              onClick={() => setShowSecond(!showSecond)}
            >
              Toggle Second Component
            </button>
            {showSecond && <SecondComponent />}
          </div>
        );
      };

      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{}}>
          <ParentComponent />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      // Initial state: counter should be 0
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");

      // First interaction: increment counter (0 → 1)
      fireEvent.click(container.querySelector('[data-testid="increment"]')!);
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("1");

      // Second interaction: unmount second component
      fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      expect(container.querySelector('[data-testid="counter"]')).toBeNull();

      // Third interaction: remount second component
      fireEvent.click(container.querySelector('[data-testid="toggle"]')!);

      // Verification: state should still be 1 (not reverted to initial 0)
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("1");
    });
  });

  describe("Error Boundaries Integration", () => {
    test("state initialization errors are caught by error boundaries during hydration", async () => {
      const [useBrokenState] = createGlobalState({
        initialState: () => {
          throw new Error("Initialization failed");
        },
      });

      const BrokenComponent = () => {
        const state = useBrokenState();
        return <div data-testid="state">{state}</div>;
      };

      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        state = { hasError: false };
        static getDerivedStateFromError() {
          return { hasError: true };
        }
        render() {
          return this.state.hasError ? (
            <div data-testid="error">Error caught</div>
          ) : (
            this.props.children
          );
        }
      }

      // Test that error during SSR fails gracefully and we can catch it
      try {
        await renderAndHydrate(
          <AppContextProvider values={{}}>
            <ErrorBoundary>
              <BrokenComponent />
            </ErrorBoundary>
          </AppContextProvider>,
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Initialization failed");
      }
    });
  });

  describe("Advanced Integration Patterns", () => {
    test("state initializes once per context instance", async () => {
      const expensiveComputationSpy = vi.fn();

      const [useExpensiveState] = createGlobalState({
        initialState: (context) => {
          expensiveComputationSpy();
          return `processed-${(context as DataContext).data}`;
        },
      });

      const TestComponent = () => {
        const state = useExpensiveState();
        return <div data-testid="result">{state}</div>;
      };

      const contextValues = { data: "test" };

      // First render
      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={contextValues}>
          <TestComponent />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(expensiveComputationSpy).toHaveBeenCalledOnce();
      expect(
        container.querySelector('[data-testid="result"]'),
      ).toHaveTextContent("processed-test");

      // Second render with different context values - should initialize again
      const { container: container2, cleanup: cleanup2 } =
        await renderAndHydrate(
          <AppContextProvider values={{ data: "different" }}>
            <TestComponent />
          </AppContextProvider>,
        );
      cleanupFunctions.push(cleanup2);

      // Should have been called twice (once for each context instance)
      expect(expensiveComputationSpy).toHaveBeenCalledTimes(2);
      expect(
        container2.querySelector('[data-testid="result"]'),
      ).toHaveTextContent("processed-different");
    });

    test("complex nested state sharing", async () => {
      const [useUser] = createGlobalState({
        initialState: (context) => (context as UserContext).user,
      });

      const [useUserPrefs, useSetUserPrefs] = createGlobalState({
        initialState: () => ({ theme: "light", lang: "en" }),
      });

      const UserProfile = () => {
        const user = useUser();
        return <div data-testid="user-name">{user.name}</div>;
      };

      const UserSettings = () => {
        const prefs = useUserPrefs();
        const setPrefs = useSetUserPrefs();
        return (
          <div>
            <div data-testid="theme">{prefs.theme}</div>
            <button
              data-testid="toggle-theme"
              onClick={() =>
                setPrefs((prev) => ({
                  ...prev,
                  theme: prev.theme === "light" ? "dark" : "light",
                }))
              }
            >
              Toggle
            </button>
          </div>
        );
      };

      const { container, cleanup } = await renderAndHydrate(
        <AppContextProvider values={{ user: { id: "1", name: "John" } }}>
          <UserProfile />
          <UserSettings />
        </AppContextProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(
        container.querySelector('[data-testid="user-name"]'),
      ).toHaveTextContent("John");
      expect(
        container.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("light");

      fireEvent.click(container.querySelector('[data-testid="toggle-theme"]')!);

      expect(
        container.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("dark");
    });
  });

  describe("Context Instance Isolation", () => {
    test("different context instances maintain separate state", () => {
      const [useTheme] = createGlobalState({
        initialState: (context) => (context as ThemeContext).theme,
      });

      const TestComponent = () => {
        const theme = useTheme();
        return <div data-testid="theme">{theme}</div>;
      };

      // First context instance
      const { container: container1 } = render(
        <AppContextProvider values={{ theme: "dark" }}>
          <TestComponent />
        </AppContextProvider>,
      );

      // Second context instance
      const { container: container2 } = render(
        <AppContextProvider values={{ theme: "light" }}>
          <TestComponent />
        </AppContextProvider>,
      );

      expect(
        container1.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("dark");
      expect(
        container2.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("light");
    });
  });
});
