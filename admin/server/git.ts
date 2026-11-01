import { spawn } from "node:child_process";
import path from "node:path";

import type { GitFile, GitStatus } from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import { HttpError, isInside } from "./http.ts";

interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runGit(args: string[], timeout = 30_000): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: SITE_ROOT,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new HttpError(504, `git ${args.join(" ")}: превышено время ожидания`));
    }, timeout);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new HttpError(500, `Не удалось запустить git: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function optionalGit(args: string[]): Promise<string | null> {
  try {
    const result = await runGit(args);
    return result.code === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

function parsePorcelain(output: string): GitFile[] {
  const files: GitFile[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const code = line.slice(0, 2);
    let file = line.slice(3);
    if (file.includes(" -> ")) file = file.split(" -> ").at(-1) ?? file;
    files.push({
      path: file,
      status: code.trim() || "?",
      staged: code[0] !== " " && code[0] !== "?",
    });
  }
  return files;
}

export async function gitStatus(): Promise<GitStatus> {
  const [statusResult, branch, upstream, lastCommit] = await Promise.all([
    runGit(["status", "--porcelain=v1"]),
    optionalGit(["branch", "--show-current"]),
    optionalGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]),
    optionalGit(["log", "-1", "--pretty=%h %s"]),
  ]);

  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = await optionalGit(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
    if (counts) {
      const [left, right] = counts.split(/\s+/).map(Number);
      ahead = Number.isFinite(left) ? (left as number) : 0;
      behind = Number.isFinite(right) ? (right as number) : 0;
    }
  }

  const files = parsePorcelain(statusResult.stdout);
  if (statusResult.code !== 0) {
    throw new HttpError(500, "git status завершился с ошибкой", [statusResult.stderr.trim()]);
  }

  return {
    branch: branch || "—",
    dirty: files.length > 0,
    files,
    ahead,
    behind,
    upstream: upstream || null,
    lastCommit: lastCommit || "",
  };
}

function safePaths(files: string[]): string[] {
  const gitDir = path.join(SITE_ROOT, ".git");
  const result: string[] = [];
  for (const file of files) {
    const target = path.resolve(SITE_ROOT, file);
    if (target === SITE_ROOT || !isInside(SITE_ROOT, target)) {
      throw new HttpError(400, `Некорректный путь: ${file}`);
    }
    if (isInside(gitDir, target) || target === gitDir) continue;
    result.push(path.relative(SITE_ROOT, target).split(path.sep).join("/"));
  }
  return [...new Set(result)];
}

export async function gitDiff(files: string[]): Promise<string> {
  const safe = safePaths(files);
  if (safe.length === 0) return "";
  const result = await runGit(["diff", "HEAD", "--", ...safe]);
  if (result.code !== 0) {
    throw new HttpError(500, "git diff завершился с ошибкой", [result.stderr.trim()]);
  }
  return result.stdout || "Изменений в отслеживаемых файлах нет (новые файлы появятся после добавления в индекс).";
}

export async function gitCommit(files: string[], message: string): Promise<{ output: string; status: GitStatus }> {
  if (typeof message !== "string" || message.trim() === "") {
    throw new HttpError(400, "Введите сообщение коммита");
  }
  const safe = safePaths(files);
  if (safe.length === 0) throw new HttpError(400, "Не выбрано ни одного файла");

  const add = await runGit(["add", "--", ...safe]);
  if (add.code !== 0) {
    throw new HttpError(500, "git add завершился с ошибкой", [add.stderr.trim()]);
  }

  const staged = await runGit(["diff", "--cached", "--quiet"]);
  if (staged.code === 0) throw new HttpError(400, "Нечего коммитить: выбранные файлы не изменились");

  const commit = await runGit(["commit", "-m", message.trim()]);
  if (commit.code !== 0) {
    throw new HttpError(500, "git commit завершился с ошибкой", [
      commit.stdout.trim(),
      commit.stderr.trim(),
    ].filter(Boolean));
  }

  return {
    output: [commit.stdout.trim(), commit.stderr.trim()].filter(Boolean).join("\n"),
    status: await gitStatus(),
  };
}

export async function gitPush(): Promise<{ output: string; status: GitStatus }> {
  const result = await runGit(["push"], 120_000);
  if (result.code !== 0) {
    throw new HttpError(500, "git push завершился с ошибкой", [
      result.stdout.trim(),
      result.stderr.trim(),
      "Проверьте SSH-ключ, upstream и права на репозиторий.",
    ].filter(Boolean));
  }
  return {
    output: [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n") || "Готово.",
    status: await gitStatus(),
  };
}
