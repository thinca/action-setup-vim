import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import * as cache from "@actions/cache";
import {downloadTool} from "@actions/tool-cache";
import {Octokit, RestEndpointMethodTypes} from "@octokit/rest";
import semverCoerce = require("semver/functions/coerce");
import semverLte = require("semver/functions/lte");
import {SemVer} from "semver";
import {ActionError} from "../action_error";
import {FixedVersion, Installer, InstallType} from "../interfaces";
import {TEMP_PATH} from "../temp";

export type Release = RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"][number];

// semver disallow extra leading zero.
// v8.2.0000 -> v8.2.0
function adjustSemver(ver: string): string {
  return ver.replace(/\.0*(\d)/g, ".$1");
}

export function toSemver(ver: string): SemVer | null {
  if (/^v?\d/.test(ver)) {
    return semverCoerce(adjustSemver(ver));
  }
  return null;
}

export abstract class ReleasesInstaller implements Installer {
  abstract readonly repository: string;
  abstract readonly assetNamePatterns: RegExp[];
  abstract getExecutableName(): string;
  abstract toSemverString(release: Release): string;
  abstract async install(vimVersion: FixedVersion): Promise<void>;
  abstract getPath(vimVersion: FixedVersion): string;

  readonly installType = InstallType.download;
  readonly installDir: string;
  readonly isGUI: boolean;

  private _octokit?: Octokit;
  private releases: { [key: string]: Release } = {};

  constructor(installDir: string, isGUI: boolean) {
    this.installDir = installDir;
    this.isGUI = isGUI;
  }

  canInstall(_version: string): boolean {
    return true;
  }

  async resolveVersion(vimVersion: string): Promise<FixedVersion> {
    const [owner, repo] = this.repository.split("/");
    this.releases = await this.fetchReleases(owner, repo);

    const release = await this.findRelease(vimVersion);
    const actualVersion = await this.perpetuateVersion(owner, repo, release);
    this.releases[actualVersion] = release;
    return actualVersion as FixedVersion;
  }

  private async findRelease(vimVersion: string): Promise<Release> {
    const isHead = vimVersion === "head";
    if (isHead) {
      return this.releases.head;
    }

    const isLatest = vimVersion === "latest";
    if (isLatest) {
      return Object
        .values(this.releases)
        .filter((release) => !release.draft && !release.prerelease)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    }

    const vimSemVer = toSemver(vimVersion);
    if (vimSemVer) {
      let targetRelease: Release | undefined = undefined;
      for (const release of Object.values(this.releases).sort((a, b) => b.created_at.localeCompare(a.created_at))) {
        const releaseVersion = this.toSemverString(release);
        const releaseSemver = toSemver(releaseVersion);
        if (!releaseSemver) {
          continue;
        }
        if (semverLte(vimSemVer, releaseSemver)) {
          targetRelease = release;
        } else {
          break;
        }
      }
      if (!targetRelease) {
        throw new ActionError("Target release not found");
      }
      return targetRelease;
    } else {
      return this.releases[vimVersion];
    }
  }

  private async fetchReleases(
    owner: string,
    repo: string,
  ): Promise<{ [key: string]: Release }> {
    let releases: { [key: string]: Release } = {};

    const cachePath = path.join(TEMP_PATH, `release-cache-${this.repository.replace(/^.+\//, "")}.json`);
    const restoreKey = `releases--${this.repository}--`;
    const cacheExists = await cache.restoreCache([cachePath], restoreKey, [restoreKey]);
    if (cacheExists) {
      releases = JSON.parse(fs.readFileSync(cachePath, {encoding: "utf8"})) as {string: Release};
    }

    let updated = false;
    const octokit = this.octokit();
    fetching:
    for await (const {data: resReleases} of octokit.paginate.iterator(octokit.repos.listReleases, {owner, repo})) {
      for (const release of resReleases) {
        if (release.assets.length === 0) {
          continue;
        }
        if (releases[release.tag_name]) {
          break fetching;
        } else {
          releases[release.tag_name] = release;
          if (!updated) {
            releases.head = release;
            updated = true;
          }
        }
      }
    }

    if (updated) {
      fs.writeFileSync(cachePath, JSON.stringify(releases));
      try {
        await cache.saveCache([cachePath], `releases--${this.repository}--${Object.keys(releases).length}`);
      } catch (e) {
        if (e instanceof cache.ReserveCacheError) {
          core.debug(`Error while caching releases: ${e.name}: ${e.message}`);
        } else {
          throw e;
        }
      }
    }

    return releases;
  }

  private async perpetuateVersion(
    owner: string,
    repo: string,
    release: Release,
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
    const asset = this.assetNamePatterns.map(pattern => release.assets.find(asset => pattern.test(asset.name))).find(v => v);
    if (!asset) {
      const assetNames = release.assets.map(asset => asset.name);
      throw new ActionError(`Target asset not found: /${this.assetNamePatterns.map(p => p.source).join("|")}/ in ${JSON.stringify(assetNames)}`);
    }
    const url = asset.browser_download_url;
    const dest = path.join(TEMP_PATH, this.repository, vimVersion, asset.name);
    return await downloadTool(url, dest);
  }

  private octokit(): Octokit {
    if (!this._octokit) {
      this._octokit = new Octokit({auth: core.getInput("github_token")});
    }
    return this._octokit;
  }
}
