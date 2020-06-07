import {ReleasesInstaller, Release} from "./releases_installer";

export abstract class SemverReleasesInstaller extends ReleasesInstaller {
  toSemverString(release: Release): string {
    return release.tag_name;
  }
}
