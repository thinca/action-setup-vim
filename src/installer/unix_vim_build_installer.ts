import * as path from "path";
import {exec} from "@actions/exec";
import {FixedVersion, Installer} from "../interfaces";
import {VimBuildInstaller} from "./vim_build_installer";
import {backportPatch} from "../patch";
import * as semver from "semver";

export class UnixVimBuildInstaller extends VimBuildInstaller implements Installer {
  async install(vimVersion: FixedVersion): Promise<void> {
    const reposPath = await this.cloneVim(vimVersion);
    await backportPatch(reposPath, vimVersion);

    const args = [`--prefix=${this.installDir}`, "--with-features=huge"];

    if (process.platform === "darwin") {
      // To avoid `sed: RE error: illegal byte sequence` error, should set 'LC_ALL=C'.
      process.env.LC_ALL = "C";

      const vimSemver = semver.coerce(vimVersion, {loose: true});
      if (vimSemver && semver.lt(vimSemver, "8.2.5135", true)) {
        args.push("CFLAGS=-Wno-implicit-int");
      }
    }

    if (this.isGUI) {
      await exec("sudo", ["apt-get", "update"]);
      await exec("sudo", ["apt-get", "install", "libxmu-dev", "libgtk-3-dev", "libxpm-dev"]);
      args.push("--enable-gui=gtk3", "--enable-fail-if-missing");
    }
    await exec("./configure", args, {cwd: reposPath});
    await exec("make", [], {cwd: reposPath});
    await exec("make", ["install"], {cwd: reposPath});
  }

  getPath(): string {
    return path.join(this.installDir, "bin");
  }
}
