import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as client from "cache/src/cacheHttpClient";
import * as tar from "cache/src/tar";
import {VimType} from "./interfaces";
import {TEMP_PATH} from "./temp";

const actionVersion = "1.0.1";

function makeKey(vimType: VimType, vimVersion: string): string {
  return `${actionVersion}-${process.platform}-${vimType}-${vimVersion}`;
}

export async function restore(vimType: VimType, vimVersion: string, targetDirectory: string): Promise<boolean> {
  const entry = await client.getCacheEntry([
    makeKey(vimType, vimVersion),
  ]);

  if (!entry?.archiveLocation) {
    core.info(`Cache not found for: ${vimVersion}`);
    return false;
  }
  core.info(`Cache found for: ${vimVersion}`);

  await io.mkdirP(TEMP_PATH);
  await io.mkdirP(targetDirectory);

  const archivePath = path.join(TEMP_PATH, "cache.tgz");
  await client.downloadCache(entry.archiveLocation, archivePath);
  await tar.extractTar(archivePath, targetDirectory);
  return true;
}

export async function save(vimType: VimType, vimVersion: string, targetDirectory: string): Promise<void> {
  const key = makeKey(vimType, vimVersion);
  const cacheId = await client.reserveCache(key);

  if (cacheId == -1) {
    core.info(`Unable to reserve cache for ${vimVersion}.`);
    core.debug(`key: ${key}.`);
    return;
  }

  const archivePath = path.join(TEMP_PATH, "cache.tgz");
  await tar.createTar(archivePath, targetDirectory);
  const filesize = fs.statSync(archivePath).size;
  core.debug(`Cache Key: ${key}`);
  core.debug(`Archive Size: ${filesize}`);
  if (1024 * 1024 * 400 < filesize) {
    core.warning(`Cache size of ~${Math.round(filesize / (1024 * 1024))} MB (${filesize} B) is over the 400MB limit, not saving cache.`);
    return;
  }
  await client.saveCache(cacheId, archivePath);
}
