/** Production ICD-10-GM 2026 coding: the Person 2 module, adapted to the server's CodingResponse shape. */
import { assignMedicalCodes as assignWithModule, loadConfig } from 'medical-coding-expert';
import type { CodingRequest, CodingResponse } from './index.js';

interface Options { signal?: AbortSignal }
type ModuleAssign = typeof assignWithModule;

/** The app configures its coding model as CLAUDE_CODING_MODEL; the module reads CLAUDE_MODEL. */
export function codingConfig(env: NodeJS.ProcessEnv = process.env) {
  return loadConfig({ ...env, CLAUDE_MODEL: env.CLAUDE_CODING_MODEL || env.CLAUDE_MODEL });
}

export function createCodingAdapter(assign: ModuleAssign = assignWithModule) {
  return async function assignMedicalCodes(request: CodingRequest, options: Options = {}): Promise<CodingResponse> {
    const response = await assign(request, { signal: options.signal, deps: { config: codingConfig() } });
    return {
      ...response,
      // The module returns one reference per candidate; the server keeps a list.
      results: response.results.map(({ candidates, ...result }) => ({
        ...result,
        ...(candidates ? { candidates: candidates.map(({ reference, ...c }) => ({ ...c, references: [reference] })) } : {}),
      })),
    };
  };
}

export const assignMedicalCodes = createCodingAdapter();
