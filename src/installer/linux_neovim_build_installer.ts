import {exec} from "@actions/exec";
import {gitClone} from "../commands";
import {FixedVersion} from "../interfaces";
import {NeovimBuildInstaller} from "./neovim_build_installer";

export class LinuxNeovimBuildInstaller extends NeovimBuildInstaller {
  async install(vimVersion: FixedVersion): Promise<void> {
    // WIP
    const reposPath = this.repositoryPath();
    await exec("sudo", ["apt-get", "update"]);
    const packages = [
      "ninja-build", "gettext", "libtool", "libtool-bin",
      "autoconf", "automake", "cmake", "g++", "pkg-config", "unzip",
    ];
    await exec("sudo", ["apt-get", "install", ...packages]);
    await gitClone("neovim/neovim", vimVersion, reposPath);
    await exec("make", ["CMAKE_BUILD_TYPE=RelWithDebInfo", `CMAKE_EXTRA_FLAGS=-DCMAKE_INSTALL_PREFIX=${this.installDir}`], {cwd: reposPath});
    await exec("make", ["install"], {cwd: reposPath});
  }
}
