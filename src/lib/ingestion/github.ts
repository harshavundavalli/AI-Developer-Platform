import type { GitHubRepo } from "@/types";

const GITHUB_API = "https://api.github.com";

/**
 * Fetch all repositories for the authenticated user.
 */
export async function fetchUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&sort=updated&type=all`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const data: GitHubRepo[] = await res.json();
    repos.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

/**
 * Get the file tree of a repository.
 */
export async function fetchRepoTree(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string = "main"
): Promise<Array<{ path: string; size: number; type: string; sha: string }>> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!res.ok) throw new Error(`Failed to fetch repo tree: ${res.status}`);

  const data = await res.json();
  return (data.tree || []).filter(
    (item: { type: string }) => item.type === "blob"
  );
}

/**
 * Fetch a single file's content from GitHub.
 */
export async function fetchFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  branch: string = "main"
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);

  const data = await res.json();

  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  throw new Error("Unsupported file encoding");
}

/**
 * Fetch a PR diff from GitHub.
 */
export async function fetchPRDiff(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3.diff",
      },
    }
  );

  if (!res.ok) throw new Error(`Failed to fetch PR diff: ${res.status}`);
  return res.text();
}

/**
 * Post a review comment on a PR.
 */
export async function postPRComment(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!res.ok) throw new Error(`Failed to post comment: ${res.status}`);
}
