import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import {ActionError} from "./action_error";
import {VimType, isVimType} from "./interfaces";
import * as cache from "@actions/cache";
import {getInstaller} from "./get_installer";
import {TEMP_PATH} from "./temp";

const actionVersion = "3.0.1";

function makeCacheKey(vimType: VimType, isGUI: boolean, vimVersion: string, download: string): string {
  return `${actionVersion}-${process.platform}-${vimType}-${isGUI ? "gui" : "cui"}-${download}-${vimVersion}`;
}


async function main(): Promise<void> {
  const vimType = core.getInput("vim_type").toLowerCase();
  if (!isVimType(vimType)) {
    throw new ActionError(`Invalid vim_type: ${vimType}`);
  }

  const download = core.getInput("download");
  const isGUI = core.getInput("gui") === "yes";
  const inputVimVersion = core.getInput("vim_version");
  if (!/^[a-zA-Z0-9.+-]+$/.test(inputVimVersion)) {
    throw new ActionError(`Invalid vim_version: ${inputVimVersion}`);
  }

  const installPath = path.join(TEMP_PATH, vimType, inputVimVersion);
  const installer = getInstaller(installPath, vimType, isGUI, download, inputVimVersion);

  const fixedVersion = await installer.resolveVersion(inputVimVersion);
  core.info(`Vim version: ${fixedVersion}`);

  let installed = false;
  try {
    const stat = fs.statSync(installPath);
    installed = stat.isDirectory();
  } catch (_e) {
    // path not exist
  }

  let cacheHit: string | undefined;

  if (!installed) {
    await io.mkdirP(installPath);

    const cacheInput = core.getInput("cache");
    const cacheTest = /^test-/.test(cacheInput);
    const useCache = installer.installType == "build" && (cacheInput === "true" || cacheTest);

    if (useCache) {
      const cacheKeyPrefixForTest = cacheTest ? `${cacheInput}-` : "";
      const cacheKey = `${cacheKeyPrefixForTest}${makeCacheKey(vimType, isGUI, fixedVersion, download)}`;
      cacheHit = await cache.restoreCache([installPath], cacheKey, []);
      if (!cacheHit) {
        await installer.install(fixedVersion);

        // For test: Write cache immediately for next step.
        if (cacheTest) {
          await saveCache(installPath, cacheKey);
        } else {
          core.saveState("cache_key", cacheKey);
          core.saveState("install_path", installPath);
        }
      }
    } else {
      core.info("Cache disabled");
      await installer.install(fixedVersion);
    }
  }

  const binPath = installer.getPath(fixedVersion);
  const executableName = installer.getExecutableName();
  const executableFullName = executableName + (process.platform === "win32" ? ".exe" : "");

  core.addPath(binPath);
  core.setOutput("actual_vim_version", fixedVersion);
  core.setOutput("executable", executableName);
  core.setOutput("executable_path", path.join(binPath, executableFullName));
  core.setOutput("install_type", installer.installType);
  core.setOutput("install_path", installPath);
  core.setOutput("cache_hit", cacheHit ? "true" : "false");
}

async function saveCache(installPath: string, cacheKey: string): Promise<void> {
  try {
    await cache.saveCache([installPath], cacheKey);
  } catch (e) {
    if (e instanceof cache.ReserveCacheError) {
      core.debug(`Error while caching binary in post: ${e.name}: ${e.message}`);
    } else {
      throw e;
    }
  }
}

async function post(): Promise<void> {
  const cacheKey = core.getState("cache_key");
  if (cacheKey) {
    const installPath = core.getState("install_path");
    await saveCache(installPath, cacheKey);
  }
}

async function run(): Promise<void> {
  const isPost = !!core.getState("isPost");
  if (isPost) {
    await post();
  } else {
    core.saveState("isPost", "true");
    await main();
  }
}


run().catch(e => {
  if (!(e instanceof ActionError) && e.stack) {
    core.error(e.stack);
  }
  const message = e.message || JSON.stringify(e);
  core.setFailed(message);
});
