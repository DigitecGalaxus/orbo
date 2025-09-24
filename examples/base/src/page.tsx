import { useCount, useSetCount } from "./useCounter";
import { useTimer } from "./useTimer";

export default function Page() {
  return (
    <div style={{ padding: "20px", fontFamily: "system-ui" }}>
      <h1>Orbo Example</h1>
      <p>Global state as simple as useState.</p>

      <div style={{ display: "flex", gap: "40px", marginTop: "20px" }}>
        <Counter />
        <AnotherCounter />
      </div>

      <Timer />
    </div>
  );
}

function Counter() {
  const count = useCount();
  const setCount = useSetCount();

  return (
    <div>
      <h3>Counter</h3>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}

function AnotherCounter() {
  const count = useCount();
  const setCount = useSetCount();

  return (
    <div>
      <h3>Same State</h3>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 10)}>+10</button>
    </div>
  );
}

function Timer() {
  const timer = useTimer();

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>Timer (onSubscribe example)</h3>
      <p>Seconds: {timer}</p>
      <small>Automatically starts/stops when component mounts/unmounts</small>
    </div>
  );
}
