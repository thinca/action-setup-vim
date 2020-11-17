import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class MacosNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePatterns: RegExp[] = [/^nvim-macos\.tar\.gz$/];
}
