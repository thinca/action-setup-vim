import {exec} from "@actions/exec";
import {FixedVersion} from "../interfaces";
import {NeovimBuildInstaller} from "./neovim_build_installer";
import * as path from "path";
import {readFileSync} from "fs";

export class LinuxNeovimBuildInstaller extends NeovimBuildInstaller {
  async install(vimVersion: FixedVersion): Promise<void> {
    const reposPath = await this.cloneVim(vimVersion);

    const packages = [
      "ninja-build", "gettext", "libtool", "libtool-bin",
      "autoconf", "automake", "cmake", "g++", "pkg-config", "unzip",
    ];
    const configureArgs = [
      "CMAKE_BUILD_TYPE=RelWithDebInfo",
      `CMAKE_INSTALL_PREFIX=${this.installDir}`,
    ];

    // XXX: Trick for v0.2.x.  This condition is not strict.
    if (this.findLine(path.join(reposPath, "third-party/cmake/BuildLuarocks.cmake"), "luacheck-scm-1.rockspec")) {
      packages.push("libuv1-dev", "libmsgpack-dev", "libtermkey-dev", "lua5.2", "lua-lpeg", "lua-mpack", "lua-bitop", "libluajit-5.1-dev", "gperf");
      configureArgs.push("DEPS_CMAKE_FLAGS=-DUSE_BUNDLED=OFF -DUSE_BUNDLED_LIBVTERM=ON -DUSE_BUNDLED_UNIBILIUM=ON");
    }

    // Workaround:
    // GitHub-hosted runner has CMake 3.20.
    // But, cannot build Neovim v0.4.4 with CMake 3.20.
    // So delete it and use CMake 3.16 from apt-get.
    await exec("sudo", ["rm", "-f", "/usr/local/bin/cmake"]);

    // Workaround for before 8b8e60728486e1fbb308bee2961175be355e550a
    const isOldBuildSystemForLuarock = this.findLine(path.join(reposPath, "cmake.deps", "CMakeLists.txt"), "USE_BUNDLED_LUAROCKS");
    if (isOldBuildSystemForLuarock) {
      packages.push(
        "lua5.1",
        "lua-lpeg",
        "lua-bitop",
        "lua-mpack"
      );

      configureArgs.push(
        "DEPS_CMAKE_FLAGS=-DUSE_BUNDLED_DEPS=ON -DUSE_BUNDLED_LUAROCKS=OFF"
      );
    }

    await exec("sudo", ["apt-get", "update"]);
    await exec("sudo", ["apt-get", "install", ...packages]);
    await exec("make", configureArgs, {cwd: reposPath});
    await exec("make", ["install"], {cwd: reposPath});
  }

  findLine(filepath: string, target: string): boolean {
    try {
      const content = readFileSync(filepath, {encoding: "utf8"});
      return 0 <= content.indexOf(target);
    } catch (_e) {
      return false;
    }
  }
}
