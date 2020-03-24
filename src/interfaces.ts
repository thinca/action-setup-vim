enum FixedVersionBrand {}

export type FixedVersion = FixedVersionBrand & string;

export interface Installer {
  readonly installType: InstallType;
  readonly installDir: string;
  readonly isGUI: boolean;
  getExecutableName(): string;
  canInstall(vimVersion: string): boolean;
  resolveVersion(vimVersion: string): Promise<FixedVersion>;
  install(vimVersion: FixedVersion): Promise<void>;
  getPath(vimVersion: FixedVersion): string;
}

export const InstallType = {
  build: "build",
  download: "download",
} as const;
export type InstallType = typeof InstallType[keyof typeof InstallType];

export const VimType = {
  vim: "vim",
  neovim: "neovim",
  macvim: "macvim",
} as const;
export type VimType = typeof VimType[keyof typeof VimType];

export function isVimType(maybeVimType: string): maybeVimType is VimType {
  return 0 <= Object.keys(VimType).indexOf(maybeVimType);
}
