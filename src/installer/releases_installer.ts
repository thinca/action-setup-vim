import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as cache from "@actions/cache";
import {downloadTool} from "@actions/tool-cache";
import {graphql} from "@octokit/graphql";
import {RequestParameters} from "@octokit/graphql/dist-types/types";
import {ActionError} from "../action_error";
import {FixedVersion, Installer, InstallType} from "../interfaces";
import {TEMP_PATH} from "../temp";

const RELEASES_QUERY = `
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    releases(first: 100, orderBy: {direction: DESC, field: CREATED_AT}, after: $cursor) {
      edges {
        node {
          description
          isLatest
          releaseAssets(first: 20) {
            edges {
              node {
                name
                downloadUrl
              }
            }
          }
          tagCommit {
            oid
          }
          tagName
          updatedAt
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}`;

export type Release = {
  description: string;
  isLatest: boolean;
  releaseAssets: {
    edges: {
      node: {
        name: string;
        downloadUrl: string;
      };
    }[];
  };
  tagCommit: {
    oid: string;
  };
  tagName: string;
  updatedAt: string;
}

type Response = {
  repository: {
    releases: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      }
      edges: {
        node: Release;
      }[];
    };
  };
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U> ? Array<DeepPartial<U>> : DeepPartial<T[P]>;
}

export function toSemver(ver: string): semver.SemVer | null {
  if (/^v?\d/.test(ver)) {
    return semver.coerce(ver, {loose: true});
  }
  return null;
}

export abstract class ReleasesInstaller implements Installer {
  abstract readonly repository: string;
  abstract readonly assetNamePatterns: RegExp[];
  abstract getExecutableName(): string;
  abstract toSemverString(release: Release): string;
  abstract install(vimVersion: FixedVersion): Promise<void>;
  abstract getPath(vimVersion: FixedVersion): string;

  readonly availableVersion: string = "";
  readonly installType = InstallType.download;
  readonly installDir: string;
  readonly isGUI: boolean;

  private release?: Release;
  private releases: Release[] = [];

  constructor(installDir: string, isGUI: boolean) {
    this.installDir = installDir;
    this.isGUI = isGUI;
  }

  canInstall(_version: string): boolean {
    return true;
  }

  async resolveVersion(vimVersion: string): Promise<FixedVersion> {
    this.releases = await this.fetchReleases();
    this.release = this.findRelease(vimVersion);
    const actualVersion = this.perpetuateVersion();
    return actualVersion as FixedVersion;
  }

  private async fetchReleases(): Promise<Release[]> {
    const [owner, repo] = this.repository.split("/");
    const parameters: RequestParameters = {
      owner: owner,
      repo: repo,
      headers: {
        authorization: `bearer ${core.getInput("github_token")}`,
      },
      // We can remove this when update Node.js to v18 or upper.
      request: {
        fetch,
      },
    };

    let releases: Release[] = [];
    const newReleases: Release[] = [];

    const availableVersion = toSemver(this.availableVersion) ?? this.availableVersion;

    const cachePath = path.join(TEMP_PATH, `release-cache-${repo}.json`);
    let cacheKey = "";

    fetching:
    for (;;) {
      const {repository}: DeepPartial<Response> = await graphql(RELEASES_QUERY, parameters);
      const resReleases = (repository?.releases?.edges?.map(node => node.node) || []) as Release[];

      // First time.
      if (newReleases.length === 0) {
        const newestRelease = resReleases[0];
        if (newestRelease == null) {
          return [];
        }
        cacheKey = `releases-${this.repository}-${newestRelease.updatedAt}`;
        core.debug(`[releases] Cache key: ${cacheKey}`);
        const hitCacheKey = await cache.restoreCache([cachePath], cacheKey, [`releases-${this.repository}-`]);
        const cacheHit = hitCacheKey === cacheKey;
        core.debug(`[releases] Cache ${cacheHit ? "" : "not "}hit`);
        // Complete cache exists: `cacheExists == true`
        // Incomplete cache exists: `cacheExists == false` but the cache is restored.
        // Cache does not exist: `cacheExists == false` and the cache is not restored.
        if (fs.existsSync(cachePath)) {
          releases = JSON.parse(fs.readFileSync(cachePath, {encoding: "utf8"})) as Release[];
          core.debug(`[releases] Cache load: ${releases.length}`);
          core.debug(`[releases] Head of cache: ${JSON.stringify(releases[0])}`);
        }

        if (cacheHit) {
          return releases;
        }
      }

      for (const release of resReleases) {
        if (release.releaseAssets.edges.length === 0) {
          continue;
        }
        if (releases[0]?.tagName === release.tagName) {
          if (releases[0]?.tagCommit.oid === release.tagCommit?.oid) {
            // Reach to the head of incomplete cache.
            break fetching;
          }
          // if A.tagCommit.oid != B.tagCommit.oid thouth A.tagName == B.tagName,
          // presume that the tag commit was updated and so remove the old release.
          // e.g. "nightly" and "stable" tags
          releases.shift();
        }
        newReleases.push(release);
        if (availableVersion) {
          if (availableVersion instanceof semver.SemVer) {
            if ((toSemver(release.tagName)?.compare(availableVersion) ?? 1) <= 0) {
              break fetching;
            }
          } else if (release.tagName === availableVersion) {
            break fetching;
          }
        }
      }
      const pageInfo = repository?.releases?.pageInfo;
      if (!pageInfo?.hasNextPage) {
        break;
      }
      parameters.cursor = pageInfo?.endCursor;
    }

    releases = newReleases.concat(releases);
    fs.writeFileSync(cachePath, JSON.stringify(releases));
    try {
      core.debug(`[releases] Save the cache: ${releases.length}`);
      await cache.saveCache([cachePath], cacheKey);
    } catch (e) {
      if (e instanceof cache.ReserveCacheError) {
        core.error(`Error while caching releases: ${e.name}: ${e.message}`);
      } else {
        throw e;
      }
    }

    return releases;
  }

  private findRelease(vimVersion: string): Release | undefined {
    const isHead = vimVersion === "head";
    if (isHead) {
      return this.releases[0];
    }

    const isLatest = vimVersion === "latest";
    if (isLatest) {
      return this.releases.find(release => release.isLatest);
    }

    const vimSemVer = toSemver(vimVersion);
    if (!vimSemVer) {
      return this.releases.find(release => release.tagName === vimVersion);
    }

    const releases = this.releases.filter((release) => {
      const releaseVersion = this.toSemverString(release);
      const releaseSemver = toSemver(releaseVersion);
      return releaseSemver && semver.lte(vimSemVer, releaseSemver);
    });
    return releases.pop();
  }

  private perpetuateVersion(): string {
    const release = this.release;
    if (!release) {
      throw new ActionError("Target release not found");
    }

    const version = this.toSemverString(release);
    if (toSemver(version)) {
      return version;
    }

    // We assume not a semver tag is a symbolized tag (e.g. "stable", "nightly")
    const targetSha = release.tagCommit.oid;

    // It may be released as numbered version.
    // Only check the first page
    for (const release of this.releases.slice(0, 10)) {
      const {tagName} = release;
      if (!toSemver(tagName)) {
        continue;
      }
      const sha = release.tagCommit.oid;
      if (sha === targetSha) {
        return tagName;
      }
    }
    // Fallback: treats sha1 as version.
    return targetSha;
  }

  async downloadAsset(vimVersion: FixedVersion): Promise<string> {
    const release = this.release;
    if (!release) {
      throw new ActionError(`Unknown version: ${vimVersion}`);
    }
    const releaseAssets = release.releaseAssets.edges.map(node => node.node);
    const asset = this.assetNamePatterns.map(pattern => releaseAssets.find(asset => pattern.test(asset.name))).find(v => v);
    if (!asset) {
      const assetNames = releaseAssets.map(asset => asset.name);
      throw new ActionError(`Target asset not found: /${this.assetNamePatterns.map(p => p.source).join("|")}/ in ${JSON.stringify(assetNames)}`);
    }
    const url = asset.downloadUrl;
    const dest = path.join(TEMP_PATH, this.repository, vimVersion, asset.name);
    return await downloadTool(url, dest);
  }
}
