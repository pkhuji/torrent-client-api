import { isString, ensureURLProtocol, isNumber, isValidURL, throwError, isStringFull, joinURLPaths, isFloat, versionCompare, isArray, removeFromEnd, splitArrayIntoChunks, startsWithAny, isStringEqual, combineArrayChunks, isObjectFull, arrayHasAny, replaceBackslashToForward } from '../common-utils/js-utils.mjs';
import { httpRequest } from '../common-utils/node-utils.mjs';
import { hashesToArray, setLoginCounter, allStatus, formatRatio } from '../helpers.mjs';

class UTorrent {
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
      apiPath = "/gui/";
    }
    this.config = {
      url: joinURLPaths(baseUrl, apiPath),
      username,
      password,
      timeoutS,
      agent,
      authHeader:
        "Basic " +
        Buffer.from(`${username}:${password || ""}`).toString("base64"),
    };
  }
  async login() {
    let { url, timeoutS, agent, authHeader } = this.config;
    let params = {
      t: Date.now().toString(),
    };
    const res = await httpRequest(joinURLPaths(url, "/token.html"), {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
      params,
      timeoutS,
      agent,
    });
    let cookie = (res.headers["set-cookie"] || [])[0];
    this.state.cookie = cookie.split(";")[0];
    if (!isStringFull(res.data)) {
      throwError([
        "d9d2efa9-cf88-4134-b1c3-404c3a0b26b4",
        cookie,
        res,
        this.config,
      ]);
    }
    let matched = res.data.match(/>([^<]+)<\//);
    if (!matched) {
      throwError(["d3dd9279-33fe-4710-8d65-3ef5de843b31", matched]);
    }
    this.state.token = matched[1];
    return true;
  }
  async getAppVersion() {
    await this.checkVersion();
    return this.state.version;
  }
  getApiVersion() {
    return "";
  }
  async checkVersion() {
    if (!this.state.version) {
      const res = await this.request("getversion");
      if (!isFloat(res.build)) {
        throwError(["307d71ea-4b23-4571-8232-776bf766c699", res]);
      }
      Object.assign(this.state, {
        versionNum: res.build,
        version: res.build + "",
      });
    }
  }
  async isVersionOrUp(neededVersion) {
    await this.checkVersion();
    return versionCompare(this.state.versionNum, neededVersion) >= 0;
  }
  async getPreferences() {
    let res = await this.request("getsettings");
    let { settings } = res;
    if (!isArray(settings)) {
      throwError(["702497af-7407-4d96-ae62-6abcaecf5dd4", settings]);
    }
    return settings.map((s) => removeFromEnd(s, 1));
  }
  /**
   * This method will set preferences in format
   * [[setting_name, setting_type, value],...].
   * This is the output of getPreferences method of utorrent client
   * @param {Array<Array>} preferences - Array of tuples.
   *
   */
  async setPreferences(preferences) {
    let settingType = {
      Integer: 0,
      Boolean: 1,
      String: 2,
    };
    let validTypes = Object.values(settingType);
    let propsToSkip = ["webui.", "gui.", "sys."];
    let prefChunks = splitArrayIntoChunks(preferences, 15);
    for (let prefChunk of prefChunks) {
      let params = new URLSearchParams();
      for (let s of prefChunk) {
        let name = s[0];
        let type = s[1];
        let value = s[2];
        if (!isStringFull(name) || !validTypes.includes(type)) {
          throwError(["07a3bdf2-ced1-4f80-b1ee-2b83dabc9dc9", s]);
        }
        if (startsWithAny(name, propsToSkip)) {
          continue;
        }
        if (type === settingType.Boolean) {
          if (value === "true" || value === true) {
            value = "1";
          } else {
            value = "0";
          }
        }
        if (type === settingType.Integer) {
          if (!isFloat(value, { parse: true })) {
            value = "";
          }
        }
        params.append("s", name);
        params.append("v", value + "");
      }
      if (isStringFull(params.toString())) {
        await this.request("setsetting", params);
      }
    }
    return true;
  }
  getStatuses() {
    return {
      started: 1,
      checking: 2,
      startAfterCheck: 4,
      checked: 8,
      error: 16,
      paused: 32,
      queued: 64,
      loaded: 128,
    };
  }
  torrentsToObjects(torrents) {
    if (!isArray(torrents)) {
      throwError(["2655f7e4-1a0c-4131-9bd5-712901df4651", torrents]);
    }
    if (!isArray(torrents[0])) {
      return torrents;
    }

    let statusesNum = Object.values(this.getStatuses());
    return torrents.map((s) => {
      let rawStatus = s[1];
      let status = [];
      for (let s of statusesNum) {
        /* bitwise AND to determine if
           a status included in given rawStatus
         */
        if ((rawStatus & s) != 0) {
          status.push(s);
        }
      }
      return {
        hash: s[0],
        status,
        name: s[2],
        size: s[3],
        percentProgress: parseInt(s[4] / 10),
        downloaded: s[5],
        uploaded: s[6],
        ratio: s[7],
        uploadSpeed: s[8],
        downloadSpeed: s[9],
        eta: s[10],
        label: s[11],
        peersConnected: s[12],
        peersInSwarm: s[13],
        seedsConnected: s[14],
        seedsInSwarm: s[15],
        availability: s[16],
        torrentQueueOrder: s[17],
        remaining: s[18],
        downloadUrl: s[19],
        rssFeedUrl: s[20],
        statusMessage: s[21],
        streamId: s[22],
        dateAdded: s[23],
        dateCompleted: s[24],
        appUpdateUrl: s[25],
        savePath: s[26],
      };
    });
  }
  async getTorrents() {
    const params = new URLSearchParams();
    params.set("list", "1");
    let res = await this.request("", params);
    let { torrents } = res;
    torrents = this.torrentsToObjects(torrents);
    let torrentChunks = splitArrayIntoChunks(torrents, 50);
    for (let chunk of torrentChunks) {
      const propParams = new URLSearchParams();
      propParams.set("action", "getprops");
      for (let s of chunk) {
        propParams.append("hash", s.hash);
      }
      let res = await this.request("", propParams);
      if (!isArray(res.props)) {
        throwError(["3d59cbaa-7cf7-4fda-b336-0b53b8b42cde", res]);
      }
      for (let p of res.props) {
        let found = chunk.find((s) => isStringEqual(s.hash, p.hash, false));
        if (!found) {
          throwError(["fdcce7ba-ead7-4703-ae56-6560e5c4ad02", p]);
        }
        Object.assign(found, p);
      }
    }
    return combineArrayChunks(torrentChunks);
  }
  async getTorrentFiles(hash) {
    let res = await this.request("getfiles", { hash });
    if (!res.files) {
      throwError(["f9835ed9-a400-4939-b51b-1c26c9e81bf0", res]);
    }
    return res.files[1].map((s) => {
      return {
        fileName: s[0],
        fileSize: s[1],
        downloaded: s[2],
        priority: s[3],
      };
    });
  }
  async startTorrents(hashes) {
    if (!hashes) {
      hashes = (await this.getTorrents()).map((s) => s.hash);
    }
    hashes = hashesToArray(hashes);
    let chunks = splitArrayIntoChunks(hashes, 150);
    for (let chunk of chunks) {
      const params = new URLSearchParams();
      for (let h of chunk) {
        params.append("hash", h);
      }
      await this.request("start", params);
    }
    return true;
  }
  async stopTorrents(hashes) {
    if (!hashes) {
      hashes = (await this.getTorrents()).map((s) => s.hash);
    }
    hashes = hashesToArray(hashes);
    let chunks = splitArrayIntoChunks(hashes, 150);
    for (let chunk of chunks) {
      const params = new URLSearchParams();
      for (let h of chunk) {
        params.append("hash", h);
      }
      await this.request("stop", params);
    }
    return true;
  }
  async setTorrentUploadSpeed(hashes, limitKbps) {
    let limit = limitKbps * 1024;
    if (limitKbps > 0) {
      limit = limitKbps * 1024;
    } else {
      limit = 0;
    }
    let chunks = splitArrayIntoChunks(hashes, 100);
    for (let chunk of chunks) {
      const params = new URLSearchParams();
      for (let h of chunk) {
        params.append("hash", h);
        params.append("s", "ulrate");
        params.append("v", limit);
      }
      await this.request("setprops", params);
    }
    return true;
  }
  renameFile() {
    // throwError(["64081544-0605-4ad9-96a2-a3a67e87d035", "NA in utorrent"]);
    return false;
  }
  async request(action, params) {
    if (!this.state.cookie || !this.state.token) {
      await this.login();
    }
    if (!(params instanceof URLSearchParams)) {
      if (isObjectFull(params)) {
        let params2 = new URLSearchParams();
        for (let k in params) {
          params2.append(k, params[k]);
        }
        params = params2;
      } else {
        params = new URLSearchParams();
      }
    }
    if (action) {
      params.set("action", action);
    }
    params.set("token", this.state.token);
    const { url, timeoutS, agent, authHeader } = this.config;
    const res = await httpRequest(url, {
      method: "GET",
      headers: {
        Cookie: this.state.cookie,
        Authorization: authHeader,
      },
      params,
      timeoutS,
      querySlash: true,
      jsonResponse: true,
      agent: agent,
    });
    let { status, error } = res;
    if (error) {
      if (status === 400 || status === 401) {
        setLoginCounter(this.state, [res]);
        delete this.state.token;
        return await this.request(action, params);
      }
      setLoginCounter(this.state);
      throwError(["0479f277-fd2f-4089-b346-aff42dd86132", action, params, res]);
    }
    setLoginCounter(this.state);
    return res.data;
  }
  // filterTorrents(torrents, filter) {
  //   if (!filter) {
  //     return torrents;
  //   }
  //   if (!Object.values(filters).includes(filter)) {
  //     throwError(["be0e2ffb-2a22-45bc-9c5a-15e940650eb7", filter]);
  //   }
  //   let statuses = this.getStatuses();
  //   if (filter === filters.stopped) {
  //     return torrents.filter(
  //       (s) => !arrayHasAny(s.status, [statuses.paused, statuses.started])
  //     );
  //   } else if (filter === filters.running) {
  //     return torrents.filter((s) =>
  //       arrayHasAny(s.status, [statuses.started, statuses.queued])
  //     );
  //   } else if (filter === filters.downloading) {
  //     return torrents.filter(
  //       (s) =>
  //         arrayHasAny(s.status, [statuses.started, statuses.queued]) &&
  //         s.percentProgress < 100
  //     );
  //   } else if (filter === filters.seeding) {
  //     return torrents.filter(
  //       (s) =>
  //         arrayHasAny(s.status, [statuses.started, statuses.queued]) &&
  //         s.percentProgress >= 100
  //     );
  //   } else if (filter === filters.completed) {
  //     return torrents.filter((s) => s.percentProgress >= 100);
  //   } else if (filter === filters.error) {
  //     return torrents.filter((s) => arrayHasAny(s.status, [statuses.error]));
  //   } else if (filter === filters.checking) {
  //     return torrents.filter((s) => arrayHasAny(s.status, [statuses.checking]));
  //   }
  //   return [];
  // }
  // sortTorrents(torrents, sort, reverse) {
  //   let sortByProp;
  //   if (sort === sortBy.addedAt) {
  //     sortByProp = "dateAdded";
  //   } else if (sort === sortBy.completedAt) {
  //     sortByProp = "dateCompleted";
  //   } else if (sort === sortBy.ratio) {
  //     sortByProp = "ratio";
  //   } else if (sort === sortBy.seedingTime) {
  //     return torrents;
  //   } else if (sort === sortBy.size) {
  //     sortByProp = "size";
  //   } else if (sort === sortBy.totalSize) {
  //     sortByProp = "size";
  //   } else if (sort === sortBy.uploaded) {
  //     sortByProp = "uploaded";
  //   } else if (sort === sortBy.downloadRate) {
  //     sortByProp = "downloadSpeed";
  //   } else if (sort === sortBy.uploadRate) {
  //     sortByProp = "uploadSpeed";
  //   } else if (sort === sortBy.position) {
  //     sortByProp = "torrentQueueOrder";
  //   }
  //   if (!sortByProp) {
  //     return torrents;
  //   }
  //   return sortObjects(torrents, sortByProp, reverse ? "d" : "a");
  // }
  normalizeTorrents(torrents) {
    let statuses = this.getStatuses();
    return torrents.map((s) => {
      let error = arrayHasAny(s.status, [statuses.error]);
      let message = s.statusMessage;
      let isFinished = s.dateCompleted > 0 || s.remaining === 0;
      let status = null;
      if (!arrayHasAny(s.status, [statuses.paused, statuses.started])) {
        status = allStatus.stopped;
      } else if (arrayHasAny(s.status, [statuses.started, statuses.queued])) {
        status = isFinished ? allStatus.seeding : allStatus.downloading;
      } else if (error) {
        status = allStatus.error;
      } else if (arrayHasAny(s.status, [statuses.checking])) {
        status = allStatus.checking;
      }
      let uploadLimitKBps = parseInt(s.ulrate / 1024);
      if (uploadLimitKBps < 1) {
        uploadLimitKBps = 0;
      }
      let downloadLimitKBps = parseInt(s.dlrate / 1024);
      if (downloadLimitKBps < 1) {
        downloadLimitKBps = 0;
      }
      return {
        addedAt: s.dateAdded,
        completedAt: s.dateCompleted > 0 ? s.dateCompleted : 0,
        ratio: formatRatio(s.ratio),
        seedingTime: 0,
        downloadingTime: 0,
        size: s.size,
        totalSize: s.size,
        uploaded: s.uploaded,
        uploadRate: s.uploadSpeed,
        uploadLimitKBps, // raw in bps
        downloaded: s.downloaded,
        downloadRate: s.downloadSpeed,
        downloadLimitKBps,
        savePath: replaceBackslashToForward(s.savePath),
        position: s.torrentQueueOrder,
        error,
        message,
        fileCount: null,
        hash: s.hash,
        hashV2: "",
        isFinished,
        isPrivate: null,
        magnetLink: null,
        peers: s.peersConnected + s.seedsConnected,
        name: s.name,
        percentDone: s.percentProgress,
        pieceCount: 0,
        pieceSize: 0,
        mimeType: "",
        recheckProgress: 0,
        status,
      };
    });
  }
  normalizeTorrentFiles(files) {
    return files.map((s) => {
      return {
        progress: parseInt((s.downloaded / s.fileSize) * 100),
        size: s.fileSize,
        path: s.fileName,
      };
    });
  }
}

export { UTorrent };
