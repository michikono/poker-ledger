import "@testing-library/jest-dom/vitest";

// JSDOM doesn't implement Element.prototype.scrollIntoView; stub it so
// components that scroll themselves into view (e.g., PlayerRow.openEdit)
// don't throw under test.
if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
