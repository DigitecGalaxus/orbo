import { createGlobalState } from "orbo";

// Create global counter state - similar to useState
export const [useCount, useSetCount] = createGlobalState({
  initialState: () => 0,
});
