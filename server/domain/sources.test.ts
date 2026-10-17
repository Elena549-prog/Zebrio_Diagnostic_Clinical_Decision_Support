/**
 * The citation seam. A bug here silently points a marker at the wrong paper,
 * which is the exact failure mode inline citations are supposed to prevent —
 * so this is the part of the feature that is test-driven.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  citedIndices,
  mergeSources,
  renderSourcePool,
  resolveRefs,
  rewriteMarkers,
  sourceKey,
  stripMarkers,
  type Source,
} from "./sources.js";

describe("sourceKey", () => {
  it("prefers a DOI/PMID identifier over the URL", () => {
    const a = sourceKey({ identifier: "PMID:12345", url: "https://a.example/x" });
    const b = sourceKey({ identifier: "pmid: 12345", url: "https://totally-different.example" });
    assert.equal(a, b);
  });

  it("normalizes URLs: case, trailing slash, query and fragment", () => {
    const a = sourceKey({ url: "https://PubMed.example/Article/7/" });
    const b = sourceKey({ url: "https://pubmed.example/Article/7?utm=x#abstract" });
    assert.equal(a, b);
  });

  it("falls back to a normalized title when there is no url or identifier", () => {
    const a = sourceKey({ title: "  D-dimer  in   PE " });
    const b = sourceKey({ title: "d-dimer in pe" });
    assert.equal(a, b);
  });

  it("returns null when there is nothing identifying", () => {
    assert.equal(sourceKey({}), null);
    assert.equal(sourceKey({ title: "   " }), null);
  });
});

describe("mergeSources", () => {
  it("appends new sources and numbers them from 1", () => {
    const pool: Source[] = [];
    const { refMap, added } = mergeSources(
      pool,
      [
        { ref: "N1", title: "Wells score validation", url: "https://x.example/wells" },
        { ref: "N2", title: "CTPA sensitivity", url: "https://x.example/ctpa" },
      ],
      1,
    );
    assert.equal(pool.length, 2);
    assert.deepEqual(pool.map((s) => s.index), [1, 2]);
    assert.equal(refMap["N1"], 1);
    assert.equal(refMap["N2"], 2);
    assert.equal(added.length, 2);
  });

  it("dedupes a source already in the pool and reuses its index", () => {
    const pool: Source[] = [];
    mergeSources(pool, [{ ref: "N1", title: "Wells", url: "https://x.example/wells" }], 1);
    const { refMap, added } = mergeSources(
      pool,
      [{ ref: "N1", title: "Wells score (2nd mention)", url: "https://x.example/wells/?utm=y" }],
      2,
    );
    assert.equal(pool.length, 1, "the same paper must not enter the pool twice");
    assert.equal(refMap["N1"], 1);
    assert.equal(added.length, 0);
  });

  it("maps existing pool entries to identity refs (S<index>)", () => {
    const pool: Source[] = [];
    mergeSources(pool, [{ ref: "N1", title: "Wells", url: "https://x.example/wells" }], 1);
    const { refMap } = mergeSources(pool, [], 2);
    assert.equal(refMap["S1"], 1, "round 2 must be able to cite round 1's source as [S1]");
  });

  it("keeps indices stable as the pool grows (append-only)", () => {
    const pool: Source[] = [];
    mergeSources(pool, [{ ref: "N1", title: "A", url: "https://x.example/a" }], 1);
    mergeSources(pool, [{ ref: "N1", title: "B", url: "https://x.example/b" }], 2);
    assert.equal(pool[0]!.index, 1);
    assert.equal(pool[0]!.title, "A");
    assert.equal(pool[1]!.index, 2);
  });

  it("ignores sources with nothing identifying about them", () => {
    const pool: Source[] = [];
    const { added } = mergeSources(pool, [{ ref: "N1", note: "trust me" }], 1);
    assert.equal(pool.length, 0);
    assert.equal(added.length, 0);
  });
});

describe("rewriteMarkers", () => {
  const refMap = { N1: 3, S1: 1, S2: 2 };

  it("rewrites a local ref to its stable pool index", () => {
    assert.equal(rewriteMarkers("D-dimer is sensitive [N1].", refMap), "D-dimer is sensitive [3].");
  });

  it("rewrites every ref in a multi-ref marker", () => {
    assert.equal(rewriteMarkers("Both agree [S1, N1].", refMap), "Both agree [1, 3].");
  });

  it("strips a marker whose ref was never declared", () => {
    assert.equal(rewriteMarkers("Bold claim [S9].", refMap), "Bold claim.");
  });

  it("keeps the resolvable refs when a multi-ref marker is partly dangling", () => {
    assert.equal(rewriteMarkers("Mixed [S1, S9].", refMap), "Mixed [1].");
  });

  it("tidies the space left behind before punctuation", () => {
    assert.equal(rewriteMarkers("A claim [S9] , and more.", refMap), "A claim, and more.");
  });

  it("leaves prose without markers untouched", () => {
    assert.equal(rewriteMarkers("No citations here.", refMap), "No citations here.");
  });

  it("does not invent markers from bracketed non-refs", () => {
    assert.equal(rewriteMarkers("Range [4-6] mg.", refMap), "Range [4-6] mg.");
  });

  it("handles undefined and empty input", () => {
    assert.equal(rewriteMarkers(undefined, refMap), undefined);
    assert.equal(rewriteMarkers("", refMap), "");
  });
});

describe("citedIndices", () => {
  it("reads the pool indices out of rendered prose", () => {
    assert.deepEqual(citedIndices("A [2] and B [1, 5]."), [1, 2, 5]);
  });

  it("finds nothing in prose with no markers", () => {
    assert.deepEqual(citedIndices("Uncited claim."), []);
    assert.deepEqual(citedIndices(undefined), []);
  });
});

describe("the pipelined round contract", () => {
  it("lets round 2 cite a source the round-1 evidence pass gathered", () => {
    // Round 1: the evidence pass brings back one paper. Nothing cites it yet.
    const pool: Source[] = [];
    mergeSources(
      pool,
      [{ ref: "N1", title: "Age-stratified PE prevalence", url: "https://x.example/prev" }],
      1,
    );

    // Round 2: the pool is rendered into the hypothesis prompt...
    const rendered = renderSourcePool(pool);
    assert.match(rendered, /\[S1\] Age-stratified PE prevalence/);

    // ...and the engine's prose, citing [S1], resolves to the stable index.
    const { refMap } = mergeSources(pool, [], 2);
    assert.equal(
      rewriteMarkers("Prevalence rises after 60 [S1].", refMap),
      "Prevalence rises after 60 [1].",
    );
  });

  it("tells a round-1 engine there is nothing to cite", () => {
    assert.match(renderSourcePool([]), /No sources gathered yet/);
  });
});

describe("resolveRefs", () => {
  it("resolves case-insensitively, dedupes, and sorts", () => {
    assert.deepEqual(resolveRefs({ S1: 1, N1: 3 }, ["n1", "S1", "N1"]), [1, 3]);
  });

  it("drops refs the map has never heard of", () => {
    assert.deepEqual(resolveRefs({ S1: 1 }, ["S9", "N4"]), []);
  });
});

describe("stripMarkers", () => {
  it("removes every marker without leaving a gap", () => {
    assert.equal(stripMarkers("Likely PE [S1, S2], consider CTPA [N1]."), "Likely PE, consider CTPA.");
  });

  it("leaves unmarked prose alone", () => {
    assert.equal(stripMarkers("Plain narration."), "Plain narration.");
  });
});

describe("the engine cannot introduce a source", () => {
  // ADR 0003: sources come from the evidence experts. The hypothesis engine is
  // given an identity-only refMap, so anything it invents has nowhere to land.
  it("gives the engine identity refs only, so an invented ref is stripped", () => {
    const pool: Source[] = [];
    mergeSources(pool, [{ ref: "N1", title: "Real paper", url: "https://x.example/real" }], 1);

    const { refMap, added } = mergeSources(pool, undefined, 2);
    assert.equal(added.length, 0);
    assert.deepEqual(Object.keys(refMap), ["S1"]);
    assert.equal(
      rewriteMarkers("Grounded [S1] but this one is invented [N7].", refMap),
      "Grounded [1] but this one is invented.",
    );
  });
});
