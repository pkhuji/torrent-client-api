import { QBittorent } from './clients/qbittorrent.mjs';
import { Deluge } from './clients/deluge.mjs';
import { RTorrent } from './clients/rtorrent.mjs';
import { Transmission } from './clients/transmission.mjs';
import { UTorrent } from './clients/utorrent.mjs';
import { isString, ensureURLProtocol, isNumber, isValidURL, throwError, sanitizeFilename, objectsToArrays, getNestedProps, isArray, arraysToObjects, getUnixTimestampInS, isArrayFull, isStringFullTrimmed, includesNoCase, stringIncludesAll, sortObjects, removeFromStart, isStringFull, removeLastPathSep, removeFirstPathSep, getPathDepth, splitPath, sleepMsPromise } from './common-utils/js-utils.mjs';
import { clientTypes, filters, allStatus, tFields, hashesToArray, tfFields } from './helpers.mjs';
export { matchPreferences as matchClientPreferences } from './helpers.mjs';
import { isPathAbsolute, replacePathSepToOS, ensurePath, saveAsJson, readJsonFile, deleteFileIfExists, pathsToTree, isChildOfParentDir, isPathsEqualByOS } from './common-utils/node-utils.mjs';
import { URL } from 'url';
import { join } from 'path';

class TorrentClientApi {
  #client;
  #clientType;
  #host;
  #memCacheTimeout;
  #memCacheTimer;
  #memCache;
  #tFiles = {};
  #tPath;
  #saveToDisk;
  #dataDir;
  #hashesForFileSave;
  constructor({
    clientType,
    baseUrl,
    apiPath,
    username,
    password,
    timeoutS = 5,
    agent,
    xmlrpc,
    memCacheTimeout = 60,
    cacheDir,
  }) {
    if (isString(baseUrl)) {
      baseUrl = ensureURLProtocol(baseUrl, "http://");
    }
    if (
      !Object.values(clientTypes).includes(clientType) ||
      !isNumber(timeoutS) ||
      timeoutS < 1 ||
      !isValidURL(baseUrl) ||
      !isNumber(memCacheTimeout) ||
      memCacheTimeout < 1 ||
      !isPathAbsolute(cacheDir)
    ) {
      throwError([
        "ade85a17-7be2-4791-9175-fcc572ea4429",
        clientType,
        clientTypes,
        baseUrl,
        timeoutS,
        memCacheTimeout,
        cacheDir,
      ]);
    }
    if (!isString(username)) {
      username = "";
    }
    if (!isString(password)) {
      password = "";
    }
    const clientConfig = {
      agent,
      baseUrl,
      timeoutS,
      apiPath,
      username,
      password,
      xmlrpc,
    };
    if (clientType === clientTypes.qBittorent) {
      this.#client = new QBittorent(clientConfig);
    } else if (clientType === clientTypes.deluge) {
      this.#client = new Deluge(clientConfig);
    } else if (clientType === clientTypes.uTorrent) {
      this.#client = new UTorrent(clientConfig);
    } else if (clientType === clientTypes.rTorrent) {
      throwError([
        "609b0cee-089e-4455-bf5c-5422180feec6",
        "rTorrent Incomplete",
      ]);
      this.#client = new RTorrent(clientConfig);
    } else if (clientType === clientTypes.transmission) {
      this.#client = new Transmission(clientConfig);
    }
    this.#clientType = clientType;
    this.#memCacheTimeout = memCacheTimeout;
    this.#host = new URL(baseUrl).host;
    this.#dataDir = cacheDir;
    this.#tPath = replacePathSepToOS(
      join(cacheDir, sanitizeFilename(this.#host + "-" + clientType, "-"))
    );
  }
  get clientType() {
    return this.#clientType;
  }
  get host() {
    return this.#host || "";
  }
  async getAppVersion() {
    return (await this.#client.getAppVersion()) + "";
  }
  async getApiVersion() {
    return (await this.#client.getApiVersion()) + "";
  }
  async getPreferences(onlyKeys) {
    let prefs = await this.#client.getPreferences();
    if (onlyKeys) {
      if (this.clientType === clientTypes.uTorrent) {
        prefs = prefs.map((s) => s[0]);
      } else {
        prefs = Object.keys(prefs);
      }
    }
    return prefs;
  }
  setPreferences(preferences) {
    return this.#client.setPreferences(preferences);
  }
  clearTimers() {
    this.#setMemCacheTimer(true);
  }
  async #clearMemCache() {
    if (this.#saveToDisk) {
      let { torrents } = this.#memCache;
      torrents = objectsToArrays(torrents, tFields);
      try {
        await ensurePath(this.#tPath, true);
        await saveAsJson(
          { ...this.#memCache, torrents },
          this.#tPath,
          false,
          true
        );
        this.#saveToDisk = false;
      } catch {}
    }
    await this.#saveTorrentFiles();
    this.#memCache = null;
    this.#memCacheTimer = null;
    this.#tFiles = {};
  }
  #setMemCacheTimer(clear) {
    if (this.#memCacheTimer) {
      clearTimeout(this.#memCacheTimer);
      this.#memCacheTimer = null;
    }
    if (clear) {
      return;
    }
    this.#memCacheTimer = setTimeout(
      this.#clearMemCache.bind(this),
      this.#memCacheTimeout * 1000
    );
  }
  async #restoreMemCache() {
    if (this.#memCache) {
      return;
    }
    let fileData;
    try {
      fileData = await readJsonFile(this.#tPath);
    } catch {
      return;
    }
    let { torrents, timestampS } = getNestedProps(fileData, [
      "torrents",
      "timestampS",
    ]);
    if (!isArray(torrents) || !isNumber(timestampS)) {
      return;
    }
    torrents = arraysToObjects(torrents, tFields);
    this.#memCache = { torrents, timestampS };
  }
  async #fillMemCache(fresh) {
    this.#setMemCacheTimer(true);
    if (!fresh) {
      await this.#restoreMemCache();
    }
    if (!this.#memCache || fresh) {
      let torrents;
      try {
        torrents = this.#client.normalizeTorrents(
          await this.#client.getTorrents()
        );
        this.#saveToDisk = true;
        await deleteFileIfExists(this.#tPath);
      } catch {}
      if (torrents) {
        this.#memCache = { torrents, timestampS: getUnixTimestampInS() };
      } else {
        if (!this.#memCache) {
          this.#memCache = { torrents: [], timestampS: getUnixTimestampInS() };
        }
      }
    }
    this.#setMemCacheTimer();
  }
  #sortAndFilter({
    hashes,
    filter,
    sort,
    reverse,
    searchTerm,
    perPage,
    currentPage,
  }) {
    if (!this.#memCache) {
      return;
    }
    let { torrents, timestampS } = this.#memCache;
    if (!isArrayFull(hashes)) {
      hashes = null;
    }
    let hasSearchTerm = isStringFullTrimmed(searchTerm);
    if (hasSearchTerm) {
      searchTerm = searchTerm.split(/\s/).filter((s) => s !== "");
    }
    torrents = torrents.filter((s) => {
      if (hashes && !includesNoCase(hashes, s.hash || s.hashV2)) {
        return false;
      }
      if (
        hasSearchTerm &&
        !stringIncludesAll(
          [s.name, s.hash || "", s.hashV2 || ""].join(" "),
          searchTerm,
          false
        )
      ) {
        return false;
      }
      if (filter) {
        let { status, isFinished } = s;
        if (filter === filters.checking && status !== allStatus.checking) {
          return false;
        } else if (filter === filters.stopped && status !== allStatus.stopped) {
          return false;
        } else if (
          filter === filters.downloading &&
          status !== allStatus.downloading
        ) {
          return false;
        } else if (filter === filters.seeding && status !== allStatus.seeding) {
          return false;
        } else if (filter === filters.error && status !== allStatus.error) {
          return false;
        } else if (
          filter === filters.running &&
          !(status == allStatus.downloading || status == allStatus.seeding)
        ) {
          return false;
        } else if (filter === filters.completed && !isFinished) {
          return false;
        } else if (filter === filters.incomplete && isFinished) {
          return false;
        }
      }
      return true;
    });
    if (!tFields.includes(sort)) {
      sort = "position";
    }
    torrents = sortObjects(torrents, sort, reverse ? "d" : "a");
    return {
      hashes,
      sort,
      timestampS,
      total: torrents.length,
      ...this.#paginate({ torrents, perPage, currentPage }),
    };
  }
  #paginate({ torrents, perPage, currentPage }) {
    if (!isNumber(perPage) || perPage < 1) {
      return {
        torrents,
        perPage,
        currentPage,
      };
    }
    if (!isNumber(currentPage) || currentPage < 1) {
      currentPage = 1;
    }
    let offset = (currentPage - 1) * perPage;
    let end = offset + perPage;
    return {
      torrents: torrents.slice(offset, end),
      perPage,
      currentPage,
    };
  }
  async getTorrents({
    hashes,
    filter,
    sort,
    reverse,
    searchTerm,
    raw,
    perPage,
    currentPage,
    fresh,
  } = {}) {
    if (raw) {
      let torrents = await this.#client.getTorrents().catch(() => []);
      let res = this.#paginate({ torrents, perPage, currentPage });
      return { ...res, timestampS: getUnixTimestampInS() };
    }
    await this.#fillMemCache(fresh);
    let result = this.#sortAndFilter({
      hashes,
      filter,
      sort,
      reverse,
      searchTerm,
      perPage,
      currentPage,
    });
    return {
      filter,
      reverse,
      searchTerm,
      fresh,
      ...result,
    };
  }
  async #saveTorrentFiles() {
    if (!isArray(this.#hashesForFileSave)) {
      return;
    }
    try {
      await ensurePath(this.#dataDir, false);
    } catch {}

    for (let h of this.#hashesForFileSave) {
      if (!this.#tFiles[h]) {
        continue;
      }
      let { files } = this.#tFiles[h];
      files = objectsToArrays(files, tfFields);
      try {
        await saveAsJson(
          { ...this.#tFiles[h], files },
          this.#getFilesCachePath(h),
          false,
          true
        );
      } catch {}
    }
    this.#hashesForFileSave = null;
  }
  #getFilesCachePath(hash) {
    return join(this.#dataDir, hash + "-" + this.#clientType);
  }
  async #deleteFilesCache(hash) {
    try {
      await deleteFileIfExists(this.#getFilesCachePath(hash));
    } catch {}
  }
  async #restoreTorrentFiles(hash) {
    if (this.#tFiles[hash]) {
      return;
    }
    let fileData;
    try {
      fileData = await readJsonFile(this.#getFilesCachePath(hash));
    } catch {
      return;
    }
    let f = getNestedProps(fileData, ["files", "timestampS", "hash"]);
    if (!isArray(f.files) || !isNumber(f.timestampS) || f.hash !== hash) {
      return;
    }
    this.#tFiles[hash] = {
      files: arraysToObjects(f.files, tfFields),
      timestampS: f.timestampS,
      hash,
    };
  }
  #clearOldTorrentFiles() {
    let values = Object.values(this.#tFiles);
    if (values.length < 10) {
      return;
    }
    sortObjects(values, "timestampS", "d");
    values = removeFromStart(values, 5);
    for (let s of values) {
      delete this.#tFiles[s.hash];
    }
  }
  async #fillTorrentFiles(hash, fresh) {
    this.#setMemCacheTimer(true);
    if (!fresh) {
      await this.#restoreTorrentFiles(hash);
    }
    let data = this.#tFiles[hash];
    if (!data || fresh) {
      let files;
      try {
        files = this.#client.normalizeTorrentFiles(
          await this.#client.getTorrentFiles(hash)
        );
        (this.#hashesForFileSave = this.#hashesForFileSave || []).push(hash);
        await this.#deleteFilesCache(hash);
      } catch {}
      if (files) {
        data = { timestampS: getUnixTimestampInS(), files, hash };
      } else {
        if (!data) {
          data = { timestampS: getUnixTimestampInS(), files: [], hash };
        }
      }
      this.#tFiles[hash] = data;
    }
    this.#clearOldTorrentFiles();
    this.#setMemCacheTimer();
  }
  async getTorrentFiles(hash, { asTree, raw, fresh } = {}) {
    if (!isStringFull(hash)) {
      throwError(["fd75a39c-beef-4323-8b8a-c7c9bf644d36", hash]);
    }
    if (raw) {
      return {
        files: await this.#client.getTorrentFiles(hash).catch(() => []),
        timestampS: getUnixTimestampInS(),
      };
    }
    await this.#fillTorrentFiles(hash, fresh);
    let { files, timestampS } = this.#tFiles[hash];
    if (asTree) {
      files = pathsToTree(files, "path");
    }
    return { files, timestampS, hash, count: files.length };
  }
  startTorrents(hashes) {
    // hashes = hashesToArray(hashes);
    // if (!isArrayFull(hashes)) {
    //   return false;
    // }
    return this.#client.startTorrents(hashes);
  }
  stopTorrents(hashes) {
    // hashes = hashesToArray(hashes);
    // if (!isArrayFull(hashes)) {
    //   return false;
    // }
    return this.#client.stopTorrents(hashes);
  }
  setTorrentUploadSpeed(hashes, limitKbps) {
    hashes = hashesToArray(hashes);
    if (!isArrayFull(hashes)) {
      return false;
    }
    if (!isNumber(limitKbps) || limitKbps < 1) {
      limitKbps = 0;
    }
    return this.#client.setTorrentUploadSpeed(hashes, limitKbps);
  }
  async renameFile(hash, oldPath, newPath) {
    if (
      !isStringFull(hash) ||
      !isStringFull(oldPath) ||
      !isStringFull(newPath)
    ) {
      return false;
    }
    oldPath = removeLastPathSep(removeFirstPathSep(oldPath));
    newPath = removeLastPathSep(removeFirstPathSep(newPath));
    if (getPathDepth(oldPath) !== getPathDepth(newPath)) {
      return false;
    }
    let differCount = 0;
    let oldP = splitPath(oldPath);
    let newP = splitPath(newPath);
    let i = 0;
    for (let s of oldP) {
      if (s !== newP[i]) {
        differCount++;
      }
      i++;
    }
    if (differCount > 1) {
      return false;
    }
    let { files } = await this.getTorrentFiles(hash, { fresh: true });
    let found = files.find(
      (s) =>
        isChildOfParentDir({
          parentPath: oldPath,
          childPath: s.path,
          isAbsolute: false,
        }) || isPathsEqualByOS(s.path, oldPath, true, false)
    );
    if (!found) {
      return false;
    }
    let IS_FILE = isPathsEqualByOS(found.path, oldPath, true, false);

    await this.#client.renameFile(hash, oldPath, newPath, IS_FILE);
    await sleepMsPromise(500);
    return await this.getTorrentFiles(hash, { fresh: true });
  }
}

export { TorrentClientApi, clientTypes as torrentClientTypes, tFields as torrentFields, tfFields as torrentFileFields, filters as torrentFilters, allStatus as torrentStatus };
