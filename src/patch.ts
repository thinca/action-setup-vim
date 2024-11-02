import * as semver from "semver";
import {Buffer} from "buffer";
import {exec} from "@actions/exec";

export async function backportPatch(reposPath: string, vimVersion: string): Promise<void> {
  const vimSemver = semver.coerce(vimVersion, {loose: true});
  if (!vimSemver) {
    return;
  }

  if (semver.lt(vimSemver, "7.4.55")) {
    // To avoid `conflicting types for 'sigaltstack'`
    await exec("sh", ["-c", "curl -s https://github.com/vim/vim/compare/v7.4.054...v7.4.055.diff | git apply --exclude src/version.c"], {cwd: reposPath});
  }

  if (semver.lt(vimSemver, "8.2.1119")) {
    // Workaround:
    // Building Vim before v8.2.1119 on MacOS will fail because default Xcode was changed to 12.
    // https://github.com/actions/virtual-environments/commit/c09dca28df69d9aaaeac5635257d23722810d307#diff-7a1606bd717fc0cf55f9419157117d9ca306f91bd2fdfc294720687d7be1b2c7R220
    //
    // We should apply patch v8.2.1119 to src/auto/configure.
    const patch = `
--- a/src/auto/configure
+++ b/src/auto/configure
@@ -14143,8 +14143,8 @@ else
 main() {
   uint32_t nr1 = (uint32_t)-1;
   uint32_t nr2 = (uint32_t)0xffffffffUL;
-  if (sizeof(uint32_t) != 4 || nr1 != 0xffffffffUL || nr2 + 1 != 0) exit(1);
-  exit(0);
+  if (sizeof(uint32_t) != 4 || nr1 != 0xffffffffUL || nr2 + 1 != 0) return 1;
+  return 0;
 }
 _ACEOF
 if ac_fn_c_try_run "$LINENO"; then :
    `.trim() + "\n";
    await exec("patch", ["-p1"], {cwd: reposPath, input: Buffer.from(patch)});
  }
}
