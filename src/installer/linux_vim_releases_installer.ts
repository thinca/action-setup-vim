import * as fs from "fs";
import * as path from "path";
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
