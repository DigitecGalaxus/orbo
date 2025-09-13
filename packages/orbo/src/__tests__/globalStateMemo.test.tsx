import { describe, test, expect, vi } from "vitest";
import { globalStateMemo } from "../index";

interface TestContext {
  value: string;
}

interface ExpensiveContext {
  data: string[];
}

describe("Orbo - globalStateMemo", () => {
  describe("WeakMap Caching", () => {
    test("caches results based on context object reference", () => {
      const expensiveComputation = vi.fn(
        (context: TestContext) => `processed-${context.value}`,
      );
      const memoizedFactory = globalStateMemo(expensiveComputation as any);

      const context1 = { value: "test1" };
      const context2 = { value: "test2" };

      // First calls should compute
      const result1a = memoizedFactory(context1);
      const result2a = memoizedFactory(context2);

      expect(expensiveComputation).toHaveBeenCalledTimes(2);
      expect(result1a).toBe("processed-test1");
      expect(result2a).toBe("processed-test2");

      // Second calls with same context objects should use cache
      const result1b = memoizedFactory(context1);
      const result2b = memoizedFactory(context2);

      expect(expensiveComputation).toHaveBeenCalledTimes(2); // No additional calls
      expect(result1b).toBe("processed-test1");
      expect(result2b).toBe("processed-test2");
      expect(result1a).toBe(result1b); // Same reference
      expect(result2a).toBe(result2b); // Same reference
    });

    test("creates new cache entry for different context objects with same values", () => {
      const expensiveComputation = vi.fn(
        (context: TestContext) => `processed-${context.value}`,
      );
      const memoizedFactory = globalStateMemo(expensiveComputation as any);

      const context1 = { value: "same" };
      const context2 = { value: "same" }; // Same value, different object

      const result1 = memoizedFactory(context1);
      const result2 = memoizedFactory(context2);

      // Should compute for each different object reference
      expect(expensiveComputation).toHaveBeenCalledTimes(2);
      expect(result1).toBe("processed-same");
      expect(result2).toBe("processed-same");
    });

  });

  describe("Factory Function Isolation", () => {
    test("different factory functions have separate caches", () => {
      const factory1 = vi.fn(
        (context: TestContext) => `factory1-${context.value}`,
      );
      const factory2 = vi.fn(
        (context: TestContext) => `factory2-${context.value}`,
      );

      const memoized1 = globalStateMemo(factory1 as any);
      const memoized2 = globalStateMemo(factory2 as any);

      const context = { value: "test" };

      const result1 = memoized1(context);
      const result2 = memoized2(context);

      expect(factory1).toHaveBeenCalledOnce();
      expect(factory2).toHaveBeenCalledOnce();
      expect(result1).toBe("factory1-test");
      expect(result2).toBe("factory2-test");

      // Second calls should still use separate caches
      memoized1(context);
      memoized2(context);

      expect(factory1).toHaveBeenCalledOnce(); // Still only one call
      expect(factory2).toHaveBeenCalledOnce(); // Still only one call
    });

    test("same factory function used multiple times shares cache", () => {
      const expensiveComputation = vi.fn(
        (context: TestContext) => `processed-${context.value}`,
      );

      const memoized1 = globalStateMemo(expensiveComputation as any);
      const memoized2 = globalStateMemo(expensiveComputation as any); // Same factory

      const context = { value: "test" };

      const result1 = memoized1(context);
      expect(expensiveComputation).toHaveBeenCalledOnce();

      const result2 = memoized2(context);
      expect(expensiveComputation).toHaveBeenCalledOnce(); // No additional call

      expect(result1).toBe(result2);
      expect(result1).toBe("processed-test");
    });
  });

  describe("Complex Data Handling", () => {
    test("works with complex context objects", () => {
      const complexComputation = vi.fn((context: ExpensiveContext) => {
        return {
          processedData: context.data.map((item) => item.toUpperCase()),
          count: context.data.length,
        };
      });

      const memoizedFactory = globalStateMemo(complexComputation as any);

      const context1 = { data: ["hello", "world"] };
      const context2 = { data: ["foo", "bar", "baz"] };

      const result1 = memoizedFactory(context1) as ReturnType<typeof complexComputation>;
      const result2 = memoizedFactory(context2) as ReturnType<typeof complexComputation>;

      expect(complexComputation).toHaveBeenCalledTimes(2);
      expect(result1.processedData).toEqual(["HELLO", "WORLD"]);
      expect(result1.count).toBe(2);
      expect(result2.processedData).toEqual(["FOO", "BAR", "BAZ"]);
      expect(result2.count).toBe(3);

      // Cached results
      const result1b = memoizedFactory(context1);
      const result2b = memoizedFactory(context2);

      expect(complexComputation).toHaveBeenCalledTimes(2); // No additional calls
      expect(result1).toBe(result1b); // Same object reference
      expect(result2).toBe(result2b); // Same object reference
    });

  });
});
