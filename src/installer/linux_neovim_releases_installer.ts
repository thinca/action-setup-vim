import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class LinuxNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePattern: RegExp = /^nvim-linux64\.tar\.gz$/;
}
