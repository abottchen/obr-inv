import { describe, it, expect } from "vitest";
import { parseCurrencyInput } from "../src/ui-shell";

describe("parseCurrencyInput", () => {
  it("parses a bare number as an absolute set", () => {
    expect(parseCurrencyInput("42", 100)).toBe(42);
    expect(parseCurrencyInput("0", 100)).toBe(0);
  });

  it("adds when prefixed with +", () => {
    expect(parseCurrencyInput("+45", 100)).toBe(145);
    expect(parseCurrencyInput("+0", 100)).toBe(100);
  });

  it("subtracts when prefixed with -", () => {
    expect(parseCurrencyInput("-20", 100)).toBe(80);
  });

  it("returns a negative result on over-subtract (caller clamps)", () => {
    expect(parseCurrencyInput("-50", 10)).toBe(-40);
  });

  it("trims leading and trailing whitespace", () => {
    expect(parseCurrencyInput("  +5  ", 10)).toBe(15);
    expect(parseCurrencyInput("  42  ", 0)).toBe(42);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(parseCurrencyInput("", 100)).toBeNull();
    expect(parseCurrencyInput("   ", 100)).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseCurrencyInput("abc", 100)).toBeNull();
    expect(parseCurrencyInput("4.5", 100)).toBeNull();
    expect(parseCurrencyInput("+", 100)).toBeNull();
    expect(parseCurrencyInput("-", 100)).toBeNull();
    expect(parseCurrencyInput("--5", 100)).toBeNull();
    expect(parseCurrencyInput("+ 5", 100)).toBeNull();
  });
});
