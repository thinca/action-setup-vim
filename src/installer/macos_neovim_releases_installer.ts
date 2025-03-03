import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class MacosNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePatterns: RegExp[] = [RegExp(String.raw`^nvim-macos(?:-${this.arch})?\.tar\.gz$`)];
}
