import * as core from "@actions/core";
import {downloadTool} from "@actions/tool-cache";
import {Octokit} from "@octokit/rest";
import * as semver from "semver";
import {ActionError} from "../action_error";
import {FixedVersion, Installer, InstallType} from "../interfaces";

type TargetVersionResult = "skip" | "yes" | "done";

// semver disallow extra leading zero.
// v8.2.0000 -> v8.2.0
function adjustSemver(ver: string): string {
  return ver.replace(/\.0*(\d)/g, ".$1");
}

export function toSemver(ver: string): semver.SemVer | null {
  if (/^v?\d/.test(ver)) {
    return semver.coerce(adjustSemver(ver));
  }
  return null;
}

export abstract class ReleasesInstaller implements Installer {
  abstract readonly repository: string;
  abstract readonly assetNamePattern: RegExp;
  abstract getExecutableName(): string;
  abstract toSemverString(release: Octokit.ReposGetReleaseResponse): string;
  abstract async install(vimVersion: FixedVersion): Promise<void>;
  abstract getPath(vimVersion: FixedVersion): string;

  readonly installType = InstallType.download;
  readonly installDir: string;
  readonly isGUI: boolean;

  private _octokit?: Octokit;
  private releases: { [key: string]: Octokit.ReposGetReleaseResponse } = {};

  constructor(installDir: string, isGUI: boolean) {
    this.installDir = installDir;
    this.isGUI = isGUI;
  }

  canInstall(_version: string): boolean {
    return true;
  }

  async resolveVersion(vimVersion: string): Promise<FixedVersion> {
    const [release, actualVersion] = await this.findRelease(vimVersion);
    this.releases[actualVersion] = release;
    return actualVersion as FixedVersion;
  }

  async findRelease(vimVersion: string): Promise<[Octokit.ReposGetReleaseResponse, string]> {
    const [owner, repo] = this.repository.split("/");

    const isHead = vimVersion === "head";
    if (isHead) {
      let first = true;
      return await this.resolveVersionFromReleases(
        owner, repo,
        () => {
          if (first) {
            first = false;
            return "yes";
          }
          return "done";
        }
      );
    }

    const isLatest = vimVersion === "latest";
    if (isLatest) {
      const octokit = this.octokit();
      const {data: release} = await octokit.repos.getLatestRelease({owner, repo});
      return [release, release.tag_name];
    }

    const vimSemVer = toSemver(vimVersion);
    if (vimSemVer) {
      return await this.resolveVersionFromReleases(
        owner, repo,
        (release: Octokit.ReposGetReleaseResponse) => {
          const releaseVersion = this.toSemverString(release);
          const releaseSemver = toSemver(releaseVersion);
          if (!releaseSemver) {
            return "skip";
          }
          return semver.lte(vimSemVer, releaseSemver) ? "yes" : "done";
        }
      );
    } else {
      return await this.resolveVersionFromTag(owner, repo, vimVersion);
    }
  }

  private async resolveVersionFromReleases(
    owner: string,
    repo: string,
    getTargetVersion: (release: Octokit.ReposGetReleaseResponse) => TargetVersionResult,
  ): Promise<[Octokit.ReposGetReleaseResponse, string]> {
    const octokit = this.octokit();
    const listReleasesOptions = octokit.repos.listReleases.endpoint.merge({owner, repo});
    type Res = Octokit.ReposListReleasesResponse;
    const releases: Octokit.ReposGetReleaseResponse[] =
      await octokit.paginate(listReleasesOptions, ({data: releases}: {data: Res}, done) => {
        const targets = [];
        for (const release of releases) {
          if (release.assets.length === 0) {
            continue;
          }
          const result = getTargetVersion(release);
          if (result === "skip") {
            continue;
          }
          if (result === "yes") {
            targets.push(release);
          } else {
            done();
            break;
          }
        }
        return targets;
      });

    if (releases.length === 0) {
      throw new ActionError("Target release not found");
    }

    const targetRelease = releases[releases.length - 1];
    const targetVersion = await this.perpetuateVersion(owner, repo, targetRelease);
    return [targetRelease, targetVersion];
  }

  private async resolveVersionFromTag(owner: string, repo: string, tag: string): Promise<[Octokit.ReposGetReleaseResponse, string]> {
    const octokit = this.octokit();
    const {data: release} = await octokit.repos.getReleaseByTag({owner, repo, tag});
    const version = await this.perpetuateVersion(owner, repo, release);
    return [release, version];
  }

  private async perpetuateVersion(
    owner: string,
    repo: string,
    release: Octokit.ReposGetReleaseResponse,
  ): Promise<string> {
    const version = this.toSemverString(release);
    if (toSemver(version)) {
      return version;
    }

    // We assume not a semver tag is a symbolized tag (e.g. "stable", "nightly")
    const octokit = this.octokit();
    const {data: res} = await octokit.git.getRef({owner, repo, ref: `tags/${release.tag_name}`});
    const targetSha = res.object.sha;

    // It may be released as numbered version.
    // Only check the first page
    const {data: releases} = await octokit.repos.listReleases({owner, repo});
    for (const release of releases) {
      const {tag_name: tagName} = release;
      if (!toSemver(tagName)) {
        continue;
      }
      const {data: refRes} = await octokit.git.getRef({owner, repo, ref: `tags/${tagName}`});
      let sha = refRes.object.sha;
      if (refRes.object.type === "tag") {
        // eslint-disable-next-line @typescript-eslint/camelcase
        const {data: tagRes} = await octokit.git.getTag({owner, repo, tag_sha: sha});
        sha = tagRes.object.sha;
      }
      if (sha === targetSha) {
        return tagName;
      }
    }
    // Fallback: treats sha1 as version.
    return targetSha;
  }

  async downloadAsset(vimVersion: FixedVersion): Promise<string> {
    const release = this.releases[vimVersion];
    if (!release) {
      throw new ActionError(`Unknown version: ${vimVersion}`);
    }
    const asset = release.assets.find(asset => this.assetNamePattern.test(asset.name));
    if (!asset) {
      const assetNames = release.assets.map(asset => asset.name);
      throw new ActionError(`Target asset not found: /${this.assetNamePattern.source}/ in ${JSON.stringify(assetNames)}`);
    }
    const url = asset.browser_download_url;
    return await downloadTool(url);
  }

  private octokit(): Octokit {
    if (!this._octokit) {
      this._octokit = new Octokit({auth: core.getInput("github_token")});
    }
    return this._octokit;
  }
}
