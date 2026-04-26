import OpenAI from 'openai';

let _client: OpenAI | undefined;

function client(): OpenAI {
  if (!_client) {
    const base = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
    _client = new OpenAI({ baseURL: `${base}/v1`, apiKey: 'ollama' });
  }
  return _client;
}

export function model(): string {
  return process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
}

export async function chat(system: string, user: string): Promise<string> {
  const res = await client().chat.completions.create({
    model: model(),
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return res.choices[0]?.message.content?.trim() ?? '';
}

/** Pull first JSON array or object out of a response, even if the model adds prose. */
export function extractJson<T>(text: string, fallback: T): T {
  const match = text.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Greedy match — try the longest array/object
    const greedy = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!greedy || greedy[0] === match[0]) return fallback;
    try {
      return JSON.parse(greedy[0]) as T;
    } catch {
      return fallback;
    }
  }
}
