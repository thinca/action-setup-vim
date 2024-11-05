import * as path from "path";
import {exec} from "@actions/exec";
import * as io from "@actions/io";
import {BuildInstaller} from "./build_installer";
import {execGit} from "../commands";
import {FixedVersion} from "../interfaces";
import {backportPatch} from "../patch";
import {Buffer} from "buffer";
import * as semver from "semver";

export class MacVimBuildInstaller extends BuildInstaller {
  readonly repository = "macvim-dev/macvim";
  readonly tags: { [key: string]: string } = {};

  getExecutableName(): string {
    return "vim";
  }

  async obtainFixedVersion(vimVersion: string): Promise<string> {
    const log = await execGit(["log", "-20", "--format=format:%s"], {cwd: this.repositoryPath(vimVersion)});
    const matched = /^\s*(?:patch|updated for version)\s+v?(\d+\.\d+\.\d+)/m.exec(log);
    if (matched) {
      const version = `v${matched[1]}`;
      const tag = await super.obtainFixedVersion(vimVersion);
      this.tags[version] = tag;
      return version;
    }
    return "";
  }

  async install(vimVersion: FixedVersion): Promise<void> {
    await exec("xcode-select", ["-p"]);
    const tag = this.tags[vimVersion] || vimVersion;
    const reposPath = await this.cloneVim(tag);
    await backportPatch(reposPath, vimVersion);

    // To avoid `sed: RE error: illegal byte sequence` error, should set 'LC_ALL=C'.
    process.env.LC_ALL = "C";

    const args: string[] = [];
    if (semver.lte(vimVersion, "8.2.2127", true)) {
      // Build only x86_64 arch since Sparkle.framework < 1.24.0 doesn't support Apple Silicon.
      if (semver.lte(vimVersion, "8.2.2013", true)) {
        args.push("--with-macarchs=x86_64");
      }

      // Fix broken "--with-macarchs" flag.
      const patch = `
--- a/src/auto/configure
+++ b/src/auto/configure
@@ -4758,7 +4758,7 @@ fi
 $as_echo_n "checking if architectures are supported... " >&6; }
     save_cflags="$CFLAGS"
     save_ldflags="$LDFLAGS"
-    archflags=\`echo "$ARCHS" | sed -e 's/[[:<:]]/-arch /g'\`
+    archflags=\`echo "$ARCHS" | sed 's/[[:>:]][ ][ ]*[[:<:]]/ -arch /g' | sed 's/^/-arch /g'\`
     CFLAGS="$CFLAGS $archflags"
     LDFLAGS="$LDFLAGS $archflags"
     cat confdefs.h - <<_ACEOF >conftest.$ac_ext
      `.trim() + "\n";
      await exec("patch", ["-p1"], {cwd: reposPath, input: Buffer.from(patch)});
    }

    if (semver.lte(vimVersion, "8.2.5135", true)) {
      args.push("CFLAGS=-Wno-implicit-int");
    }

    await exec("./configure", args, {cwd: reposPath});
    await exec("make", [], {cwd: reposPath});
    await io.mkdirP(this.installDir);
    await io.cp(path.join(reposPath, "src", "MacVim", "build", "Release", "MacVim.app"), this.installDir, {recursive: true});
  }

  getPath(): string {
    return path.join(this.installDir, "MacVim.app", "Contents", "bin");
  }
}
