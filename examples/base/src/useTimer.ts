import { createGlobalState } from "orbo";

// Timer that updates every second using onSubscribe
export const [useTimer, useSetTimer] = createGlobalState({
  initialState: () => 0,
  onSubscribe: (setState) => {
    const interval = setInterval(() => {
      setState((prev) => prev + 1);
    }, 1000);

    // Cleanup when no components use this state
    return () => clearInterval(interval);
  },
});
