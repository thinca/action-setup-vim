import * as core from "@actions/core";
import * as cp from "child_process";
import * as fs from "fs";
import {promisify} from "util";

const execFile = promisify(cp.execFile);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const VERSION_OUTPUT_CMD = [
  "redir! @a",
  "version",
  "0put a",
  "wq!",
].join(" | ");

function timeout<T>(promise: Promise<T>, timeoutMilliseconds: number): Promise<T> {
  const timeoutPromise = new Promise<T>(
    (_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Execution timeout")),
        timeoutMilliseconds
      )
  );
  return Promise.race([promise, timeoutPromise]);
}

// v8.2.0012 -> 8.2.12
// v0.5.0 -> 0.5
// v0.5.0-404-g49cd750d6 -> 49cd750d6
// v0.5.0-dev+1330-gd16e9d8ed -> d16e9d8ed
// v0.5.0-nightly -> nightly
// v0.5.0-dev+nightly -> nightly
// 49cd750d6a72efc0571a89d7a874bbb01081227f -> 49cd750d6a72efc0571a89d7a874bbb01081227f
function normalizeVersion(str: string): string {
  if (str.indexOf(".") < 0) {
    return str;
  }
  str = str.replace("dev+", "");
  const matched = /^.*-\d+-g([0-9a-f]{7,})$/.exec(str);
  if (matched) {
    return matched[1];
  }
  if (0 <= str.indexOf("-")) {
    const parts = str.split("-");
    return parts[parts.length - 1];
  }
  return str.
    replace(/.*?(\d+(?:\.\d+)*).*/s, "$1").
    replace(/(^|[^\d])0+(\d)/g, "$1$2").
    replace(/(?:\.0)+$/, "");
}

function extractVersionFromVersionOutput(verstionText: string): string {
  const lines = verstionText.trimStart().split(/\r?\n/);
  const majorMinorMatched = /VIM - Vi IMproved (\d+)\.(\d+)/.exec(lines[0]);
  if (majorMinorMatched) {
    const [major, minor] = majorMinorMatched.slice(1, 3).map((n) => parseInt(n));
    let patch = 0;
    for (const line of lines.slice(1, 5)) {
      const patchMatched = /^Included patches: .*?(\d+)$/.exec(line);
      if (patchMatched) {
        patch = parseInt(patchMatched[1]);
        break;
      }
    }
    return normalizeVersion([major, minor, patch].join("."));
  } else {
    const matched = /^NVIM (.*)/.exec(lines[0]);
    if (matched) {
      return normalizeVersion(matched[1]);
    }
  }
  return "";
}

async function getCUIVersionOutput(executable: string): Promise<string> {
  const {stdout} = await timeout(execFile(executable, ["--version"]), 3000);
  return stdout;
}

async function getWindowsGUIVersionOutput(executable: string): Promise<string> {
  // gVim on Windows shows version info from "--version" via GUI dialog, so we use other approach.
  const bat = [
    `start /wait ${executable} -silent -register`,
    `start /wait ${executable} -u NONE -c "${VERSION_OUTPUT_CMD}" version.txt`,
  ];
  await writeFile("version.bat", bat.join("\n"));

  await timeout(execFile("call", ["version.bat"], {shell: true}), 5000);

  return await readFile("version.txt", "utf8");
}

async function getUnixGUIVersionOutput(executable: string): Promise<string> {

  await timeout(execFile(executable, ["--cmd", VERSION_OUTPUT_CMD, "version.txt"]), 5000);

  return await readFile("version.txt", "utf8");
}

async function getGUIVersionOutput(vimType: string, executable: string): Promise<string> {
  // XXX: MacVim with GUI can not be supported.
  if (vimType === "neovim") {
    // GUI of Neovim is a wrapper for CUI version so we check just a CUI version
    return await getCUIVersionOutput("nvim");
  }

  if (process.platform === "win32") {
    return await getWindowsGUIVersionOutput(executable);
  }

  return await getUnixGUIVersionOutput(executable);
}

async function getVersionOutput(vimType: string, isGUI: boolean, executable: string): Promise<string> {
  if (isGUI) {
    return await getGUIVersionOutput(vimType, executable);
  } else {
    return await getCUIVersionOutput(executable);
  }
}

async function check(): Promise<string> {
  const vimType = core.getInput("vim_type").toLowerCase();
  const isGUI = core.getInput("gui") === "yes";
  const executable = core.getInput("executable");
  const expectedVimVersion = core.getInput("expected_vim_version");

  core.info(`Expected Version: ${expectedVimVersion}`);

  const versionOutput = (await getVersionOutput(vimType, isGUI, executable)).trim();

  const actualVersion = extractVersionFromVersionOutput(versionOutput);

  core.info(`Actual Version: ${actualVersion}`);
  core.info("-------");
  core.info(versionOutput);
  core.info("-------");

  const normalizedExpectedVersion = normalizeVersion(expectedVimVersion);

  if (actualVersion === "nightly") {
    return `Cannot check the version:\nexpected: ${expectedVimVersion}\nactual: ${actualVersion}`;
  }
  const isSha1 = /^[0-9a-f]{7,}$/.test(normalizedExpectedVersion);
  if (isSha1) {
    if (vimType === "neovim") {
      if (normalizedExpectedVersion.startsWith(actualVersion)) {
        return "Correct version installed";
      }
    } else {
      return `Can not check the version:\nexpected: ${expectedVimVersion}\nactual: ${actualVersion}`;
    }
  } else if (normalizedExpectedVersion === actualVersion) {
    return "Correct version installed";
  }

  throw Error(`Installed Vim's version is wrong:\nexpected: ${expectedVimVersion}\nactual: ${actualVersion}`);
}

async function main(): Promise<void> {
  core.info(await check());
}


main().catch(e => {
  const message = e.message || JSON.stringify(e);
  core.setFailed(message);
  process.exit(1);
});
