import * as path from "path";
import {exec} from "@actions/exec";
import {FixedVersion, Installer} from "../interfaces";
import {VimBuildInstaller} from "./vim_build_installer";
import {backportPatch} from "../patch";
import * as semver from "semver";

export class UnixVimBuildInstaller extends VimBuildInstaller implements Installer {
  async install(vimVersion: FixedVersion): Promise<void> {
    const reposPath = await this.cloneVim(vimVersion);
    await backportPatch(reposPath, vimVersion, this.isGUI);

    const args = [`--prefix=${this.installDir}`, "--with-features=huge"];

    const vimSemver = semver.coerce(vimVersion, {loose: true});

    if (process.platform === "darwin") {
      // To avoid `sed: RE error: illegal byte sequence` error, should set 'LC_ALL=C'.
      process.env.LC_ALL = "C";

      if (vimSemver && semver.lt(vimSemver, "8.2.5135", true)) {
        args.push("CFLAGS=-Wno-implicit-int");
      }
    }

    if (this.isGUI) {
      const [guiarg, guipkg] =
        vimSemver && semver.lt(vimSemver, "7.4.1402", true)
          ? ["gtk2", "libgtk2.0-dev"]
          : ["gtk3", "libgtk-3-dev"];
      await exec("sudo", ["apt-get", "update"]);
      await exec("sudo", ["apt-get", "install", "libxmu-dev", "libxpm-dev", guipkg]);
      args.push(`--enable-gui=${guiarg}`, "--enable-fail-if-missing");
    }
    await exec("./configure", args, {cwd: reposPath});
    await exec("make", [], {cwd: reposPath});
    await exec("make", ["install"], {cwd: reposPath});
  }

  getPath(): string {
    return path.join(this.installDir, "bin");
  }
}
