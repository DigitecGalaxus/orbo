# orbo

## 3.4.1

### Patch Changes

- 99b37ae: add api to read initialValues from context

## 3.4.0

### Minor Changes

- e053931: Optimize production build size

## 3.3.0

### Minor Changes

- e8e71ed: Calling useState inside onSubscribe will no longer cause hydration missmatches

## 3.2.0

### Minor Changes

- 32f86ef: Add `isHydrated` flag to initializeState

## 3.1.0

### Minor Changes

- 22485f5: Internal code cleanup and improved test coverage for `onSubscribe` initialization

## 3.0.2

### Patch Changes

- 7a8244f: Fix issue with reading from context

## 3.0.1

### Patch Changes

- 0c68b1b: Refactor onSubscribe API, explicit variable name `initialState`
- d1488e2: Fixed issue when listener unmounts + remounts when value has changed

## 3.0.0

### Major Changes

- 7988940: API change: rename cleanupOnUnmount to persistState

### Minor Changes

- 7988940: add optional onSubscribe sync feature to watch external sources

## 2.0.0

### Major Changes

- 8463cfb: rename AppContextProvider to GlobalStateProvider

### Patch Changes

- 11840b8: update documentation

## 1.0.1

### Patch Changes

- c4a120c: Added prettier to the project

## 1.0.0

### Major Changes

- 96946f3: Initial release
