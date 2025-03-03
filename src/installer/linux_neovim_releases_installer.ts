import {toSemver} from "./releases_installer";
import {NeovimReleasesInstaller} from "./neovim_releases_installer";

export class LinuxNeovimReleasesInstaller extends NeovimReleasesInstaller {
  readonly assetNamePatterns: RegExp[] = [
    RegExp(String.raw`^nvim-linux(?:-${this.arch}|64)\.tar\.gz$`),
    /^nvim\.appimage$/,
  ];

  canInstall(version: string): boolean {
    if (version === "stable" || version === "nightly" || version === "head") {
      return true;
    }
    const semver = toSemver(version);
    return !!semver && 0 <= semver.compare("0.3.0");
  }
}
