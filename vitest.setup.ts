import "@testing-library/jest-dom/vitest";

/**
 * jsdom implements no ResizeObserver, and the Radix primitives behind `Toggle`
 * measure their thumb with one. Without this, rendering a switch in a test
 * throws from a layout effect — an environment gap, not a product fault, so it
 * is stubbed here rather than worked around per test. The stub observes
 * nothing: a jsdom element has no layout to report, so a real implementation
 * would deliver zeroes anyway.
 */
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
