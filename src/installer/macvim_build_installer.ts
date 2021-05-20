import * as path from "path";
import {exec} from "@actions/exec";
import * as io from "@actions/io";
import {BuildInstaller} from "./build_installer";
import {execGit, gitClone} from "../commands";
import {FixedVersion} from "../interfaces";

export class MacVimBuildInstaller extends BuildInstaller {
  readonly repository = "macvim-dev/macvim";
  readonly tags: { [key: string]: string } = {};

  getExecutableName(): string {
    return "vim";
  }

  async obtainFixedVersion(): Promise<string> {
    const log = await execGit(["log", "-1", "--format=format:%B"], {cwd: this.repositoryPath()});
    const matched = /Vim\s+patch\s+v?(\d+\.\d+\.\d+)/.exec(log);
    if (matched) {
      const version = `v${matched[1]}`;
      const tag = await super.obtainFixedVersion();
      this.tags[version] = tag;
      return version;
    }
    return "";
  }

  async install(vimVersion: FixedVersion): Promise<void> {
    const tag = this.tags[vimVersion] || vimVersion;
    const reposPath = this.repositoryPath();
    await gitClone("macvim-dev/macvim", tag, reposPath);
    const srcPath = path.join(reposPath, "src");
    await exec("./configure", [], {cwd: srcPath});

    // To avoid `sed: RE error: illegal byte sequence` error.
    await exec("sed", ["-i", "", "s/\\tsed/LC_CTYPE=C sed/", "po/Makefile"], {cwd: srcPath});

    await exec("make", [], {cwd: srcPath});
    await io.mkdirP(this.installDir);
    await io.cp(path.join(srcPath, "MacVim", "build", "Release", "MacVim.app"), this.installDir, {recursive: true});
  }

  getPath(): string {
    return path.join(this.installDir, "MacVim.app", "Contents", "bin");
  }
}
