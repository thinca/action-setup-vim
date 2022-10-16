import * as core from "@actions/core";
import * as cp from "child_process";
import * as fs from "fs";
import {promisify} from "util";

const execFile = promisify(cp.execFile);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

function versionOutputCmd(outFile: string): string {
  return [
    `redir! > ${outFile}`,
    "version",
    "redir END",
  ].join(" | ");
}

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

async function retry<T>(promiseMaker: () => Promise<T>, tryCount: number): Promise<T> {
  let rejected: any;
  while (0 < tryCount--) {
    try {
      return await promiseMaker();
    } catch (e) {
      rejected = e;
    }
  }
  return Promise.reject(rejected);
}

// "v8.2.0012" -> ["8.2.12", null]
// "v0.5.0" -> ["0.5", null]
// "v0.5.0-404-g49cd750d6" -> ["v0.5.0", "49cd750d6"]
// "v0.5.0-dev+1330-gd16e9d8ed" -> ["v0.5.0", "d16e9d8ed"]
// "v0.5.0-nightly" -> ["v0.5.0", "nightly"]
// "v0.5.0-dev+nightly" -> ["v0.5.0", "nightly"]
// "49cd750d6a72efc0571a89d7a874bbb01081227f" -> [null, "49cd750d6a72efc0571a89d7a874bbb01081227f"]
function normalizeVersion(str: string): [string | null, string | null] {
  if (str.indexOf(".") < 0) {
    // Probably sha1.
    return [null, str];
  }
  str = str.replace("dev+", "");

  let semver: string | null = null;
  let sha1OrTag: string | null = null;

  const semverMatched = /^v?(\d+(?:\.\d+)*)/.exec(str);
  if (semverMatched) {
    semver = semverMatched[1].
      replace(/(^|[^\d])0+(\d)/g, "$1$2").
      replace(/(?:\.0)+$/, "");
  }
  const sha1Matched = /^.*-\d+-g([0-9a-f]{7,})$/.exec(str);
  if (sha1Matched) {
    sha1OrTag = sha1Matched[1];
  } else if (0 <= str.indexOf("-")) {
    const parts = str.split("-");
    sha1OrTag = parts[parts.length - 1];
  }

  return [semver, sha1OrTag];
}

function extractVersionFromVersionOutput(verstionText: string): [string | null, string | null] {
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
  return [null, null];
}

const COMMAND_TIMEOUT = 5 * 1000;
const RETRY_COUNT = 3;

async function getCUIVersionOutput(executable: string): Promise<string> {
  const {stdout} = await retry(() => timeout(execFile(executable, ["--version"]), COMMAND_TIMEOUT), RETRY_COUNT);
  return stdout;
}

async function getWindowsGUIVersionOutput(executable: string): Promise<string> {
  // gVim on Windows shows version info from "--version" via GUI dialog, so we use other approach.
  const waitForRegisterSec = 2;
  const bat = [
    `start /wait ${executable} -silent -register`,
    `ping -n ${waitForRegisterSec + 1} localhost > NUL`,
    `start /wait ${executable} -u NONE -c "${versionOutputCmd("version.txt")}" -c "qall!"`,
  ];
  await writeFile("version.bat", bat.join("\n"));

  await retry(() => timeout(execFile("call", ["version.bat"], {shell: true}), COMMAND_TIMEOUT + waitForRegisterSec * 1000), RETRY_COUNT);

  return await readFile("version.txt", "utf8");
}

async function getUnixGUIVersionOutput(executable: string): Promise<string> {

  await retry(() => timeout(execFile(executable, ["--cmd", versionOutputCmd("version.txt"), "--cmd", "qall!"]), COMMAND_TIMEOUT), RETRY_COUNT);

  return await readFile("version.txt", "utf8");
}

async function getGUIVersionOutput(vimType: string, executable: string): Promise<string> {
  // XXX: MacVim with GUI cannot be supported.
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

  const executablePath = core.getInput("executable_path");
  if (!fs.existsSync(executablePath)) {
    throw new Error(`"executable_path" does not exist: ${executablePath}`);
  }

  const vimFile = core.getInput("use_executable_path") === "yes" ? executablePath : executable;

  core.info(`Expected Version: ${expectedVimVersion}`);

  const versionOutput = (await getVersionOutput(vimType, isGUI, vimFile)).trim();

  const [actualSemverVersion, actualSha1Version] = extractVersionFromVersionOutput(versionOutput);

  core.info(`Actual Version: ${actualSemverVersion} ${actualSha1Version}`);
  core.info("-------");
  core.info(versionOutput);
  core.info("-------");

  if (process.platform === "win32" && vimType === "vim") {
    const actualArch = /(32|64)-bit/.exec(versionOutput)?.[0];
    const expectedArch = core.getInput("arch").includes("64") ? "64-bit" : "32-bit";
    if (expectedArch !== actualArch) {
      throw Error(`Installed Vim's architecture is wrong:\nexpected: ${expectedArch}\nactual: ${actualArch}`);
    }
  }

  const [expectedSemverVersion, expectedSha1Version] = normalizeVersion(expectedVimVersion);

  if (expectedSha1Version === "nightly") {
    return `Cannot check the version:\nexpected: ${expectedVimVersion}\nactual: ${actualSha1Version || actualSemverVersion}`;
  }

  if (expectedSha1Version != null && actualSha1Version != null) {
    if (vimType === "neovim") {
      if (expectedSha1Version.startsWith(actualSha1Version)) {
        return "Correct version installed";
      }
    } else {
      return `Cannot check the version:\nexpected: ${expectedVimVersion}\nactual: ${actualSha1Version}`;
    }
  } else if (expectedSemverVersion === actualSemverVersion) {
    return "Correct version installed";
  }

  throw Error(`Installed Vim's version is wrong:\nexpected: ${expectedVimVersion} (${expectedSemverVersion})\nactual: ${actualSemverVersion}`);
}

async function main(): Promise<void> {
  core.info(await check());
}


main().catch(e => {
  const message = e.message || JSON.stringify(e);
  core.setFailed(message);
  process.exit(1);
});
