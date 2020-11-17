import * as fs from "fs";
import * as path from "path";
import * as io from "@actions/io";
import {toSemver} from "./releases_installer";
import {SemverReleasesInstaller} from "./semver_releases_installer";
import {FixedVersion} from "../interfaces";

const AVAILABLE_VERSION = toSemver("v8.1.1239");

export class LinuxVimReleasesInstaller extends SemverReleasesInstaller {
  readonly repository: string = "vim/vim-appimage";
  readonly assetNamePatterns: RegExp[] = [/\.AppImage$/];

  getExecutableName(): string {
    return this.isGUI ? "gvim" : "vim";
  }

  canInstall(version: string): boolean {
    const ver = toSemver(version);
    return ver == null || AVAILABLE_VERSION == null || 0 <= ver.compare(AVAILABLE_VERSION);
  }

  async install(vimVersion: FixedVersion): Promise<void> {
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
