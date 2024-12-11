import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as core from "@actions/core";
import {exec} from "@actions/exec";
import * as io from "@actions/io";
import {SemverReleasesInstaller} from "./semver_releases_installer";
import {FixedVersion} from "../interfaces";

export class LinuxVimReleasesInstaller extends SemverReleasesInstaller {
  readonly repository: string = "vim/vim-appimage";
  readonly assetNamePatterns: RegExp[] = [/\.AppImage$/];
  readonly availableVersion: string = "v8.1.1239";

  getExecutableName(): string {
    return this.isGUI ? "gvim" : "vim";
  }

  async install(vimVersion: FixedVersion): Promise<void> {
    const ubuntuVersion = getUbuntuVersion();
    // libfuse2 is needed for appimage.
    const packages = ["libfuse2"];
    if (ubuntuVersion === "22.04") {
    // LD_PRELOAD are needed for appimage on Ubuntu 22.04.
      core.exportVariable("LD_PRELOAD", "/lib/x86_64-linux-gnu/libgmodule-2.0.so");
    }
    if (ubuntuVersion === "24.04") {
      const vimSemver = semver.coerce(vimVersion, {loose: true});
      if (vimSemver && semver.lt(vimSemver, "8.2.5114", true)) {
        packages.push("libglib2.0-dev");
        core.exportVariable("LD_PRELOAD", "/lib/x86_64-linux-gnu/libgmodule-2.0.so");
      }
    }
    await exec("sudo", ["apt-get", "update"]);
    await exec("sudo", ["apt-get", "install", ...packages]);

    const archiveFilePath = await this.downloadAsset(vimVersion);
    const installPath = this.getPath();
    await io.mkdirP(installPath);
    const binVim = path.join(installPath, this.getExecutableName());
    await io.mv(archiveFilePath, binVim);
    fs.chmodSync(binVim, 0o777);
  }

  getPath(): string {
    return path.join(this.installDir, "bin");
  }
}

function getUbuntuVersion(): string {
  const version = fs.readFileSync("/etc/os-release", "utf8");
  const matched = /VERSION_ID="(\d+\.\d+)"/.exec(version);
  return matched ? matched[1] : "";
}
