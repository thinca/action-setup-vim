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

    // Build fails with Xcode 11.1 (default)
    await exec("make", ["CMAKE_BUILD_TYPE=RelWithDebInfo", "MACOSX_DEPLOYMENT_TARGET=10.14", `CMAKE_EXTRA_FLAGS=-DCMAKE_INSTALL_PREFIX=${this.installDir}`], {cwd: reposPath});
    await exec("make", ["install"], {cwd: reposPath});
  }
}
