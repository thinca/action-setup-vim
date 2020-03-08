import * as fs from "fs";
import * as path from "path";
import {exec} from "@actions/exec";
import * as io from "@actions/io";
import {FixedVersion} from "../interfaces";
import {VimBuildInstaller} from "./vim_build_installer";

export class WindowsVimBuildInstaller extends VimBuildInstaller {
  async install(vimVersion: FixedVersion): Promise<void> {
    const reposPath = await this.cloneVim(vimVersion);
    const srcPath = path.join(reposPath, "src");
    const batPath = path.join(srcPath, "install.bat");
    const guiOptions = this.isGUI ? "GUI=yes OLE=yes DIRECTX=yes" : "GUI=no OLE=no DIRECTX=no";
    fs.writeFileSync(batPath, `
    call "C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat" x64

    rem Suppress progress animation
    sed -e "s/@<<$/@<< | sed -e 's#.*\\\\r.*##'/" Make_mvc.mak > Make_mvc2.mak

    nmake -nologo -f Make_mvc2.mak ${guiOptions} FEATURES=HUGE IME=yes MBYTE=yes ICONV=yes DEBUG=no TERMINAL=yes

    copy /Y ..\\README.txt ..\\runtime
    copy /Y ..\\vimtutor.bat ..\\runtime
    copy /Y *.exe ..\\runtime
    copy /Y tee\\*.exe ..\\runtime
    copy /Y xxd\\*.exe ..\\runtime
    `);
    await exec("cmd.exe", ["/c", batPath], {cwd: srcPath});
    await io.mkdirP(this.installDir);
    const runtime = path.join(reposPath, "runtime");
    await io.cp(runtime, this.getPath(vimVersion), {recursive: true});
  }

  getPath(vimVersion: FixedVersion): string {
    const matched = /^v(\d+)\.(\d+)/.exec(vimVersion);
    const vimDir = matched ? `vim${matched[1]}${matched[2]}` : "runtime";
    return path.join(this.installDir, vimDir);
  }
}
