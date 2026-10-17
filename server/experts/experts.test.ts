import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpertAdapters, safeClinicalQuery, verifiedCodeEntry } from './index.js';
import { allowedIcdUrl, duckDuckGoTargets, retrievePages, ICD_BASE } from './retrieval.js';
import type { RetrievedPage } from './retrieval.js';
import type { Case } from '../domain/types.js';
const fixturePage: RetrievedPage = {id:'N1',url:ICD_BASE+'block-j40-j47.htm',title:'Synthetic catalogue fixture',text:'J46\nSynthetic fixture label for verifier testing\nSome entry text.\nJ47\nNext synthetic label',retrievedAt:'2026-10-17T00:00:00Z',retrievalProvider:'tavily'};
const fixtureCase = {presentation:{chiefComplaint:'Fever in Jane Doe patient 123456',observations:[]},hypotheses:{h1:{name:'Asthma',status:'live'}}} as unknown as Case;
const retrieval = {pages:[fixturePage],providers:['tavily'],limitations:[]};
test('ICD boundary rejects alternate editions, hostile host, encoded paths and redirectors',()=>{
  assert.equal(allowedIcdUrl(fixturePage.url),true);
  for(const value of [fixturePage.url.replace('2026','2025'),fixturePage.url.replace('.de/','.de.attacker.test/'),ICD_BASE+'%2e%2e/index.htm',ICD_BASE+'index.htm?url=https://evil.test',ICD_BASE+'../index.htm',ICD_BASE+'vorab/index.htm']) assert.equal(allowedIcdUrl(value),false,value);
});
test('queries contain fixed clinical vocabulary and code tokens, not identifiers',()=>{
  assert.equal(safeClinicalQuery('Jane Doe 123456 jane@example.org fever J46'), 'fever j46');
});
test('verification requires full label in same entry, actual quote, and next-code boundary',()=>{
  const passage='J46\nSynthetic fixture label for verifier testing';
  assert.equal(verifiedCodeEntry(fixturePage,'J46','Synthetic fixture label for verifier testing',passage),'terminal');
  assert.equal(verifiedCodeEntry(fixturePage,'J46','Synthetic fixture',passage),null);
  assert.equal(verifiedCodeEntry(fixturePage,'J46','Next synthetic label','J47\nNext synthetic label'),null);
  assert.equal(verifiedCodeEntry(fixturePage,'J46','Synthetic fixture label for verifier testing','J46 invented label and made up passage'),null);
  assert.equal(verifiedCodeEntry({...fixturePage,text:fixturePage.text.split('\nJ47')[0]!},'J46','Synthetic fixture label for verifier testing',passage),'unknown');
});
test('evidence rejects fabricated quote and unknown source IDs even when validator marks supported',async()=>{
  let calls=0;
  const adapters=createExpertAdapters({retrieve:async()=>retrieval,askJson:async()=>++calls===1?{queries:['asthma guideline']}:{findings:[{summary:'Invented numerical claim',sourceRef:'N1',passage:'A made up exact quote that is not on this page.',validationStatus:'supported'},{summary:'Wrong source claim',sourceRef:'N999',passage:fixturePage.text,validationStatus:'supported'}]}});
  const result=await adapters.researchEvidence(fixtureCase);
  assert.equal(result.status,'partial'); assert.equal(result.sources.length,0);
  assert.ok(result.findings.every(f=>f.validationStatus==='insufficient' && f.sourceRefs?.length===0));
});
test('evidence retains original retrieved source only with matching quotation',async()=>{
  let calls=0;
  const adapters=createExpertAdapters({retrieve:async()=>retrieval,askJson:async()=>++calls===1?{queries:['asthma guideline']}:{findings:[{summary:'Synthetic fixture claim',sourceRef:'N1',passage:'Synthetic fixture label for verifier testing',validationStatus:'supported',url:'https://evil.test/fake'}]}});
  const result=await adapters.researchEvidence(fixtureCase);
  assert.equal(result.sources[0]?.url,fixturePage.url); assert.equal(result.findings[0]?.validationStatus,'supported');
});
test('suspected hypothesis gets clarification and candidate, never assigned patient code',async()=>{
  let calls=0;
  const adapters=createExpertAdapters({retrieve:async()=>retrieval,askJson:async()=>++calls===1?{conditions:[{condition:'Asthma',hypothesisId:'h1',mentionStatus:'suspected',inputRefs:['x1'] }]}:{results:[{condition:'Asthma',code:'J46',officialLabel:'Synthetic fixture label for verifier testing',sourceRef:'N1',passage:'J46\nSynthetic fixture label for verifier testing'}]}});
  const response=await adapters.assignMedicalCodes({requestId:'r1',excerpts:[{id:'x1',text:'Possible asthma'}],evidence:[],hypotheses:[{id:'h1',name:'Asthma'}]});
  assert.equal(response.results[0]?.status,'needs_clarification');assert.equal(response.results[0]?.code,null);assert.equal(response.results[0]?.candidates?.length,1);
});
test('documented condition with verified entry yields source-linked suggestion and valid input refs',async()=>{
  let calls=0;
  const adapters=createExpertAdapters({retrieve:async()=>retrieval,askJson:async()=>++calls===1?{conditions:[{condition:'Asthma',mentionStatus:'documented',inputRefs:['x1','unknown'] }]}:{results:[{condition:'Asthma',code:'J46',officialLabel:'Synthetic fixture label for verifier testing',sourceRef:'N1',passage:'J46\nSynthetic fixture label for verifier testing'}]}});
  const response=await adapters.assignMedicalCodes({requestId:'r1',excerpts:[{id:'x1',text:'Synthetic documented condition'}],evidence:[]});
  assert.equal(response.results[0]?.status,'assigned');assert.deepEqual(response.results[0]?.inputRefs,['x1']);assert.equal(response.results[0]?.references[0]?.url,fixturePage.url);
});
test('literature references cannot authorize an assigned patient code',async()=>{
  let calls=0;
  const adapters=createExpertAdapters({retrieve:async()=>retrieval,askJson:async()=>++calls===1?{conditions:[{condition:'Asthma',mentionStatus:'documented',inputRefs:['paper1'] }]}:{results:[{condition:'Asthma',code:'J46',officialLabel:'Synthetic fixture label for verifier testing',sourceRef:'N1',passage:'J46\nSynthetic fixture label for verifier testing'}]}});
  const response=await adapters.assignMedicalCodes({requestId:'r1',excerpts:[],evidence:[{id:'paper1',text:'Disease in a study',kind:'literature'}]});
  assert.equal(response.results[0]?.code,null);
});
test('Tavily failure invokes DuckDuckGo, extracts official page and does not expose key in result',async()=>{
  const urls:string[]=[];
  const fetcher=async(input: string|URL|Request)=>{
    const url=String(input);urls.push(url);
    if(url.startsWith('https://api.tavily.com')) return new Response('sensitive upstream details',{status:401});
    if(url.startsWith('https://html.duckduckgo.com')) return new Response(`<a href="//duckduckgo.com/l/?uddg=${encodeURIComponent(fixturePage.url)}">official</a><a href="https://evil.test">bad</a>`);
    assert.equal(url,fixturePage.url);return new Response('<h2>J46</h2><p>Synthetic fixture label for verifier testing</p><h2>J47</h2><p>Next entry</p>');
  };
  const response=await retrievePages(['asthma'],true,{fetcher:fetcher as typeof fetch,tavilyKey:'secret-test-key'});
  assert.ok(urls.some(u=>u.includes('duckduckgo.com')));assert.equal(response.pages[0]?.retrievalProvider,'direct');assert.equal(JSON.stringify(response).includes('secret-test-key'),false);assert.equal(JSON.stringify(response).includes('sensitive upstream'),false);
});
test('DDG blocks and disallowed redirects return unavailable without bypass',async()=>{
  const blocked=await retrievePages(['asthma'],true,{tavilyKey:'',fetcher:(async()=>new Response('<form id="challenge-form">Unfortunately, bots</form>')) as typeof fetch});assert.equal(blocked.pages.length,0);
  const urls:string[]=[];
  const redirected=await retrievePages(['asthma'],true,{tavilyKey:'',fetcher:(async(input)=>{const u=String(input);urls.push(u);return u.includes('duckduckgo.com')?new Response(`<a href="${fixturePage.url}">source</a>`):new Response(null,{status:302,headers:{location:'https://evil.test'}});}) as typeof fetch});
  assert.equal(redirected.pages.length,0);assert.equal(urls.includes('https://evil.test'),false);
});
test('already-cancelled work makes no provider call',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  const adapters=createExpertAdapters({retrieve:async()=>{calls++;return retrieval;},askJson:async()=>{calls++;return {};}});
  await assert.rejects(adapters.researchEvidence(fixtureCase,{signal:controller.signal}));assert.equal(calls,0);
});
test('DDG targets decode redirects and discard unrelated hosts',()=>{
  assert.deepEqual(duckDuckGoTargets(`<a href="//duckduckgo.com/l/?uddg=${encodeURIComponent(fixturePage.url)}&amp;x=y">a</a><a href="https://evil.test">b</a>`),[fixturePage.url]);
});
