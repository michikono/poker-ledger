import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFlashOnChange } from "./use-flash-on-change";

function Subject({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFlashOnChange(ref, active);
  return (
    <div ref={ref} data-testid="subject">
      flash me
    </div>
  );
}

const FLASH = "player-row-flash";

describe("useFlashOnChange", () => {
  it("does not apply the flash class while inactive", () => {
    const { getByTestId } = render(<Subject active={false} />);
    expect(getByTestId("subject").classList.contains(FLASH)).toBe(false);
  });

  it("applies the flash class once active flips true", () => {
    const { getByTestId, rerender } = render(<Subject active={false} />);
    expect(getByTestId("subject").classList.contains(FLASH)).toBe(false);
    rerender(<Subject active={true} />);
    expect(getByTestId("subject").classList.contains(FLASH)).toBe(true);
  });

  it("re-applies the flash class on a false -> true toggle", () => {
    const { getByTestId, rerender } = render(<Subject active={true} />);
    const el = getByTestId("subject");
    expect(el.classList.contains(FLASH)).toBe(true);
    rerender(<Subject active={false} />);
    // Effect only restarts the animation; it never removes the class on its own.
    expect(el.classList.contains(FLASH)).toBe(true);
    rerender(<Subject active={true} />);
    expect(el.classList.contains(FLASH)).toBe(true);
  });
});
