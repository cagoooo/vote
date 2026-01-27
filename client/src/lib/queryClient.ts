import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isGitHubPages } from "./environment";
import * as localVoting from "./localVoting";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // GitHub Pages 模式：使用本地儲存
  if (isGitHubPages()) {
    return handleLocalRequest(method, url, data);
  }

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// GitHub Pages 本地請求處理
async function handleLocalRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const body = data as Record<string, unknown> | undefined;

  // POST /api/questions - 建立問題
  if (method === 'POST' && url === '/api/questions') {
    const question = localVoting.createQuestion(
      body?.imageUrl as string,
      body?.options as string[]
    );
    return createJsonResponse(question);
  }

  // GET /api/questions/:id - 取得問題
  const questionMatch = url.match(/^\/api\/questions\/([^/]+)$/);
  if (method === 'GET' && questionMatch) {
    const question = localVoting.getQuestion(questionMatch[1]);
    if (!question) {
      return createJsonResponse({ error: 'Question not found' }, 404);
    }
    return createJsonResponse(question);
  }

  // POST /api/questions/:id/vote - 投票
  const voteMatch = url.match(/^\/api\/questions\/([^/]+)\/vote$/);
  if (method === 'POST' && voteMatch) {
    const questionId = voteMatch[1];
    const optionIndex = body?.optionIndex as number;

    if (localVoting.hasVoted(questionId)) {
      return createJsonResponse({ error: 'User has already voted for this question' }, 400);
    }

    const vote = localVoting.addVote(questionId, optionIndex);
    return createJsonResponse(vote);
  }

  // GET /api/questions/:id/votes - 取得投票結果
  const votesMatch = url.match(/^\/api\/questions\/([^/]+)\/votes$/);
  if (method === 'GET' && votesMatch) {
    const votes = localVoting.getVotesForQuestion(votesMatch[1]);
    return createJsonResponse(votes);
  }

  // POST /api/questions/:id/reset-votes - 重置投票
  const resetMatch = url.match(/^\/api\/questions\/([^/]+)\/reset-votes$/);
  if (method === 'POST' && resetMatch) {
    localVoting.resetVotes(resetMatch[1]);
    return createJsonResponse({ success: true });
  }

  // POST /api/questions/:id/correct-answer - 設定正確答案
  const correctMatch = url.match(/^\/api\/questions\/([^/]+)\/correct-answer$/);
  if (method === 'POST' && correctMatch) {
    const question = localVoting.setCorrectAnswer(
      correctMatch[1],
      body?.correctAnswer as number
    );
    return createJsonResponse(question);
  }

  // POST /api/questions/:id/show-answer - 顯示/隱藏答案
  const showMatch = url.match(/^\/api\/questions\/([^/]+)\/show-answer$/);
  if (method === 'POST' && showMatch) {
    const question = localVoting.toggleShowAnswer(
      showMatch[1],
      body?.show as boolean
    );
    return createJsonResponse(question);
  }

  return createJsonResponse({ error: 'Not found' }, 404);
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const url = queryKey[0] as string;

      // GitHub Pages 模式
      if (isGitHubPages()) {
        const res = await handleLocalRequest('GET', url);
        if (res.status === 401 && unauthorizedBehavior === "returnNull") {
          return null;
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        return await res.json();
      }

      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
