import {ReleasesInstaller, Release, toSemver} from "./releases_installer";

export abstract class SemverReleasesInstaller extends ReleasesInstaller {
  toSemverString(release: Release): string {
    return release.tagName;
  }

  canInstall(version: string): boolean {
    const ver = toSemver(version);
    const avail = toSemver(this.availableVersion);
    return !ver || !avail || ver.compare(avail) >= 0;
  }
}
