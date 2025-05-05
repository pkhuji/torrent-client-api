import { isString, ensureURLProtocol, isNumber, isValidURL, throwError, isStringFull, joinURLPaths, isObject, changePropsToCamel, versionCompare, getNestedProp, isArrayFull, replaceBackslashToForward, concatArrays } from '../common-utils/js-utils.mjs';
import { isChildOfParentDir, isPathsEqualByOS, getFileBaseName, httpRequest } from '../common-utils/node-utils.mjs';
import { hashesToArray, setLoginCounter, allStatus, formatRatio } from '../helpers.mjs';
import { join } from 'path';

class Transmission {
  config;
  state = {};
  constructor({
    baseUrl = "",
    apiPath = "",
    username = "",
    password = "",
    timeoutS = 5,
    agent,
  }) {
    if (isString(baseUrl)) {
      baseUrl = ensureURLProtocol(baseUrl, "http://");
    }
    if (
      !isNumber(timeoutS) ||
      timeoutS < 1 ||
      !isValidURL(baseUrl) ||
      !isString(username) ||
      !isString(password)
    ) {
      throwError([
        "5726eace-d53b-5ac8-9304-560638737e60",
        baseUrl,
        apiPath,
        username,
        password,
        timeoutS,
      ]);
    }
    if (!isStringFull(apiPath)) {
      apiPath = "/transmission/rpc";
    }
    let authHeader;
    if (isStringFull(username)) {
      authHeader =
        "Basic " +
        Buffer.from(`${username}:${password || ""}`).toString("base64");
    }
    this.config = {
      url: joinURLPaths(baseUrl, apiPath),
      authHeader,
      timeoutS,
      agent,
    };
  }
  async getAppVersion() {
    await this.checkVersion();
    return this.state.version;
  }
  async getApiVersion() {
    await this.checkVersion();
    return this.state.apiVersion;
  }
  async checkVersion() {
    if (!this.state.version) {
      const res = await this.request("session-get", {
        fields: [
          "version",
          "rpc-version",
          "rpc-version-minimum",
          "rpc-version-semver",
        ],
      });
      if (!isObject(res.arguments)) {
        throwError(["e50822d4-5a73-4cd4-ac1a-271a7dc180ab", res]);
      }
      let { version, rpcVersion } = changePropsToCamel(res.arguments);
      const versionNum = parseFloat((version.match(/[\d\.]+/) || ["0"])[0]);
      Object.assign(this.state, {
        version,
        versionNum,
        apiVersion: rpcVersion,
        rpcVersion,
      });
    }
  }
  async isVersionOrUp(neededVersion) {
    await this.checkVersion();
    return versionCompare(this.state.versionNum, neededVersion) >= 0;
  }
  async isApiVersionOrUp(neededVersion) {
    await this.checkVersion();
    return versionCompare(this.state.apiVersion, neededVersion) >= 0;
  }
  async getPreferences() {
    const args = { fields: this.getSessionFields() };
    let res = await this.request("session-get", args);
    return getNestedProp(res, "arguments", {});
  }
  async setPreferences(preferences) {
    let newPrefs = {};
    let toSkip = this.getNonMutableSessionFields();
    for (let k in preferences) {
      if (toSkip.includes(k)) {
        continue;
      }
      newPrefs[k] = preferences[k];
    }
    await this.request("session-set", newPrefs);
    return true;
  }
  async getTorrents() {
    const args = { fields: this.getTorrentFields() };
    // args.ids = []
    const res = await this.request("torrent-get", args);
    return getNestedProp(res, "arguments.torrents", []);
  }
  async getTorrentFiles(hash) {
    let args = {
      ids: hashesToArray(hash),
      fields: ["files"],
    };
    let res = await this.request("torrent-get", args);
    let arr = getNestedProp(res, "arguments.torrents", []).map((s) => s.files);
    return arr[0] || [];
  }
  async startTorrents(hashes) {
    hashes = hashesToArray(hashes);
    let args = {};
    if (isArrayFull(hashes)) {
      args.ids = hashes;
    }
    await this.request("torrent-start", args);
    return true;
  }
  async stopTorrents(hashes) {
    hashes = hashesToArray(hashes);
    let args = {};
    if (isArrayFull(hashes)) {
      args.ids = hashes;
    }
    await this.request("torrent-stop", args);
    return true;
  }
  async setTorrentUploadSpeed(hashes, limitKbps) {
    let args = { ids: hashes };
    if (limitKbps > 0) {
      args.uploadLimit = limitKbps;
      args.uploadLimited = true;
    } else {
      args.uploadLimit = 0;
      args.uploadLimited = false;
    }
    // console.log(args);
    await this.request("torrent-set", args);
    // console.log(res);
    return true;
  }
  async renameFile(hash, oldPath, newPath) {
    let files = await this.getTorrentFiles(hash);
    let found = files.find(
      (s) =>
        isChildOfParentDir({
          parentPath: oldPath,
          childPath: s.name,
          isAbsolute: false,
        }) || isPathsEqualByOS(s.name, oldPath, true, false)
    );
    if (!found) {
      return false;
    }
    await this.request("torrent-rename-path", {
      ids: hashesToArray(hash),
      path: oldPath,
      name: getFileBaseName(newPath),
    });
    return true;
  }
  async request(method, args = {}) {
    const headers = {
      "X-Transmission-Session-Id": this.state.sid || "",
      "Content-Type": "application/json",
    };

    let { url, authHeader, timeoutS, agent } = this.config;
    if (authHeader) {
      headers.Authorization = authHeader;
    }
    const res = await httpRequest(url, {
      method: "POST",
      body: {
        method,
        arguments: args,
      },
      headers,
      timeoutS,
      jsonResponse: true,
      agent,
    });
    // console.log(res);
    if (res.error) {
      if (res.status === 409) {
        setLoginCounter(this.state, [res]);
        this.state.sid = res.headers["x-transmission-session-id"];
        return await this.request(method, args);
      }
      setLoginCounter(this.state);
      throwError(["632cdf24-ce19-46b4-925e-bd6e9b28ad09", res]);
    }
    setLoginCounter(this.state);
    return res.data;
  }
  getTorrentFields() {
    /* -- heavy 
      "availability",
      "files",
      "fileStats",
      "peers",
      "peersFrom",
      "pieces",
      "trackers",
      "trackerList",
      "trackerStats",
      "webseeds",
    */
    return [
      "activityDate",
      "addedDate",
      "bandwidthPriority",
      "comment",
      "corruptEver",
      "creator",
      "dateCreated",
      "desiredAvailable",
      "doneDate",
      "downloadDir",
      "downloadedEver",
      "downloadLimit",
      "downloadLimited",
      "editDate",
      "error",
      "errorString",
      "eta",
      "etaIdle",
      "file-count",
      "group",
      "hashString",
      "haveUnchecked",
      "haveValid",
      "honorsSessionLimits",
      "id",
      "isFinished",
      "isPrivate",
      "isStalled",
      "labels",
      "leftUntilDone",
      "magnetLink",
      "manualAnnounceTime",
      "maxConnectedPeers",
      "metadataPercentComplete",
      "name",
      "peer-limit",
      "peersConnected",
      "peersGettingFromUs",
      "peersSendingToUs",
      "percentComplete",
      "percentDone",
      "pieceCount",
      "pieceSize",
      "priorities",
      "primary-mime-type",
      "queuePosition",
      "rateDownload",
      "rateUpload",
      "recheckProgress",
      "secondsDownloading",
      "secondsSeeding",
      "seedIdleLimit",
      "seedIdleMode",
      "seedRatioLimit",
      "seedRatioMode",
      "sequential_download",
      "sizeWhenDone",
      "startDate",
      "status",
      "totalSize",
      "torrentFile",
      "uploadedEver",
      "uploadLimit",
      "uploadLimited",
      "uploadRatio",
      "wanted",
      "webseedsSendingToUs",
    ];
  }
  // filterTorrents(torrents, filter) {
  //   if (!filter) {
  //     return torrents;
  //   }
  //   if (!Object.values(filters).includes(filter)) {
  //     throwError(["be0e2ffb-2a22-45bc-9c5a-15e940650eb7", filter]);
  //   }
  //   if (filter === filters.stopped) {
  //     return torrents.filter((s) => s.status === 0);
  //   } else if (filter === filters.running) {
  //     return torrents.filter((s) => [3, 4, 5, 6].includes(s.status));
  //   } else if (filter === filters.downloading) {
  //     return torrents.filter((s) => s.status === 3 || s.status === 4);
  //   } else if (filter === filters.seeding) {
  //     return torrents.filter((s) => s.status === 5 || s.status === 6);
  //   } else if (filter === filters.completed) {
  //     return torrents.filter((s) => s.isFinished);
  //   } else if (filter === filters.error) {
  //     return torrents.filter((s) => s.error !== 0);
  //   } else if (filter === filters.checking) {
  //     return torrents.filter((s) => s.status === 1 || s.status === 2);
  //   }
  //   return [];
  // }
  // sortTorrents(torrents, sort, reverse) {
  //   let sortByProp;
  //   if (sort === sortBy.addedAt) {
  //     sortByProp = "addedDate";
  //   } else if (sort === sortBy.completedAt) {
  //     sortByProp = "doneDate";
  //   } else if (sort === sortBy.ratio) {
  //     sortByProp = "uploadRatio";
  //   } else if (sort === sortBy.seedingTime) {
  //     sortByProp = "secondsSeeding";
  //   } else if (sort === sortBy.size) {
  //     sortByProp = "sizeWhenDone";
  //   } else if (sort === sortBy.totalSize) {
  //     sortByProp = "totalSize";
  //   } else if (sort === sortBy.uploaded) {
  //     sortByProp = "uploadedEver";
  //   } else if (sort === sortBy.downloadRate) {
  //     sortByProp = "rateDownload";
  //   } else if (sort === sortBy.uploadRate) {
  //     sortByProp = "rateUpload";
  //   } else if (sort === sortBy.position) {
  //     sortByProp = "queuePosition";
  //   }
  //   if (!sortByProp) {
  //     return torrents;
  //   }
  //   return sortObjects(torrents, sortByProp, reverse ? "d" : "a");
  // }
  normalizeStatus(status, isFinished, error) {
    if (0 === status) {
      return allStatus.stopped;
    } else if ([3, 4, 5, 6].includes(status)) {
      return isFinished ? allStatus.seeding : allStatus.downloading;
    } else if (error !== 0) {
      return allStatus.error;
    } else if (status === 1 || status === 2) {
      return allStatus.checking;
    }
    return null;
  }
  normalizeTorrents(torrents) {
    return torrents.map((s) => {
      let uploadLimitKBps = s.uploadLimit;
      if (uploadLimitKBps < 1) {
        uploadLimitKBps = 0;
      }
      let downloadLimitKBps = s.downloadLimit;
      if (downloadLimitKBps < 1) {
        downloadLimitKBps = 0;
      }
      return {
        addedAt: s.addedDate,
        completedAt: s.doneDate > 0 ? s.doneDate : 0,
        ratio: formatRatio(s.uploadRatio),
        seedingTime: s.secondsSeeding,
        downloadingTime: s.secondsDownloading,
        size: s.sizeWhenDone,
        totalSize: s.totalSize,
        uploaded: s.uploadedEver,
        uploadRate: s.rateUpload,
        uploadLimitKBps, // raw in KBps
        downloaded: s.downloadedEver,
        downloadRate: s.rateDownload,
        downloadLimitKBps,
        savePath: replaceBackslashToForward(join(s.downloadDir, s.name)),
        position: s.queuePosition,
        error: s.error > 0,
        message: s.errorString,
        fileCount: s["file-count"],
        hash: s.hashString,
        hashV2: "",
        isFinished: s.isFinished,
        isPrivate: s.isPrivate,
        magnetLink: s.magnetLink,
        peers: s.peersConnected,
        name: s.name,
        percentDone: s.percentDone,
        pieceCount: s.pieceCount,
        pieceSize: s.pieceSize,
        mimeType: s["primary-mime-type"],
        recheckProgress: s.recheckProgress,
        status: this.normalizeStatus(s.status, s.isFinished, s.error),
      };
    });
  }
  normalizeTorrentFiles(files) {
    return files.map((s) => {
      return {
        progress: parseInt((s.bytesCompleted / s.length) * 100),
        size: s.length,
        path: s.name,
      };
    });
  }
  getNonMutableSessionFields() {
    return [
      "blocklist-size",
      "config-dir",
      "rpc-version-minimum",
      "rpc-version-semver",
      "rpc-version",
      "session-id",
      "units",
      "version",
    ];
  }
  getSessionFields() {
    return concatArrays(this.getNonMutableSessionFields(), [
      "alt-speed-down",
      "alt-speed-enabled",
      "alt-speed-time-begin",
      "alt-speed-time-day",
      "alt-speed-time-enabled",
      "alt-speed-time-end",
      "alt-speed-up",
      "blocklist-enabled",
      "blocklist-url",
      "cache-size-mb",
      "default-trackers",
      "dht-enabled",
      "download-dir",
      "download-dir-free-space",
      "download-queue-enabled",
      "download-queue-size",
      "encryption",
      "idle-seeding-limit-enabled",
      "idle-seeding-limit",
      "incomplete-dir-enabled",
      "incomplete-dir",
      "lpd-enabled",
      "peer-limit-global",
      "peer-limit-per-torrent",
      "peer-port-random-on-start",
      "peer-port",
      "pex-enabled",
      "port-forwarding-enabled",
      "queue-stalled-enabled",
      "queue-stalled-minutes",
      "rename-partial-files",
      "reqq",
      "script-torrent-added-enabled",
      "script-torrent-added-filename",
      "script-torrent-done-enabled",
      "script-torrent-done-filename",
      "script-torrent-done-seeding-enabled",
      "script-torrent-done-seeding-filename",
      "seed-queue-enabled",
      "seed-queue-size",
      "seedRatioLimit",
      "seedRatioLimited",
      "sequential_download",
      "speed-limit-down-enabled",
      "speed-limit-down",
      "speed-limit-up-enabled",
      "speed-limit-up",
      "start-added-torrents",
      "trash-original-torrent-files",
      "utp-enabled",
    ]);
  }
}

export { Transmission };
