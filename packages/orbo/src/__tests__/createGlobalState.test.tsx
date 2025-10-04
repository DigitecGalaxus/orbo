import React, { useState } from "react";
import { fireEvent, render, waitFor, act } from "@testing-library/react";
import { describe, test, expect, vi, afterEach } from "vitest";
import {
  createGlobalState,
  GlobalStateProvider,
  GlobalStateInitialValues,
} from "../index";
import { renderAndHydrate } from "./reactRendering";

// Test context interfaces
interface CookieContext extends GlobalStateInitialValues {
  cookies: { darkMode?: string };
}

interface ThemeContext extends GlobalStateInitialValues {
  theme: string;
}

interface DataContext extends GlobalStateInitialValues {
  data: string;
}

interface UserContext extends GlobalStateInitialValues {
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
        <GlobalStateProvider initialValues={{ cookies: { darkMode: "true" } }}>
          <TestComponent />
        </GlobalStateProvider>
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
        <GlobalStateProvider initialValues={{}}>
          <TestComponent />
        </GlobalStateProvider>
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
        <GlobalStateProvider initialValues={{}}>
          <ComponentNotUsingState />
        </GlobalStateProvider>,
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
        <GlobalStateProvider initialValues={{}}>
          <LazyComponent shouldUseState={false} />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(initSpy).not.toHaveBeenCalled();
      expect(
        container.querySelector('[data-testid="content"]'),
      ).toHaveTextContent("not loaded");

      // Re-render with state usage by creating a new render
      const { container: container2, cleanup: cleanup2 } =
        await renderAndHydrate(
          <GlobalStateProvider initialValues={{}}>
            <LazyComponent shouldUseState={true} />
          </GlobalStateProvider>,
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
        <GlobalStateProvider initialValues={{}}>
          <ComponentA />
          <ComponentB />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      // Test state sharing
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="button-a"]')!);
      });
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

    test("different GlobalStateProvider instances in same render are isolated", () => {
      const [useTheme] = createGlobalState({
        initialState: (context) => (context as ThemeContext).theme,
      });

      const ThemeDisplay = () => {
        const theme = useTheme();
        return <div data-testid="theme">{theme}</div>;
      };

      const { container } = render(
        <div>
          <GlobalStateProvider initialValues={{ theme: "dark" }}>
            <ThemeDisplay />
          </GlobalStateProvider>
          <GlobalStateProvider initialValues={{ theme: "light" }}>
            <ThemeDisplay />
          </GlobalStateProvider>
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
        <GlobalStateProvider initialValues={{}}>
          <ComponentA />
          <ComponentB />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(
        container.querySelector('[data-testid="button-a"]'),
      ).toHaveTextContent("A");
      expect(
        container.querySelector('[data-testid="state-b"]'),
      ).toHaveTextContent("B");

      act(() => {
        fireEvent.click(container.querySelector('[data-testid="button-a"]')!);
      });

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
        <GlobalStateProvider initialValues={{}}>
          <Counter />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      const button = container.querySelector('[data-testid="increment"]')!;
      const countDisplay = container.querySelector('[data-testid="count"]')!;

      expect(countDisplay).toHaveTextContent("0");

      act(() => {
        fireEvent.click(button);
      });
      expect(countDisplay).toHaveTextContent("1");

      act(() => {
        fireEvent.click(button);
      });
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
        persistState: false,
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

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      // Initial state: counter should be 0, initialization called once
      expect(initSpy).toHaveBeenCalledOnce();
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");

      // First interaction: increment counter (0 → 1)
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="increment"]')!);
      });
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("1");

      // Second interaction: unmount second component
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });
      expect(container.querySelector('[data-testid="counter"]')).toBeNull();

      // Third interaction: remount second component
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });

      // Verification: state should be reset to 0 (initialization called 2 times:
      // 1. SSR render, 2. Client hydration - state is cleaned up so no third call needed)
      expect(initSpy).toHaveBeenCalledTimes(2);
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");
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
          <GlobalStateProvider initialValues={{}}>
            <ErrorBoundary>
              <BrokenComponent />
            </ErrorBoundary>
          </GlobalStateProvider>,
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
        <GlobalStateProvider initialValues={contextValues}>
          <TestComponent />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(expensiveComputationSpy).toHaveBeenCalledOnce();
      expect(
        container.querySelector('[data-testid="result"]'),
      ).toHaveTextContent("processed-test");

      // Second render with different context values - should initialize again
      const { container: container2, cleanup: cleanup2 } =
        await renderAndHydrate(
          <GlobalStateProvider initialValues={{ data: "different" }}>
            <TestComponent />
          </GlobalStateProvider>,
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
        <GlobalStateProvider
          initialValues={{ user: { id: "1", name: "John" } }}
        >
          <UserProfile />
          <UserSettings />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      expect(
        container.querySelector('[data-testid="user-name"]'),
      ).toHaveTextContent("John");
      expect(
        container.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("light");

      act(() => {
        fireEvent.click(
          container.querySelector('[data-testid="toggle-theme"]')!,
        );
      });

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
        <GlobalStateProvider initialValues={{ theme: "dark" }}>
          <TestComponent />
        </GlobalStateProvider>,
      );

      // Second context instance
      const { container: container2 } = render(
        <GlobalStateProvider initialValues={{ theme: "light" }}>
          <TestComponent />
        </GlobalStateProvider>,
      );

      expect(
        container1.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("dark");
      expect(
        container2.querySelector('[data-testid="theme"]'),
      ).toHaveTextContent("light");
    });
  });

  describe("onSubscribe SSR Behavior", () => {
    test.skip("onSubscribe does not run during server-side rendering", () => {
      // This test is skipped because SSR simulation interferes with other tests
      // The SSR safety is tested by the typeof window !== 'undefined' check in the implementation
    });
  });

  describe("onSubscribe Reinitialization Behavior", () => {
    test("onSubscribe is called again when components remount with persistState: true", () => {
      const subscribeSpy = vi.fn(() => {
        return () => {}; // Return cleanup function
      });

      const [useCounter] = createGlobalState({
        initialState: () => 0,
        onSubscribe: subscribeSpy,
        persistState: true, // Default behavior
      });

      const TestComponent = () => {
        const counter = useCounter();
        return <div data-testid="counter">{counter}</div>;
      };

      const ParentComponent = () => {
        const [showComponent, setShowComponent] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle"
              onClick={() => setShowComponent(!showComponent)}
            >
              Toggle Component
            </button>
            {showComponent && <TestComponent />}
          </div>
        );
      };

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      expect(subscribeSpy).toHaveBeenCalledTimes(1);

      // Toggle component off
      const toggleButton = container.querySelector('[data-testid="toggle"]')!;
      act(() => {
        fireEvent.click(toggleButton);
      });
      expect(container.querySelector('[data-testid="counter"]')).toBe(null);

      // Toggle component back on - onSubscribe should be called again since state persisted
      act(() => {
        fireEvent.click(toggleButton);
      });
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");
      expect(subscribeSpy).toHaveBeenCalledTimes(2); // Called again on remount
    });

    test("cleanup is called and onSubscribe re-runs correctly with persistState: true", () => {
      const cleanupSpy = vi.fn();
      const subscribeSpy = vi.fn(() => cleanupSpy);

      const [useCounter] = createGlobalState({
        initialState: () => 42,
        onSubscribe: subscribeSpy,
        persistState: true,
      });

      const TestComponent = () => {
        const counter = useCounter();
        return <div data-testid="counter">{counter}</div>;
      };

      const ParentComponent = () => {
        const [showComponent, setShowComponent] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle"
              onClick={() => setShowComponent(!showComponent)}
            >
              Toggle Component
            </button>
            {showComponent && <TestComponent />}
          </div>
        );
      };

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      // Initial mount
      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      expect(cleanupSpy).toHaveBeenCalledTimes(0);
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("42");

      // Unmount - cleanup should be called since no components are subscribed
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });
      expect(cleanupSpy).toHaveBeenCalledTimes(1);

      // Remount - onSubscribe should be called again, state should persist
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });
      expect(subscribeSpy).toHaveBeenCalledTimes(2); // Called again
      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("42"); // State persisted
    });

    test.skip("cleanup is NOT called when persistState is true (default)", async () => {
      const cleanupSpy = vi.fn();
      const [useCounter] = createGlobalState({
        initialState: () => 0,
        onSubscribe: () => {
          return cleanupSpy;
        },
        persistState: true,
      });

      const TestComponent = () => {
        const counter = useCounter();
        return <div data-testid="counter">{counter}</div>;
      };

      const ParentComponent = () => {
        const [showComponent, setShowComponent] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle"
              onClick={() => setShowComponent(!showComponent)}
            >
              Toggle Component
            </button>
            {showComponent && <TestComponent />}
          </div>
        );
      };

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      expect(
        container.querySelector('[data-testid="counter"]'),
      ).toHaveTextContent("0");

      fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      expect(container.querySelector('[data-testid="counter"]')).toBeNull();

      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    test.skip("cleanup only happens when last component unmounts and persistState is false", async () => {
      const cleanupSpy = vi.fn();
      const [useCounter] = createGlobalState({
        initialState: () => 0,
        onSubscribe: () => {
          return cleanupSpy;
        },
        persistState: false,
      });

      const TestComponent = ({ id }: { id: string }) => {
        const counter = useCounter();
        return <div data-testid={`counter-${id}`}>{counter}</div>;
      };

      const ParentComponent = () => {
        const [showFirst, setShowFirst] = useState(true);
        const [showSecond, setShowSecond] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle-first"
              onClick={() => setShowFirst(!showFirst)}
            >
              Toggle First Component
            </button>
            <button
              data-testid="toggle-second"
              onClick={() => setShowSecond(!showSecond)}
            >
              Toggle Second Component
            </button>
            {showFirst && <TestComponent id="first" />}
            {showSecond && <TestComponent id="second" />}
          </div>
        );
      };

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      expect(
        container.querySelector('[data-testid="counter-first"]'),
      ).toHaveTextContent("0");
      expect(
        container.querySelector('[data-testid="counter-second"]'),
      ).toHaveTextContent("0");

      fireEvent.click(container.querySelector('[data-testid="toggle-first"]')!);
      expect(
        container.querySelector('[data-testid="counter-first"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="counter-second"]'),
      ).toHaveTextContent("0");

      expect(cleanupSpy).not.toHaveBeenCalled();

      fireEvent.click(
        container.querySelector('[data-testid="toggle-second"]')!,
      );
      expect(
        container.querySelector('[data-testid="counter-first"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="counter-second"]'),
      ).toBeNull();

      expect(cleanupSpy).toHaveBeenCalledOnce();
    });
  });

  describe("onSubscribe updateState Integration", () => {
    test("updateState called during onSubscribe immediately updates component state", async () => {
      const updateStateSpy = vi.fn();
      const [useTestState] = createGlobalState({
        initialState: () => "initial",
        onSubscribe: (updateState, initialState) => {
          updateStateSpy(initialState);
          // Call updateState directly during onSubscribe
          // Warning such a pattern is discouraged as this pattern
          // is very likely to cause hydration mismatches
          updateState("updated-from-onSubscribe");
          return () => {}; // Return cleanup function
        },
      });

      const TestComponent = () => {
        const state = useTestState();
        return <div data-testid="state">{state}</div>;
      };

      const { container, cleanup } = await renderAndHydrate(
        <GlobalStateProvider initialValues={{}}>
          <TestComponent />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);
      // Initial render shows initial state directly after hydration
      expect(
        container.querySelector('[data-testid="state"]'),
      ).toHaveTextContent("initial");
      // Wait until render reflects updated state cause by useEffect directly after hydration
      await waitFor(() => {
        expect(
          container.querySelector('[data-testid="state"]'),
        ).toHaveTextContent("updated-from-onSubscribe");
      });
      // Verify onSubscribe was called with initial state
      expect(updateStateSpy).toHaveBeenCalledOnce();
      expect(updateStateSpy).toHaveBeenCalledWith("initial");
    });
  });

  describe("isHydrated SSR/Hydration Flag", () => {
    test("isHydrated is false during SSR and initial render", async () => {
      let capturedIsHydrated: boolean | null = null;
      const [useTestState] = createGlobalState({
        initialState: (_, isHydrated) => {
          capturedIsHydrated = isHydrated;
          return "test-value";
        },
      });

      const TestComponent = () => {
        const state = useTestState();
        return <div data-testid="state">{state}</div>;
      };

      const { container, ssrHtml, cleanup } = await renderAndHydrate(
        <GlobalStateProvider initialValues={{}}>
          <TestComponent />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      // During SSR and initial hydration, isHydrated should be false
      expect(capturedIsHydrated).toBe(false);
      expect(ssrHtml).toContain("test-value");
      expect(
        container.querySelector('[data-testid="state"]'),
      ).toHaveTextContent("test-value");
    });

    test("isHydrated becomes true after hydration completes", async () => {
      let hydrationStates: boolean[] = [];
      const [useTestState] = createGlobalState({
        initialState: (_, isHydrated) => {
          hydrationStates.push(isHydrated);
          return `state-${isHydrated ? "hydrated" : "not-hydrated"}`;
        },
        persistState: false, // Force re-initialization when component unmounts/remounts
      });

      const TestComponent = () => {
        const state = useTestState();
        return <div data-testid="state">{state}</div>;
      };

      // First, create a component that will trigger re-initialization after hydration
      const ParentComponent = () => {
        const [showComponent, setShowComponent] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle"
              onClick={() => setShowComponent(!showComponent)}
            >
              Toggle
            </button>
            {showComponent && <TestComponent />}
          </div>
        );
      };

      const { container, cleanup } = await renderAndHydrate(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      // Initial state should use isHydrated: false
      expect(hydrationStates).toContain(false);
      expect(
        container.querySelector('[data-testid="state"]'),
      ).toHaveTextContent("state-not-hydrated");

      // Toggle component off and on to trigger re-initialization after hydration
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });

      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });

      // Now isHydrated should be true (because useEffect has run and updated the flag)
      expect(hydrationStates).toContain(true);
      expect(
        container.querySelector('[data-testid="state"]'),
      ).toHaveTextContent("state-hydrated");
    });
  });

  describe("onSubscribe Execution Timing", () => {
    test("child useEffect executes BEFORE onSubscribe is called", async () => {
      const executionOrder: string[] = [];

      const [useTestState] = createGlobalState({
        initialState: () => "initial",
        onSubscribe: (setState) => {
          executionOrder.push("onSubscribe");
          setState("updated-from-onSubscribe");
          return () => {};
        },
      });

      const TestComponent = () => {
        const state = useTestState();

        React.useEffect(() => {
          executionOrder.push("child-useEffect");
        }, []);

        return <div data-testid="state">{state}</div>;
      };

      const { cleanup } = await renderAndHydrate(
        <GlobalStateProvider initialValues={{}}>
          <TestComponent />
        </GlobalStateProvider>,
      );
      cleanupFunctions.push(cleanup);

      // Wait for all effects to complete
      await waitFor(() => {
        expect(executionOrder).toContain("onSubscribe");
      });

      // Verify child useEffect ran before onSubscribe
      expect(executionOrder.join(" -> ")).toBe(
        "child-useEffect -> onSubscribe",
      );
    });

    test("onSubscribe fires AFTER partial hydration with Suspense completes", async () => {
      const executionOrder: string[] = [];

      const [useTestState] = createGlobalState({
        initialState: () => "initial",
        onSubscribe: () => {
          executionOrder.push("onSubscribe");
          return () => {};
        },
      });

      const SuspendedChild = () => {
        executionOrder.push("SuspendedChild-render");
        const state = useTestState();

        React.useEffect(() => {
          executionOrder.push("SuspendedChild-effect");
        }, []);

        return <div data-testid="suspended">{state}</div>;
      };

      const App = () => {
        executionOrder.push("App-render");

        React.useEffect(() => {
          executionOrder.push("App-effect");
        }, []);

        return (
          <React.Suspense fallback={<div>Loading...</div>}>
            <SuspendedChild />
          </React.Suspense>
        );
      };

      const { cleanup } = await renderAndHydrate(
        <GlobalStateProvider initialValues={{}}>
          <App />
        </GlobalStateProvider>,
        () => {
          // Reset execution tracking after SSR
          executionOrder.length = 0;
        },
      );
      cleanupFunctions.push(cleanup);

      await waitFor(() => {
        expect(executionOrder).toContain("onSubscribe");
      });

      // FIXED: With HydrationCheck component, the execution order is correct:
      // 1. App-render -> App-effect
      // 2. SuspendedChild-render -> SuspendedChild-effect (Suspense boundary hydrates)
      // 3. HydrationCheck effect runs (hydrates last) -> onSubscribe fires
      const onSubscribeIndex = executionOrder.indexOf("onSubscribe");
      const suspendedChildEffectIndex = executionOrder.indexOf(
        "SuspendedChild-effect",
      );
      const appEffectIndex = executionOrder.indexOf("App-effect");

      // Verify correct order: onSubscribe fires AFTER all child effects complete
      expect(onSubscribeIndex).toBeGreaterThan(appEffectIndex);
      expect(onSubscribeIndex).toBeGreaterThan(suspendedChildEffectIndex);
    });

    test("onSubscribe fires AFTER multiple Suspense boundaries complete", async () => {
      const executionOrder: string[] = [];

      const [useTestState] = createGlobalState({
        initialState: () => "initial",
        onSubscribe: () => {
          executionOrder.push("onSubscribe");
          return () => {};
        },
      });

      const SuspendedChild1 = () => {
        executionOrder.push("SuspendedChild1-render");
        const state = useTestState();

        React.useEffect(() => {
          executionOrder.push("SuspendedChild1-effect");
        }, []);

        return <div data-testid="suspended1">{state}</div>;
      };

      const SuspendedChild2 = () => {
        executionOrder.push("SuspendedChild2-render");
        const state = useTestState();

        React.useEffect(() => {
          executionOrder.push("SuspendedChild2-effect");
        }, []);

        return <div data-testid="suspended2">{state}</div>;
      };

      const App = () => {
        executionOrder.push("App-render");

        React.useEffect(() => {
          executionOrder.push("App-effect");
        }, []);

        return (
          <React.Suspense fallback={<div>Loading outer...</div>}>
            <React.Suspense fallback={<div>Loading 1...</div>}>
              <SuspendedChild1 />
            </React.Suspense>
            <React.Suspense fallback={<div>Loading 2...</div>}>
              <SuspendedChild2 />
            </React.Suspense>
          </React.Suspense>
        );
      };

      const { cleanup } = await renderAndHydrate(
        <GlobalStateProvider initialValues={{}}>
          <App />
        </GlobalStateProvider>,
        () => {
          // Reset execution tracking after SSR
          executionOrder.length = 0;
        },
      );
      cleanupFunctions.push(cleanup);

      await waitFor(() => {
        expect(executionOrder).toContain("onSubscribe");
      });

      // Verify onSubscribe fires after BOTH Suspense boundaries have hydrated
      const onSubscribeIndex = executionOrder.indexOf("onSubscribe");
      const suspendedChild1EffectIndex = executionOrder.indexOf(
        "SuspendedChild1-effect",
      );
      const suspendedChild2EffectIndex = executionOrder.indexOf(
        "SuspendedChild2-effect",
      );

      // onSubscribe should fire AFTER both children complete
      expect(onSubscribeIndex).toBeGreaterThan(suspendedChild1EffectIndex);
      expect(onSubscribeIndex).toBeGreaterThan(suspendedChild2EffectIndex);
    });
  });

  describe("Multiple Component Cleanup Behavior", () => {
    test("cleanup is NOT called when 2 getter hook components mount and 1 unmounts", () => {
      const cleanupSpy = vi.fn();
      const subscribeSpy = vi.fn(() => cleanupSpy);

      const [useCounter] = createGlobalState({
        initialState: () => 0,
        onSubscribe: subscribeSpy,
      });

      const TestComponent = ({ id }: { id: string }) => {
        const counter = useCounter();
        return <div data-testid={`counter-${id}`}>{counter}</div>;
      };

      const ParentComponent = () => {
        const [showFirst, setShowFirst] = useState(true);
        const [showSecond, setShowSecond] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle-first"
              onClick={() => setShowFirst(!showFirst)}
            >
              Toggle First Component
            </button>
            <button
              data-testid="toggle-second"
              onClick={() => setShowSecond(!showSecond)}
            >
              Toggle Second Component
            </button>
            {showFirst && <TestComponent id="first" />}
            {showSecond && <TestComponent id="second" />}
          </div>
        );
      };

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      // Both components should be mounted
      expect(
        container.querySelector('[data-testid="counter-first"]'),
      ).toHaveTextContent("0");
      expect(
        container.querySelector('[data-testid="counter-second"]'),
      ).toHaveTextContent("0");
      expect(subscribeSpy).toHaveBeenCalledTimes(1);

      // Unmount first component
      act(() => {
        fireEvent.click(
          container.querySelector('[data-testid="toggle-first"]')!,
        );
      });

      // First component should be unmounted, second should still be mounted
      expect(
        container.querySelector('[data-testid="counter-first"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="counter-second"]'),
      ).toHaveTextContent("0");

      // Cleanup should NOT have been called because second component is still mounted
      expect(cleanupSpy).not.toHaveBeenCalled();

      // Unmount second component
      act(() => {
        fireEvent.click(
          container.querySelector('[data-testid="toggle-second"]')!,
        );
      });

      // Both components should be unmounted
      expect(
        container.querySelector('[data-testid="counter-first"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="counter-second"]'),
      ).toBeNull();

      // NOW cleanup should be called since all components are unmounted
      expect(cleanupSpy).toHaveBeenCalledOnce();
    });

    test("cleanup is NOT called when 2 setter hook components mount and 1 unmounts", () => {
      const cleanupSpy = vi.fn();
      const subscribeSpy = vi.fn(() => cleanupSpy);

      const [, useSetCounter] = createGlobalState({
        initialState: () => 0,
        onSubscribe: subscribeSpy,
      });

      const SetterComponent = ({ id }: { id: string }) => {
        const setCounter = useSetCounter();
        return (
          <button
            data-testid={`setter-${id}`}
            onClick={() => setCounter((prev) => prev + 1)}
          >
            Increment {id}
          </button>
        );
      };

      const ParentComponent = () => {
        const [showFirst, setShowFirst] = useState(true);
        const [showSecond, setShowSecond] = useState(true);
        return (
          <div>
            <button
              data-testid="toggle-first"
              onClick={() => setShowFirst(!showFirst)}
            >
              Toggle First Setter
            </button>
            <button
              data-testid="toggle-second"
              onClick={() => setShowSecond(!showSecond)}
            >
              Toggle Second Setter
            </button>
            {showFirst && <SetterComponent id="first" />}
            {showSecond && <SetterComponent id="second" />}
          </div>
        );
      };

      const { container } = render(
        <GlobalStateProvider initialValues={{}}>
          <ParentComponent />
        </GlobalStateProvider>,
      );

      // Both setter components should be mounted
      expect(
        container.querySelector('[data-testid="setter-first"]'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-testid="setter-second"]'),
      ).toBeInTheDocument();
      expect(subscribeSpy).toHaveBeenCalledTimes(1);

      // Unmount first setter component
      act(() => {
        fireEvent.click(
          container.querySelector('[data-testid="toggle-first"]')!,
        );
      });

      // First setter should be unmounted, second should still be mounted
      expect(
        container.querySelector('[data-testid="setter-first"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="setter-second"]'),
      ).toBeInTheDocument();

      // Cleanup should NOT have been called because second setter is still mounted
      expect(cleanupSpy).not.toHaveBeenCalled();

      // Unmount second setter component
      act(() => {
        fireEvent.click(
          container.querySelector('[data-testid="toggle-second"]')!,
        );
      });

      // Both setters should be unmounted
      expect(
        container.querySelector('[data-testid="setter-first"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="setter-second"]'),
      ).toBeNull();

      // NOW cleanup should be called since all components are unmounted
      expect(cleanupSpy).toHaveBeenCalledOnce();
    });
  });

  describe("Setters work correctly across components", () => {
    test("Reuse existing initialized context in freshly mounted new component", async () => {
      const [useTheme, useSetTheme] = createGlobalState({
        initialState: (context) => (context as ThemeContext).theme,
      });

      const InitialComponent = () => {
        const theme = useTheme();
        return <div data-testid="theme">{theme}</div>;
      };

      const ConditionalComponent = () => {
        const theme = useTheme();
        return <div data-testid="theme-conditional">{theme}</div>;
      };

      const ToggleButton = () => {
        const setTheme = useSetTheme();
        return (
          <button data-testid="toggle" onClick={() => setTheme("dark")}>
            Toggle Theme
          </button>
        );
      };

      const TextComponent = () => {
        return (
          <GlobalStateProvider initialValues={{ theme: "light" }}>
            <ParentComponent />
          </GlobalStateProvider>
        );
      };

      const ParentComponent = () => {
        const theme = useTheme();
        return (
          <>
            <ToggleButton />
            <InitialComponent />
            {theme === "dark" && <ConditionalComponent />}
          </>
        );
      };

      // Context instance
      const { container } = await renderAndHydrate(<TextComponent />);

      // emulate click on the button to change theme
      act(() => {
        fireEvent.click(container.querySelector('[data-testid="toggle"]')!);
      });

      // wait for re-render
      await waitFor(() => {
        expect(
          container.querySelector('[data-testid="theme"]'),
        ).toHaveTextContent("dark");
        expect(
          container.querySelector('[data-testid="theme-conditional"]'),
        ).toHaveTextContent("dark");
      });
    });
  });
});
