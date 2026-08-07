/**
 * Lightweight web-search grounding.
 *
 * Uses DuckDuckGo's keyless HTML endpoint so grounding works without any extra
 * API key. Results are trimmed to a handful of title + snippet pairs that get
 * injected into the chat system prompt as fresh context.
 */

export type SearchResult = { title: string; snippet: string; url: string };

const NEEDS_SEARCH =
  /\b(today|tonight|current(ly)?|latest|recent(ly)?|now|news|headline|weather|forecast|price|stock|score|match|election|release date|who is|who's|what is happening|update|202[4-9]|20[3-9]\d)\b/i;

const EXPLICIT_SEARCH = /\b(search|google|look ?up|find out|browse)\b/i;

/** Heuristic: does this question need fresh information from the web? */
export function needsGrounding(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return EXPLICIT_SEARCH.test(t) || NEEDS_SEARCH.test(t);
}

function decode(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      },
      body: new URLSearchParams({ q: query }).toString(),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();

    const results: SearchResult[] = [];
    const blockRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snippetRe.exec(html)) !== null) snippets.push(decode(sm[1]));

    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = blockRe.exec(html)) !== null && results.length < limit) {
      const title = decode(m[2]);
      if (!title) { i++; continue; }
      let url = m[1];
      const redirect = url.match(/[?&]uddg=([^&]+)/);
      if (redirect) url = decodeURIComponent(redirect[1]);
      results.push({ title, url, snippet: snippets[i] ?? "" });
      i++;
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Formats results as a compact context block for the system prompt. */
export function formatGrounding(query: string, results: SearchResult[]): string {
  if (!results.length) return "";
  const lines = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n(${r.url})`)
    .join("\n\n");
  return `LIVE WEB RESULTS for "${query}" (retrieved just now — trust these over your training data):\n\n${lines}\n\nUse these facts in your answer. Do not read out the URLs.`;
}
