import * as semver from "semver";
import {Buffer} from "buffer";
import {exec} from "@actions/exec";

export async function backportPatch(reposPath: string, vimVersion: string): Promise<void> {
  const vimSemver = semver.coerce(vimVersion, {loose: true});
  if (!vimSemver) {
    return;
  }

  if (process.platform === "win32") {
    await backportPatchForWindows(reposPath, vimSemver, vimVersion);
  }
  if (process.platform === "darwin") {
    await backportPatchForMacOS(reposPath, vimSemver);
  }
}

export async function backportPatchForWindows(reposPath: string, vimVersion: semver.SemVer, vimVersionString: string): Promise<void> {
  if (semver.lt(vimVersion, "7.4.960")) {
    await exec("sh", ["-c", `curl -s https://github.com/vim/vim/compare/${vimVersionString}...v7.4.960.diff | git apply --include src/Make_mvc.mak`], {cwd: reposPath});
    if (semver.lt(vimVersion, "7.4.399")) {
      // After patch 7.4.399, `crypt` files are separeted.
      await exec("sed", ["-i", "/crypt/d", "src/Make_mvc.mak"], {cwd: reposPath});
    }
  }

  if (semver.lt(vimVersion, "8.0.881")) {
    // Apply patch 8.0.0881.
    // We use Vim to apply this patch because it is difficult with `git apply` or `sed`.
    const script =`
:e src/GvimExt/Makefile
/^!include <Win32.mak>
:.-1,.d
:i
!elseif "$(USE_WIN32MAK)"=="yes"
!include <Win32.mak>
!else
cc = cl
link = link
rc = rc
cflags = -nologo -c
lflags = -incremental:no -nologo
rcflags = /r
olelibsdll = ole32.lib uuid.lib oleaut32.lib user32.lib gdi32.lib advapi32.lib
.
:w
:e src/Make_mvc.mak
/^!include <Win32.mak>
:.-1,.d
:i
!elseif "$(USE_WIN32MAK)"=="yes"
!include <Win32.mak>
!else
link = link
.
:wq
`;
    await exec("vim", ["-es"], {cwd: reposPath, input: Buffer.from(script), ignoreReturnCode: true});
  }
}

export async function backportPatchForMacOS(reposPath: string, vimSemver: semver.SemVer): Promise<void> {
  if (semver.lt(vimSemver, "7.4.55")) {
    // To avoid `conflicting types for 'sigaltstack'`
    await exec("sh", ["-c", "curl -s https://github.com/vim/vim/compare/v7.4.054...v7.4.055.diff | git apply --exclude src/version.c"], {cwd: reposPath});
  }

  if (semver.lt(vimSemver, "7.4.1648")) {
    // Vim crashes causes by `Trace/BPT trap: 5` on MacOS.
    // Apply patch 7.4.1648.
    // Cannot use `git apply` because of context mismatch.
    await exec("sed", ["-i", "", "-e", "/#define VV_NAME/s/, {0}$//", "-e", "/static struct vimvar/,+4s/dictitem_T/dictitem16_T/;/char[[:blank:]]*vv_filler.*/d", "src/eval.c"], {cwd: reposPath});
    await exec("sed", ["-i", "", "/typedef struct dictitem_S dictitem_T;/a\\\nstruct dictitem16_S {\\\n  typval_T di_tv;\\\n  char_u di_flags;\\\n  char_u di_key[17];\\\n};\\\ntypedef struct dictitem16_S dictitem16_T;", "src/structs.h"], {cwd: reposPath});
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
