import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { binaryBayes, illustrateBinaryBayes, unavailableProbability } from "./probability.js";

describe("binary Bayesian arithmetic, without a clinical parameter model", () => {
  it("matches independently computed positive and negative test examples", () => {
    assert.ok(Math.abs(binaryBayes(0.1, 8) - 8 / 17) < 1e-14);
    assert.ok(Math.abs(binaryBayes(0.1, 2 / 9) - 2 / 83) < 1e-14);
    assert.ok(Math.abs(binaryBayes(0.1, 5) - 5 / 14) < 1e-14);
  });
  it("is neutral at LR 1 and directionally monotone", () => {
    for (const p of [0.001, 0.1, 0.5, 0.99]) {
      assert.ok(Math.abs(binaryBayes(p, 1) - p) < 1e-14);
      assert.ok(binaryBayes(p, 0.1) < p);
      assert.ok(binaryBayes(p, 10) > p);
    }
  });
  it("handles boundary and extreme finite inputs without NaN", () => {
    assert.equal(binaryBayes(0, 8), 0);
    assert.equal(binaryBayes(1, 8), 1);
    assert.equal(binaryBayes(0.5, 0), 0);
    const p = binaryBayes(Number.MIN_VALUE, Number.MAX_VALUE);
    assert.ok(Number.isFinite(p) && p > 0 && p < 1);
    assert.throws(() => binaryBayes(1, 0), /impossible/);
  });
  it("rejects invalid parameters and explicitly marks unsupported live inference", () => {
    for (const p of [-0.1, 1.1, NaN, Infinity]) assert.throws(() => binaryBayes(p, 1));
    for (const lr of [-1, NaN, Infinity]) assert.throws(() => binaryBayes(0.5, lr));
    assert.equal(unavailableProbability().status, "unavailable");
    const illustration = illustrateBinaryBayes(0.1, 8);
    assert.equal(illustration.status, "computed");
    if (illustration.status === "computed") assert.equal(illustration.mode, "illustrative");
  });
});
