import * as path from "path";
import {execGit, gitClone} from "../commands";
import {FixedVersion, Installer, InstallType} from "../interfaces";
import {TEMP_PATH} from "../temp";

function isFixedVersion(vimVersion: string): boolean {
  return /^v\d/.test(vimVersion);
}

export abstract class BuildInstaller implements Installer {
  abstract readonly repository: string;
  abstract getExecutableName(): string;
  abstract async install(vimVersion: FixedVersion): Promise<void>;
  abstract getPath(vimVersion: FixedVersion): string;

  readonly installType = InstallType.build;
  readonly installDir: string;
  readonly isGUI: boolean;

  private _repositoryPath?: string;

  constructor(installDir: string, isGUI: boolean) {
    this.installDir = installDir;
    this.isGUI = isGUI;
  }

  repositoryPath(): string {
    if (!this._repositoryPath) {
      const repoName = this.repository.split("/").pop() || "vim";
      this._repositoryPath = path.join(TEMP_PATH, "repos", repoName);
    }
    return this._repositoryPath;
  }

  async obtainFixedVersion(): Promise<string> {
    return await execGit(["describe", "--tags", "--always"], {cwd: this.repositoryPath()});
  }

  async resolveVersion(vimVersion: string): Promise<FixedVersion> {
    if (vimVersion === "head") {
      vimVersion = "master";
    }

    if (!isFixedVersion(vimVersion)) {
      await gitClone(this.repository, vimVersion, this.repositoryPath(), 100);
      vimVersion = await this.obtainFixedVersion();
      if (!isFixedVersion(vimVersion)) {
        vimVersion = await execGit(["rev-parse", "HEAD"], {cwd: this.repositoryPath()});
      }
    }

    return vimVersion.trim() as FixedVersion;
  }

  async cloneVim(vimVersion: string, depth = 1): Promise<string> {
    await gitClone(this.repository, vimVersion, this.repositoryPath(), depth);
    return this.repositoryPath();
  }
}
