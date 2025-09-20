import * as fs from "fs";
import * as path from "path";
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

    const makeLists = fs.readFileSync(path.join(reposPath, "src", "nvim", "CMakeLists.txt"), "utf-8");
    if (!/-Wl,-no_deduplicate/.test(makeLists)) {
      let newMakeLists: string;
      if (/\$\{CMAKE_EXE_LINKER_FLAGS} -framework CoreServices/.test(makeLists)) {
        newMakeLists = makeLists.replace(/\$\{CMAKE_EXE_LINKER_FLAGS} -framework CoreServices/, "$& -Wl,-no_deduplicate");
      } else {
        newMakeLists = makeLists.replace(/target_link_libraries\((\w+) PRIVATE "-framework CoreServices"\)/, "$&\n  target_link_options($1 PRIVATE \"-Wl,-no_deduplicate\")");
      }
      if (newMakeLists !== makeLists) {
        fs.writeFileSync(path.join(reposPath, "src", "nvim", "CMakeLists.txt"), newMakeLists);
      }
    }

    const configureArgs = [
      "CMAKE_BUILD_TYPE=RelWithDebInfo",
      "MACOSX_DEPLOYMENT_TARGET=10.14",
      `CMAKE_EXTRA_FLAGS=-DCMAKE_INSTALL_PREFIX=${this.installDir}`,
    ];

    // Old versions are missing on leonerd.org.uk.
    await exec("sed", ["-i", "", "-e", "s;https://www\\.leonerd\\.org\\.uk/code/libvterm/libvterm-0.3.1\\.tar\\.gz;https://github.com/neovim/deps/raw/aa004f1b2b6470a92363cba8e1cc1874141dacc4/opt/libvterm-0.3.1.tar.gz;", "cmake.deps/CMakeLists.txt"], {cwd: reposPath});
    await exec("sed", ["-i", "", "-e", "s;https://www\\.leonerd\\.org\\.uk/code/libtermkey/libtermkey-0\\.22\\.tar\\.gz;https://github.com/neovim/deps/raw/aa004f1b2b6470a92363cba8e1cc1874141dacc4/opt/libtermkey-0.22.tar.gz;", "cmake.deps/CMakeLists.txt"], {cwd: reposPath});

    const env: {[key: string]: string} = {};
    Object.assign(env, process.env);

    const depsMakeLists = fs.readFileSync(path.join(reposPath, "cmake.deps", "CMakeLists.txt"), "utf-8");
    if (0 <= depsMakeLists.indexOf("USE_BUNDLED_LUAROCKS")) {
      await exec("bash", ["-c", "curl -s --retry 3 https://www.lua.org/ftp/lua-5.1.5.tar.gz | tar xz && cd lua-5.1.5 && make macosx && sudo make install"], {cwd: reposPath});
      await exec("bash", ["-c", "curl -s --retry 3 https://luarocks.github.io/luarocks/releases/luarocks-3.12.2.tar.gz | tar xz && cd luarocks-3.12.2 && ./configure && make && sudo make install"], {cwd: reposPath});
      await exec("bash", ["-c", "curl -s --retry 3 https://cmake.org/files/v3.20/cmake-3.20.0-macos-universal.tar.gz | tar xz"], {cwd: reposPath});
      env["PATH"] = `${reposPath}/cmake-3.20.0-macos-universal/CMake.app/Contents/bin:${env["PATH"] || ""}`;

      env["CMAKE_POLICY_VERSION_MINIMUM"] = "3.5";

      await exec("sudo", ["luarocks", "install", "LPeg"]);
      await exec("sudo", ["luarocks", "install", "LuaBitOp"]);
      await exec("sudo", ["luarocks", "install", "mpack"]);
      configureArgs.push(
        "DEPS_CMAKE_FLAGS=-DUSE_BUNDLED_DEPS=ON -DUSE_BUNDLED_LUAROCKS=OFF"
      );
    }

    await exec("make", configureArgs, {cwd: reposPath, env});
    await exec("make", ["install"], {cwd: reposPath, env});
  }
}
