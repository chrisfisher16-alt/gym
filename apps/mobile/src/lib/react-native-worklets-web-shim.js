// Web shim for react-native-worklets (native-only module)
// Provides no-op stubs for all exports that react-native-reanimated uses on web.

const noop = () => {};
const noopReturnArg = (fn) => fn;
const noopReturnObj = () => ({});

// Reanimated expects these globals for animation timestamps on web
if (typeof globalThis !== 'undefined') {
  if (!globalThis._getAnimationTimestamp) {
    globalThis._getAnimationTimestamp = () => performance.now();
  }
  if (!globalThis.__flushAnimationFrame) {
    globalThis.__flushAnimationFrame = noop;
  }
}

module.exports = {
  createSerializable: noopReturnObj,
  createSynchronizable: noopReturnObj,
  makeShareable: noopReturnArg,
  isWorkletFunction: () => false,
  scheduleOnUI: noop,
  scheduleOnRN: noop,
  runOnUISync: noop,
  runOnJS: noopReturnArg,
  runOnUI: noopReturnArg,
  runOnRuntime: noopReturnArg,
  createWorkletRuntime: noop,
  executeOnUIRuntimeSync: noop,
  callMicrotasks: noop,
  serializableMappingCache: new Map(),
  RuntimeKind: { UI: 'UI', JS: 'JS' },
  WorkletsModule: {
    createWorkletRuntime: noop,
    scheduleOnUI: noop,
    makeShareableClone: noopReturnObj,
    makeShareable: noopReturnArg,
  },
};
