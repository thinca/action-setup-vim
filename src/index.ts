import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import {ActionError} from "./action_error";
import {isVimType} from "./interfaces";
import * as cache from "./cache";
import {getInstaller} from "./get_installer";
import {TEMP_PATH} from "./temp";

async function main(): Promise<void> {
  const installPath = path.join(TEMP_PATH, "vim");

  const vimType = core.getInput("vim_type").toLowerCase();
  if (!isVimType(vimType)) {
    throw new ActionError(`Invalid vim_type: ${vimType}`);
  }

  const download = core.getInput("download");
  const isGUI = core.getInput("gui") === "yes";
  const inputVimVersion = core.getInput("vim_version");
  const installer = getInstaller(installPath, vimType, isGUI, download, inputVimVersion);

  const fixedVersion = await installer.resolveVersion(inputVimVersion);
  core.info(`Vim version: ${fixedVersion}`);

  let installed = false;
  try {
    const stat = fs.statSync(installPath);
    installed = stat.isDirectory();
  } catch (e) {
    // path not exist
  }

  if (!installed) {
    await io.mkdirP(installPath);

    const useCache = installer.installType == "build" && core.getInput("cache") === "true";

    if (useCache) {
      const cacheExists = await cache.restore(vimType, isGUI, fixedVersion, installPath);
      if (!cacheExists) {
        await installer.install(fixedVersion);
        core.saveState("version", fixedVersion);
        core.saveState("install_path", installPath);
      }
    } else {
      core.info("Cache disabled");
      await installer.install(fixedVersion);
    }
  }

  core.addPath(installer.getPath(fixedVersion));
  core.setOutput("actual_vim_version", fixedVersion);
  core.setOutput("executable", installer.getExecutableName());
  core.setOutput("install_type", installer.installType);
}

async function post(): Promise<void> {
  const version = core.getState("version");
  if (version) {
    const vimType = core.getInput("vim_type").toLowerCase();
    const isGUI = core.getInput("gui") === "yes";
    const installPath = core.getState("install_path");
    if (isVimType(vimType)) {
      try {
        await cache.save(vimType, isGUI, version, installPath);
      } catch (e) {
        if (!(/Cache already exists/.test(e.message))) {
          throw e;
        }
      }
    }
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
