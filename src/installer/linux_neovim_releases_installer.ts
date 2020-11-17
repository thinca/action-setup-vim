import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class LinuxNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePatterns: RegExp[] = [/^nvim-linux64\.tar\.gz$/];
}
