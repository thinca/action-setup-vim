import {ActionError} from "./action_error";
import {Installer, VimType} from "./interfaces";

import {LinuxNeovimBuildInstaller} from "./installer/linux_neovim_build_installer";
import {LinuxNeovimReleasesInstaller} from "./installer/linux_neovim_releases_installer";
import {LinuxVimReleasesInstaller} from "./installer/linux_vim_releases_installer";
import {MacVimBuildInstaller} from "./installer/macvim_build_installer";
import {MacVimReleasesInstaller} from "./installer/macvim_releases_installer";
import {MacosNeovimBuildInstaller} from "./installer/macos_neovim_build_installer";
import {MacosNeovimReleasesInstaller} from "./installer/macos_neovim_releases_installer";
import {UnixVimBuildInstaller} from "./installer/unix_vim_build_installer";
import {WindowsNeovimReleasesInstaller} from "./installer/windows_neovim_releases_installer";
import {WindowsVimBuildInstaller} from "./installer/windows_vim_build_installer";
import {WindowsVimReleasesInstaller} from "./installer/windows_vim_releases_installer";

class InstallerUnavailableError extends ActionError {}

function _getInstaller(installDir: string, vimType: VimType, isGUI: boolean, isDownload: boolean): Installer {
  switch (process.platform) {
    case "linux":
      switch (vimType) {
        case VimType.vim:
          if (isDownload) {
            return new LinuxVimReleasesInstaller(installDir, isGUI);
          } else {
            return new UnixVimBuildInstaller(installDir, isGUI);
          }
        case VimType.neovim:
          if (isDownload) {
            return new LinuxNeovimReleasesInstaller(installDir, isGUI);
          } else {
            return new LinuxNeovimBuildInstaller(installDir, isGUI);
          }
      }
      throw new ActionError(`Unsupported vim_type in Linux: ${vimType}`);
    case "darwin":
      if (isGUI) {
        throw new ActionError("GUI is not supported in MacOS");
      }
      switch (vimType) {
        case VimType.vim:
          if (isDownload) {
            throw new InstallerUnavailableError("Download is not supported with MacOS/Vim");
          } else {
            return new UnixVimBuildInstaller(installDir, isGUI);
          }
        case VimType.neovim:
          if (isDownload) {
            return new MacosNeovimReleasesInstaller(installDir, isGUI);
          } else {
            return new MacosNeovimBuildInstaller(installDir, isGUI);
          }
        case VimType.macvim:
          if (isDownload) {
            return new MacVimReleasesInstaller(installDir, isGUI);
          } else {
            return new MacVimBuildInstaller(installDir, isGUI);
          }
      }
    // here is unreachable so can not put "break;"
    // eslint-disable-next-line no-fallthrough
    case "win32":
      switch (vimType) {
        case VimType.vim:
          if (isDownload) {
            return new WindowsVimReleasesInstaller(installDir, isGUI);
          } else {
            return new WindowsVimBuildInstaller(installDir, isGUI);
          }
        case VimType.neovim:
          if (isDownload) {
            return new WindowsNeovimReleasesInstaller(installDir, isGUI);
          } else {
            // TODO: Build Neovim on Windows
          }
      }
      throw new ActionError(`Unsupported vim_type in Windows: ${vimType}`);
  }
  throw new ActionError(`Unsupported platform: ${process.platform}`);
}

export function getInstaller(installDir: string, vimType: VimType, isGUI: boolean, download: string, version: string): Installer {
  switch (download) {
    case "always":
      return _getInstaller(installDir, vimType, isGUI, true);
    case "available":
      try {
        const installer = _getInstaller(installDir, vimType, isGUI, true);
        if (!installer.canInstall(version)) {
          throw new InstallerUnavailableError();
        }
        return installer;
      } catch (e) {
        if (e instanceof InstallerUnavailableError) {
          return _getInstaller(installDir, vimType, isGUI, false);
        }
        throw e;
      }
    case "never":
      return _getInstaller(installDir, vimType, isGUI, false);
  }
  throw new ActionError(`Invalid download parameter: ${download}`);
}
