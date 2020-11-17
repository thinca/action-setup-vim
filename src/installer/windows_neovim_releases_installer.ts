import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class WindowsNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePattern: RegExp = /^nvim-win64\.zip$/;

  getExecutableName(): string {
    return this.isGUI ? "nvim-qt" : "nvim";
  }
}
