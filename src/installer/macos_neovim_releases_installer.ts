import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class MacosNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePattern: RegExp = /^nvim-macos\.tar\.gz$/;
  readonly archiveType = "tar";
}
