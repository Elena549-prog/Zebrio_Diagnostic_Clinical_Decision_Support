import { describe, expect, it } from "vitest";
import { Http } from "../src/retrieve/http.js";
import { fetchEuropePmcFullText, searchEuropePmc, searchPubMed } from "../src/retrieve/papers.js";
import { ProviderBlocked, fetchGuidelinePage, searchGuidelines } from "../src/retrieve/duckduckgo.js";
import { fakeFetch, fixture, html, json, xml } from "./helpers.js";

const http = (f: typeof fetch) => new Http(f, 1000, 0);

describe("Europe PMC adapter (saved real responses)", () => {
  it("parses search results with ids, access and publication types", async () => {
    const f = fakeFetch([[/europepmc\/webservices\/rest\/search/, () => json(JSON.parse(fixture("epmc-search.json")))]]);
    const records = await searchEuropePmc(http(f), "streptococcal pharyngitis");
    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({ pmid: "41343363", doi: "10.1093/cid/ciaf668", isOpenAccess: false, year: 2026 });
    expect(records[0]!.pubTypes).toContain("Practice Guideline");
    expect(records[0]!.abstract!.length).toBeGreaterThan(200);
    expect(records[1]).toMatchObject({ pmcid: "PMC13114618", isOpenAccess: true });
  });

  it("turns full-text XML into readable text without references or citation numbers", async () => {
    const f = fakeFetch([[/PMC12344290\/fullTextXML/, () => xml(fixture("epmc-fulltext.xml"))]]);
    const text = await fetchEuropePmcFullText(http(f), "PMC12344290");
    expect(text).toContain("Acute rheumatic fever (ARF) is an inflammatory condition");
    expect(text).toContain("as a result of ARF.");
    expect(text).not.toContain("<");
    expect(text).not.toContain("Reference list text");
  });

  it("returns null when an article has no full text", async () => {
    const f = fakeFetch([]);
    expect(await fetchEuropePmcFullText(http(f), "PMC0")).toBeNull();
  });

  it("throws on a server error so the caller can record a provider failure", async () => {
    const f = fakeFetch([[/search/, () => json({}, 503)]]);
    await expect(searchEuropePmc(http(f), "x")).rejects.toThrow(/503/);
  });
});

describe("PubMed rate limits", () => {
  it("waits and retries after a 429 instead of failing", async () => {
    let n = 0;
    const f = fakeFetch([
      [/esearch\.fcgi/, () => (n++ === 0 ? new Response("rate", { status: 429, headers: { "retry-after": "0" } }) : json({ esearchresult: { idlist: [] } }))],
    ]);
    expect(await searchPubMed(new Http(f, 1000, 1), "x")).toEqual([]);
    expect(f.calls).toHaveLength(2);
  });

  it("spaces requests to the same rate-limited host even when called in parallel", async () => {
    const times: number[] = [];
    const f = fakeFetch([[/esearch\.fcgi/, () => (times.push(Date.now()), json({ esearchresult: { idlist: [] } }))]]);
    const h = new Http(f, 1000, 0);
    await Promise.all([searchPubMed(h, "a"), searchPubMed(h, "b"), searchPubMed(h, "c")]);
    const gaps = times.slice(1).map((t, i) => t - times[i]!);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(300);
  });
});

describe("PubMed adapter (saved real responses)", () => {
  it("searches, fetches and parses abstracts", async () => {
    const f = fakeFetch([
      [/esearch\.fcgi/, () => json({ esearchresult: { idlist: ["41343363"] } })],
      [/efetch\.fcgi/, () => xml(fixture("pubmed-efetch.xml"))],
    ]);
    const [r] = await searchPubMed(http(f), "pharyngitis");
    expect(r).toMatchObject({ pmid: "41343363", provider: "pubmed" });
    expect(r!.title.length).toBeGreaterThan(20);
    expect(r!.abstract!.length).toBeGreaterThan(200);
    expect(r!.pubTypes).toContain("Systematic Review");
    expect(r!.doi).toBe("10.1093/cid/ciaf668");
  });
});

describe("DuckDuckGo guideline adapter", () => {
  it("returns only https links on allowed guideline domains", async () => {
    const f = fakeFetch([[/lite\.duckduckgo\.com/, () => html(fixture("ddg-lite.html"))]]);
    const urls = await searchGuidelines(http(f), "streptococcal pharyngitis");
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(new URL(u).hostname).toMatch(/nice\.org\.uk$/);
  });

  it("unwraps redirect links locally and drops off-domain targets", async () => {
    const page = `<a href="//duckduckgo.com/l/?uddg=${encodeURIComponent("https://www.who.int/x")}&amp;rut=1">a</a>
      <a href="https://evil.example.com/nice.org.uk">b</a><a href="http://www.nice.org.uk/insecure">c</a>`;
    const f = fakeFetch([[/lite\.duckduckgo\.com/, () => html(page)]]);
    expect(await searchGuidelines(http(f), "x")).toEqual(["https://www.who.int/x"]);
  });

  it("reports a challenge page as blocked instead of bypassing it", async () => {
    const f = fakeFetch([[/lite\.duckduckgo\.com/, () => html(fixture("ddg-blocked.html"), 202)]]);
    await expect(searchGuidelines(http(f), "x")).rejects.toBeInstanceOf(ProviderBlocked);
  });

  it("sends only the search terms, never anything else", async () => {
    const f = fakeFetch([[/lite\.duckduckgo\.com/, () => html("")]]);
    await searchGuidelines(http(f), "streptococcal pharyngitis");
    expect(decodeURIComponent(f.calls[0]!.replace(/\+/g, " "))).toContain("streptococcal pharyngitis guideline");
  });

  it("fetches a guideline page as text", async () => {
    const body = `<html><head><title>Sore throat (acute) | NICE</title><script>var x=1</script></head><body><nav>menu</nav>
      <main><h1>Sore throat</h1><p>${"Use FeverPAIN or Centor criteria to identify people more likely to benefit from an antibiotic. ".repeat(4)}</p></main></body></html>`;
    const f = fakeFetch([[/nice\.org\.uk\/guidance\/ng84/, () => html(body)]]);
    const page = await fetchGuidelinePage(http(f), "https://www.nice.org.uk/guidance/ng84");
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.title).toBe("Sore throat (acute) | NICE");
    expect(page.text).toContain("Use FeverPAIN or Centor criteria");
    expect(page.text).not.toContain("var x");
    expect(page.text).not.toContain("menu");
  });

  it("refuses a redirect that leaves the allowed domains", async () => {
    const f = fakeFetch([[/nice\.org\.uk/, () => html("", 302, { location: "https://tracker.example.net/" })]]);
    const page = await fetchGuidelinePage(http(f), "https://www.nice.org.uk/guidance/ng84");
    expect(page).toMatchObject({ ok: false, reason: expect.stringMatching(/disallowed/) });
    expect(f.calls).toHaveLength(1);
  });

  it("labels a forbidden page as not retrieved", async () => {
    const f = fakeFetch([[/cdc\.gov/, () => html("Forbidden", 403)]]);
    expect(await fetchGuidelinePage(http(f), "https://www.cdc.gov/x")).toMatchObject({ ok: false, reason: "HTTP 403" });
  });
});
