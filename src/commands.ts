import * as cp from "child_process";
import * as fs from "fs";
import {exec} from "@actions/exec";

export function execGit(args: Array<string>, options = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const defaultOptions = {env: Object.assign({}, process.env, {GIT_TERMINAL_PROMPT: "0"})};
    cp.execFile("git", args, Object.assign(defaultOptions, options), (error, resultText, errorText) => {
      if (error) {
        reject(new Error(JSON.stringify({exitCode: error.code, resultText, errorText})));
      } else {
        resolve(resultText);
      }
    });
  });
}

export async function gitClone(ghRepo: string, vimVersion: string, dir: string, depth: number | null = 1): Promise<void> {
  if (fs.existsSync(dir)) {
    return;
  }
  const args = ["clone"];
  args.unshift("-c", "advice.detachedHead=false");
  args.push("--quiet");
  if (depth != null) {
    args.push("--depth", `${depth}`);
  }
  args.push("--branch", vimVersion, `https://github.com/${ghRepo}`, dir);
  await exec("git", args);
}

