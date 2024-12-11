import {exec} from "@actions/exec";
import {FixedVersion} from "../interfaces";
import {NeovimBuildInstaller} from "./neovim_build_installer";

export class MacosNeovimBuildInstaller extends NeovimBuildInstaller {
  async install(vimVersion: FixedVersion): Promise<void> {
    const reposPath = await this.cloneVim(vimVersion);
    const packages = [
      "ninja", "libtool", "automake",
    ];
    await exec("brew", ["install", ...packages]);
    // Build fails with Xcode 11.1 (default)
    await exec("make", ["CMAKE_BUILD_TYPE=RelWithDebInfo", "MACOSX_DEPLOYMENT_TARGET=10.14", `CMAKE_EXTRA_FLAGS=-DCMAKE_INSTALL_PREFIX=${this.installDir}`], {cwd: reposPath});
    await exec("make", ["install"], {cwd: reposPath});
  }
}
