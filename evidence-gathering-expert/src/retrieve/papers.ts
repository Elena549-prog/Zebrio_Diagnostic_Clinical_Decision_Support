// Europe PMC (primary) and PubMed (fallback) adapters. Both are free and need no key.
import { decodeEntities, jatsToText } from "./text.js";
import type { Http } from "./http.js";
import { HttpError } from "./http.js";

export interface PaperRecord {
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title: string;
  year?: number;
  pubTypes: string[];
  isOpenAccess: boolean;
  abstract?: string;
  provider: "europepmc" | "pubmed";
}

const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** DOI prefixes of preprint servers (Research Square, medRxiv/bioRxiv, Preprints.org, SSRN, OSF, Authorea, arXiv). */
const PREPRINT_DOI = /^10\.(21203|64898|1101|20944|2139|31219|31234|22541|48550)\//;

/** Preprints are not peer reviewed, so they never become sources. */
export function isPreprint(r: Pick<PaperRecord, "doi" | "pubTypes">, epmcSource?: string): boolean {
  return epmcSource === "PPR" || r.pubTypes.some((t) => /preprint/i.test(t)) || PREPRINT_DOI.test(r.doi ?? "");
}

interface EpmcResult {
  source?: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  pubYear?: string;
  isOpenAccess?: string;
  abstractText?: string;
  pubTypeList?: { pubType?: string[] | string };
}

/** `sort` is a Europe PMC sort order, e.g. "CITED desc"; omitted means relevance. */
export async function searchEuropePmc(http: Http, query: string, pageSize = 10, sort?: string): Promise<PaperRecord[]> {
  const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: String(pageSize) });
  if (sort) params.set("sort", sort);
  const res = await http.get(`${EPMC}/search?${params}`);
  if (res.status !== 200) throw new HttpError(`Europe PMC search HTTP ${res.status}`, res.status);
  const data = JSON.parse(res.text) as { resultList?: { result?: EpmcResult[] } };
  return (data.resultList?.result ?? [])
    .filter((r) => r.title && (r.pmid || r.pmcid || r.doi))
    .flatMap((r) => {
      const types = r.pubTypeList?.pubType;
      const pubTypes = Array.isArray(types) ? types : types ? [types] : [];
      if (isPreprint({ doi: r.doi, pubTypes }, r.source)) return [];
      return {
        pmid: r.pmid,
        pmcid: r.pmcid,
        doi: r.doi,
        title: stripTags(r.title!),
        year: r.pubYear ? Number(r.pubYear) : undefined,
        pubTypes,
        isOpenAccess: r.isOpenAccess === "Y",
        abstract: r.abstractText ? stripTags(r.abstractText) : undefined,
        provider: "europepmc" as const,
      };
    });
}

/** Full text of an open-access article, or null when Europe PMC has none. */
export async function fetchEuropePmcFullText(http: Http, pmcid: string): Promise<string | null> {
  const res = await http.get(`${EPMC}/${encodeURIComponent(pmcid)}/fullTextXML`);
  if (res.status === 404) return null;
  if (res.status !== 200) throw new HttpError(`Europe PMC full text HTTP ${res.status}`, res.status);
  const text = jatsToText(res.text);
  return text.length > 200 ? text : null;
}

function tag(xml: string, name: string): string | undefined {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? stripTags(m[1]!) : undefined;
}

export async function searchPubMed(http: Http, query: string, retmax = 5): Promise<PaperRecord[]> {
  const search = await http.get(
    `${EUTILS}/esearch.fcgi?${new URLSearchParams({ db: "pubmed", retmode: "json", retmax: String(retmax), term: query })}`,
  );
  if (search.status !== 200) throw new HttpError(`PubMed search HTTP ${search.status}`, search.status);
  const ids: string[] = JSON.parse(search.text).esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const fetched = await http.get(`${EUTILS}/efetch.fcgi?${new URLSearchParams({ db: "pubmed", retmode: "xml", id: ids.join(",") })}`);
  if (fetched.status !== 200) throw new HttpError(`PubMed fetch HTTP ${fetched.status}`, fetched.status);

  const records = [...fetched.text.matchAll(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g)].map(([a]) => {
    const abstract = [...a.matchAll(/<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText>/g)]
      .map(([, attrs, body]) => {
        const label = attrs!.match(/Label="([^"]+)"/)?.[1];
        return (label ? `${label}: ` : "") + stripTags(body!);
      })
      .join("\n\n");
    const pmcid = a.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/)?.[1];
    return {
      pmid: tag(a, "PMID"),
      pmcid,
      doi: a.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1] ?? a.match(/<ELocationID EIdType="doi"[^>]*>([^<]+)</)?.[1],
      title: tag(a, "ArticleTitle") ?? "Untitled",
      year: Number(a.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1]) || undefined,
      pubTypes: [...a.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g)].map((m) => m[1]!),
      isOpenAccess: Boolean(pmcid),
      abstract: abstract || undefined,
      provider: "pubmed" as const,
    };
  });
  return records.filter((r) => !isPreprint(r));
}
