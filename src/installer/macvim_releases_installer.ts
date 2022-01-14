import * as fs from "fs";
import * as path from "path";
import {exec} from "@actions/exec";
import * as io from "@actions/io";
import {ReleasesInstaller, Release} from "./releases_installer";
import {FixedVersion} from "../interfaces";

function checkPath(targetPath: string): boolean {
  try {
    const stat = fs.statSync(targetPath);
    return stat.isFile() || stat.isDirectory();
  } catch (e) {
    return false;
  }
}

export class MacVimReleasesInstaller extends ReleasesInstaller {
  readonly repository: string = "macvim-dev/macvim";
  readonly assetNamePatterns: RegExp[] = [/^MacVim.*\.dmg$/];
  readonly vimVersionPattern: RegExp = /(?:Vim\s+patch|Updated\s+to\s+Vim)\s*(\d+\.\d+\.\d+)/i;

  toSemverString(release: Release): string {
    const matched = this.vimVersionPattern.exec(release.body ?? "");
    return matched?.[1] || "";
  }

  async install(vimVersion: FixedVersion): Promise<void> {
    const archiveFilePath = await this.downloadAsset(vimVersion);
    await exec("hdiutil", ["attach", "-quiet", "-mountpoint", "/Volumes/MacVim", archiveFilePath]);
    await io.mkdirP(this.installDir);
    await io.cp("/Volumes/MacVim/MacVim.app", this.installDir, {recursive: true});
    await exec("hdiutil", ["detach", "/Volumes/MacVim"]);
  }

  getPath(): string {
    const vimPath = path.join(this.installDir, "MacVim.app", "Contents", "bin");
    if (checkPath(path.join(vimPath, "vim"))) {
      return vimPath;
    }
    const oldVimPath = path.join(this.installDir, "MacVim.app", "Contents", "MacOS");
    if (checkPath(path.join(oldVimPath, "Vim"))) {
      return oldVimPath;
    }
    throw new Error("Vim executable could not found");
  }

  getExecutableName(): string {
    const vimPath = path.join(this.installDir, "MacVim.app", "Contents", "bin", "vim");
    if (checkPath(vimPath)) {
      return "vim";
    }
    const oldVimPath = path.join(this.installDir, "MacVim.app", "Contents", "MacOS", "Vim");
    if (checkPath(oldVimPath)) {
      return "Vim";
    }
    throw new Error("Vim executable could not found");
  }
}
