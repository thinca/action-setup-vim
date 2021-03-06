import * as fs from "fs";
import * as path from "path";
import {extractZip} from "@actions/tool-cache";
import {SemverReleasesInstaller} from "./semver_releases_installer";
import {ActionError} from "../action_error";
import {FixedVersion} from "../interfaces";
import {TEMP_PATH} from "../temp";

export class WindowsVimReleasesInstaller extends SemverReleasesInstaller {
  readonly repository: string = "vim/vim-win32-installer";
  readonly assetNamePatterns: RegExp[] = [/^gvim_.*_x64(?:_signed)?\.zip$/];

  getExecutableName(): string {
    return this.isGUI ? "gvim" : "vim";
  }

  async install(vimVersion: FixedVersion): Promise<void> {
    const archiveFilePath = await this.downloadAsset(vimVersion);
    const tmpDir = path.join(TEMP_PATH, "tmpinst");
    fs.mkdirSync(tmpDir, {recursive: true});

    await extractZip(archiveFilePath, tmpDir);

    const candidates = [
      "",
      path.join("vim", this.vimDir(vimVersion)),
    ];
    const targetDir = this.findExecutable(tmpDir, candidates);

    const installPath = this.getPath(vimVersion);
    fs.renameSync(targetDir, installPath);

    fs.rmdirSync(tmpDir, {recursive: true});
  }

  getPath(vimVersion: FixedVersion): string {
    const vimDir = this.vimDir(vimVersion);
    return path.join(this.installDir, vimDir);
  }

  private vimDir(vimVersion: FixedVersion): string {
    const matched = /^v(\d+)\.(\d+)/.exec(vimVersion);
    return matched ? `vim${matched[1]}${matched[2]}` : "runtime";
  }

  private findExecutable(basePath: string, candidates: string[]): string {
    const executable = `${this.getExecutableName()}.exe`;
    for (const candidate of candidates) {
      const target = path.join(basePath, candidate);
      if (fs.existsSync(path.join(target, executable))) {
        return target;
      }
    }
    throw new ActionError("Installed executable not found");
  }
}
