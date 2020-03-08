import * as path from "path";

function tempPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    return path.join(home, "tmp");
  }
  throw new Error("$HOME could not detect.");
}

export const TEMP_PATH = process.env["RUNNER_TEMP"] || tempPath();
