import {BuildInstaller} from "./build_installer";
import {FixedVersion} from "../interfaces";

export abstract class VimBuildInstaller extends BuildInstaller {
  readonly repository = "vim/vim";

  getExecutableName(): string {
    return this.isGUI ? "gvim" : "vim";
  }

  abstract install(vimVersion: FixedVersion): Promise<void>;
  abstract getPath(vimVersion: FixedVersion): string;
}
