import { isString, ensureURLProtocol, isNumber, isValidURL, throwError, isStringFull, joinURLPaths, getNestedProp, versionCompare, changePropsToCamel, getNestedProps, stringIncludesNoCase, includesNoCase, replaceBackslashToForward, isArray } from '../common-utils/js-utils.mjs';
import { httpRequest, isChildOfParentDir, isPathsEqualByOS } from '../common-utils/node-utils.mjs';
import { hashesToArray, setLoginCounter, allStatus, formatRatio } from '../helpers.mjs';
import { join } from 'path';

class Deluge {
  config;
  state = {};
  constructor({ baseUrl = "", apiPath, password = "", timeoutS = 5, agent }) {
    if (isString(baseUrl)) {
      baseUrl = ensureURLProtocol(baseUrl, "http://");
    }
    if (
      !isNumber(timeoutS) ||
      timeoutS < 1 ||
      !isValidURL(baseUrl) ||
      !isString(password)
    ) {
      throwError([
        "5726eace-d53b-5ac8-9304-560638737e60",
        baseUrl,
        apiPath,
        password,
        timeoutS,
      ]);
    }
    if (!isStringFull(apiPath)) {
      apiPath = "/json";
    }
    this.config = {
      url: joinURLPaths(baseUrl, apiPath),
      password,
      timeoutS,
      agent,
    };
  }

  async login() {
    const { password, url, timeoutS, agent } = this.config;
    this.state.msgId = 0;
    const headers = {
      "Content-Type": "application/json",
      Cookie: this.state.cookie || "",
    };
    let res = await httpRequest(url, {
      headers,
      method: "POST",
      body: {
        method: "auth.login",
        params: [password],
        id: this.state.msgId++,
      },
      timeoutS,
      agent,
      jsonResponse: true,
    });

    let cookie = (res.headers["set-cookie"] || [])[0];
    if (
      !getNestedProp(res, "data.result") ||
      !isString(cookie) ||
      !cookie.includes("session_id")
    ) {
      throwError(["c75db42f-0e93-46b4-8375-a9e350651c7b", res]);
    }
    this.state.cookie = cookie.split(";")[0];
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
      const version = await this.request("daemon.get_version");
      const versionNum = parseFloat((version.match(/[\d\.]+/) || ["0"])[0]);
      Object.assign(this.state, {
        versionNum,
        version,
      });
    }
  }
  async isVersionOrUp(neededVersion) {
    await this.checkVersion();
    return versionCompare(this.state.versionNum, neededVersion) >= 0;
  }
  getPreferences() {
    return this.request("core.get_config");
  }
  async setPreferences(preferences) {
    await this.request("core.set_config", [preferences]);
    return true;
  }
  async getTorrents() {
    /*
     let res = await this.request("web.update_ui", [[]]);
     return Object.values(res.torrents); 
     */
    let res = await this.request("core.get_torrents_status", [
      {},
      [
        "active_time",
        "seeding_time",
        "finished_time",
        "all_time_download",
        "storage_mode",
        "distributed_copies",
        "download_payload_rate",
        "hash",
        "auto_managed",
        "is_auto_managed",
        "is_finished",
        "max_connections",
        "max_download_speed",
        "max_upload_slots",
        "max_upload_speed",
        "message",
        "move_on_completed_path",
        "move_on_completed",
        "move_completed_path",
        "move_completed",
        "next_announce",
        "num_peers",
        "num_seeds",
        "owner",
        "paused",
        "prioritize_first_last",
        "prioritize_first_last_pieces",
        "sequential_download",
        "progress",
        "shared",
        "remove_at_ratio",
        "save_path",
        "download_location",
        "seeds_peers_ratio",
        "seed_rank",
        "state",
        "stop_at_ratio",
        "stop_ratio",
        "time_added",
        "total_done",
        "total_payload_download",
        "total_payload_upload",
        "total_peers",
        "total_seeds",
        "total_uploaded",
        "total_wanted",
        "total_remaining",
        "tracker",
        "tracker_host",
        "tracker_status",
        "upload_payload_rate",
        "comment",
        "creator",
        "num_files",
        "num_pieces",
        "piece_length",
        "private",
        "total_size",
        "eta",
        "is_seed",
        "peers",
        "queue",
        "ratio",
        "completed_time",
        "last_seen_complete",
        "name",
        "pieces",
        "seed_mode",
        "super_seeding",
        "time_since_download",
        "time_since_upload",
        "time_since_transfer",
      ],
    ]);
    return Object.values(res);
  }
  async getTorrentFiles(hash) {
    let torrent = await this.request("core.get_torrent_status", [
      hash,
      ["files", "file_progress"],
    ]);
    let { files, fileProgress } = changePropsToCamel(torrent);
    return files.map((s) => {
      s.progress = fileProgress[s.index] || 0;
      return s;
    });
    // return torrent["files"];
    // let torrent = await this.request("web.get_torrent_files", [hash]);
    // return torrent;
    // return torrent["files"];
  }
  async startTorrents(hashes) {
    await this.request("core.resume_torrent", [hashesToArray(hashes)]);
    return true;
  }
  async stopTorrents(hashes) {
    await this.request("core.pause_torrent", [hashesToArray(hashes)]);
    return true;
  }
  async setTorrentUploadSpeed(hashes, limitKbps) {
    if (limitKbps < 1) {
      limitKbps = -1;
    }
    await this.request("core.set_torrent_options", [
      hashes,
      { max_upload_speed: limitKbps },
    ]);
    return true;
  }
  async renameFile(hash, oldPath, newPath) {
    let files = await this.getTorrentFiles(hash);
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
    let isFile = isPathsEqualByOS(found.path, oldPath, true, false);
    let method = "core.rename_folder";
    let args = [hash, oldPath, newPath];
    if (isFile) {
      method = "core.rename_files";
      args = [hash, [[found.index, newPath]]];
    }
    await this.request(method, args);
    return true;
  }
  async request(method, params = []) {
    if (this.state.msgId === 1024) {
      this.state.msgId = 0;
    }
    if (!this.state.cookie) {
      await this.login();
    }
    const { url, timeoutS, agent } = this.config;
    const headers = {
      "Content-Type": "application/json",
      Cookie: this.state.cookie || "",
    };
    if (!isArray(params)) {
      params = [params];
    }
    let res = await httpRequest(url, {
      headers,
      method: "POST",
      body: {
        method,
        params,
        id: this.state.msgId++,
      },
      timeoutS,
      agent,
      jsonResponse: true,
    });
    let { error, result } = getNestedProps(res.data, ["error", "result"]);
    if (error) {
      if (stringIncludesNoCase(error.message || "", "Not authenticated")) {
        setLoginCounter(this.state, [error, res]);
        delete this.state.cookie;
        return this.request(method, params);
      }
      setLoginCounter(this.state);
      throwError(["0853c956-3db6-4e78-87d7-5390620c9a55", error, res]);
    }
    setLoginCounter(this.state);
    return result;
  }
  normalizeStatus(status, isFinished) {
    if (includesNoCase("Paused", status)) {
      return allStatus.stopped;
    } else if (includesNoCase(["Downloading", "Seeding", "Queued"], status)) {
      return isFinished ? allStatus.seeding : allStatus.downloading;
    } else if (includesNoCase("Error", status)) {
      return allStatus.error;
    } else if (includesNoCase("Checking", status)) {
      return allStatus.checking;
    }
    return null;
  }
  normalizeTorrents(torrents) {
    return torrents.map((s) => {
      let error = s.state === "Error";
      let message = s.state;
      let peers = s.num_seeds + s.num_peers;
      if (peers < 0) {
        peers = 0;
      }
      let downloadingTime = s.time_since_download - s.time_since_upload;
      let uploadLimitKBps = s.max_upload_speed;
      if (uploadLimitKBps < 1) {
        uploadLimitKBps = 0;
      }
      let downloadLimitKBps = s.max_download_speed;
      if (downloadLimitKBps < 1) {
        downloadLimitKBps = 0;
      }
      return {
        addedAt: s.time_added,
        completedAt: s.completed_time > 0 ? s.completed_time : 0,
        ratio: formatRatio(s.ratio),
        seedingTime: s.seeding_time,
        downloadingTime,
        size: s.total_wanted,
        totalSize: s.total_size,
        uploaded: s.total_uploaded,
        uploadRate: s.upload_payload_rate,
        uploadLimitKBps, // raw in KBps
        downloaded: s.all_time_download,
        downloadRate: s.download_payload_rate,
        downloadLimitKBps,
        savePath: replaceBackslashToForward(join(s.save_path, s.name)),
        position: s.queue,
        error,
        message,
        fileCount: s.num_files,
        hash: s.hash,
        hashV2: "",
        isFinished: s.is_finished,
        isPrivate: s.private,
        magnetLink: "",
        peers,
        name: s.name,
        percentDone: s.progress,
        pieceCount: s.num_pieces,
        pieceSize: s.piece_length,
        mimeType: "",
        recheckProgress: 0,
        status: this.normalizeStatus(s.state),
      };
    });
  }
  normalizeTorrentFiles(files) {
    return files.map((s) => {
      return {
        path: s.path,
        size: s.size,
        progress: parseInt(s.progress * 100),
      };
    });
  }
}

export { Deluge };
