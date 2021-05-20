import * as path from "path";
import {BuildInstaller} from "./build_installer";
import {FixedVersion} from "../interfaces";

export abstract class NeovimBuildInstaller extends BuildInstaller {
  readonly repository = "neovim/neovim";

  getExecutableName(): string {
    return "nvim";
  }

  getPath(): string {
    return path.join(this.installDir, "bin");
  }

  abstract install(vimVersion: FixedVersion): Promise<void>;
}
