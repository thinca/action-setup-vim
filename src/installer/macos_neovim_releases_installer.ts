import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class MacosNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly arch = process.arch === "arm64" ? "arm64" : "x86_64";
  readonly assetNamePatterns: RegExp[] = [RegExp(String.raw`^nvim-macos(?:-${this.arch})?\.tar\.gz$`)];
}
