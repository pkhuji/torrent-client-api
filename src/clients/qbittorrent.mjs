import { isString, ensureURLProtocol, isNumber, isValidURL, throwError, isStringFull, joinURLPaths, parseCookie, versionCompare, json_stringify, includesNoCase } from '../common-utils/js-utils.mjs';
import { httpRequest } from '../common-utils/node-utils.mjs';
import { hashesToString, setLoginCounter, allStatus, formatRatio } from '../helpers.mjs';

class QBittorent {
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
      apiPath = "/api/v2";
    }
    this.config = {
      url: joinURLPaths(baseUrl, apiPath),
      username,
      password,
      timeoutS,
      agent,
    };
  }
  async login() {
    let { url, username, password, timeoutS, agent } = this.config;

    const res = await httpRequest(joinURLPaths(url, "/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: { username, password },
      timeoutS,
      agent,
    });
    let cookie = parseCookie(res.headers["set-cookie"]);
    if (!isStringFull(cookie.SID)) {
      throwError([
        "d9d2efa9-cf88-4134-b1c3-404c3a0b26b4",
        cookie,
        res,
        this.config,
      ]);
    }

    let expires = cookie.Expires || cookie.expires;
    const maxAge = cookie["Max-Age"] || cookie["max-age"];
    let sid = cookie.SID;
    if (expires) {
      expires = new Date(expires);
    } else if (maxAge) {
      expires = new Date(Number(maxAge) * 1000);
    } else {
      expires = new Date(Date.now() + 3600000);
    }
    Object.assign(this.state, { sid, expires });
    return true;
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
      const version = await this.request(
        "/app/version",
        "GET",
        undefined,
        undefined,
        undefined,
        false
      );
      const apiVersion = await this.request(
        "/app/webapiVersion",
        "GET",
        undefined,
        undefined,
        undefined,
        false
      );
      const versionNum = parseFloat((version.match(/[\d\.]+/) || ["0"])[0]);
      const apiVersionNum = parseFloat(
        (apiVersion.match(/[\d\.]+/) || ["0"])[0]
      );
      Object.assign(this.state, {
        versionNum,
        apiVersionNum,
        version,
        apiVersion,
      });
    }
  }
  async isVersionOrUp(neededVersion) {
    await this.checkVersion();
    return versionCompare(this.state.versionNum, neededVersion) >= 0;
  }
  async isApiVersionOrUp(neededVersion) {
    await this.checkVersion();
    return versionCompare(this.state.apiVersionNum, neededVersion) >= 0;
  }
  getPreferences() {
    return this.request("/app/preferences", "GET");
  }
  async setPreferences(preferences) {
    await this.request(
      "/app/setPreferences",
      "POST",
      undefined,
      {
        json: json_stringify(preferences),
      },
      {
        ["Content-Type"]: "application/x-www-form-urlencoded; charset=utf-8",
      },
      false
    );
    return true;
  }
  getTorrents() {
    return this.request("/torrents/info", "GET");
  }
  getTorrentFiles(hash) {
    return this.request("/torrents/files", "GET", { hash });
  }
  async startTorrents(hashes) {
    hashes = hashesToString(hashes);
    if (!isStringFull(hashes)) {
      hashes = "all";
    }
    const endpoint =
      "/torrents/" + ((await this.isApiVersionOrUp(2.11)) ? "start" : "resume");
    await this.request(endpoint, "POST", undefined, {
      hashes,
    });
    return true;
  }
  async stopTorrents(hashes) {
    hashes = hashesToString(hashes);
    if (!isStringFull(hashes)) {
      hashes = "all";
    }
    const endpoint =
      "/torrents/" + ((await this.isApiVersionOrUp(2.11)) ? "stop" : "pause");
    await this.request(endpoint, "POST", undefined, {
      hashes,
    });
    return true;
  }
  async setTorrentUploadSpeed(hashes, limitKbps) {
    hashes = hashesToString(hashes);
    if (!isStringFull(hashes)) {
      return false;
    }
    await this.request("/torrents/setUploadLimit", "POST", undefined, {
      limit: limitKbps * 1024,
      hashes,
    });
    return true;
  }
  async renameFile(hash, oldPath, newPath, IS_FILE) {
    let route = IS_FILE ? "renameFile" : "renameFolder";
    await this.request("/torrents/" + route, "POST", undefined, {
      hash,
      oldPath,
      newPath,
    });
    return true;
  }
  async request(path, method, params, body, headers = {}, isJson = true) {
    if (
      !this.state.sid ||
      !this.state.expires ||
      this.state.expires.getTime() < new Date().getTime()
    ) {
      await this.login();
    }
    const { url, timeoutS, agent } = this.config;
    const res = await httpRequest(joinURLPaths(url, path), {
      method,
      headers: {
        Cookie: `SID=${this.state.sid || ""}`,
        ...headers,
      },
      body,
      params,
      timeoutS,
      jsonResponse: isJson,
      agent: agent,
    });
    let { status, error } = res;
    if (error) {
      if (status === 403) {
        setLoginCounter(this.state, [res]);
        delete this.state.sid;
        return await this.request(path, method, params, body, headers, isJson);
      }
      setLoginCounter(this.state);
      throwError([
        "0479f277-fd2f-4089-b346-aff42dd86132",
        res,
        path,
        method,
        params,
        body,
        headers,
        isJson,
      ]);
    }
    setLoginCounter(this.state);
    return res.data;
  }
  normalizeStatus(status) {
    if (
      includesNoCase(
        ["paused", "pausedUP", "pausedDL", "stopped", "stoppedUP", "stoppedDL"],
        status
      )
    ) {
      return allStatus.stopped;
    } else if (
      includesNoCase(
        ["downloading", "metaDL", "queuedDL", "stalledDL", "forcedDL"],
        status
      )
    ) {
      return allStatus.downloading;
    } else if (
      includesNoCase(["uploading", "queuedUP", "stalledUP", "forcedUP"], status)
    ) {
      return allStatus.seeding;
    } else if (includesNoCase(["error", "missingFiles"], status)) {
      return allStatus.error;
    } else if (
      includesNoCase(
        [
          "checkingDL",
          "checkingUP",
          "checkingResumeData",
          "allocating",
          "moving",
        ],
        status
      )
    ) {
      return allStatus.checking;
    }
    return null;
  }
  normalizeTorrents(torrents) {
    return torrents.map((s) => {
      let error = false,
        message = "";
      if (includesNoCase(["error", "missingFiles"], s.state)) {
        error = true;
        message = s.state;
      }
      let uploadLimitKBps = parseInt(s.up_limit / 1024);
      if (uploadLimitKBps < 1) {
        uploadLimitKBps = 0;
      }
      let downloadLimitKBps = parseInt(s.dl_limit / 1024);
      if (downloadLimitKBps < 1) {
        downloadLimitKBps = 0;
      }
      return {
        addedAt: s.added_on,
        completedAt: s.completion_on > 0 ? s.completion_on : 0,
        ratio: formatRatio(s.ratio),
        seedingTime: s.seeding_time,
        downloadingTime: 0,
        size: s.size,
        totalSize: s.total_size,
        uploaded: s.uploaded,
        uploadRate: s.upspeed,
        uploadLimitKBps, // raw in bps
        downloaded: s.downloaded,
        downloadRate: s.dlspeed,
        downloadLimitKBps,
        savePath: s.content_path,
        position: s.priority,
        error,
        message,
        fileCount: 0,
        hash: s.infohash_v1 || s.hash,
        hashV2: s.infohash_v2,
        isFinished: s.amount_left === 0 || s.progress >= 1,
        isPrivate: s.private,
        magnetLink: s.magnet_uri,
        peers: s.num_complete + s.num_incomplete + s.num_leechs + s.num_seeds,
        name: s.name,
        percentDone: parseInt(s.progress * 100),
        pieceCount: 0,
        pieceSize: 0,
        mimeType: "",
        recheckProgress: 0,
        status: this.normalizeStatus(s.state),
      };
    });
  }
  normalizeTorrentFiles(files) {
    return files.map((s) => {
      return {
        path: s.name,
        size: s.size,
        progress: parseInt(s.progress * 100),
      };
    });
  }
}

export { QBittorent };
