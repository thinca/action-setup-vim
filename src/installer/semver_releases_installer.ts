import {ReleasesInstaller} from "./releases_installer";
import {Octokit} from "@octokit/rest";

export abstract class SemverReleasesInstaller extends ReleasesInstaller {
  toSemverString(release: Octokit.ReposGetReleaseResponse): string {
    return release.tag_name;
  }
}
