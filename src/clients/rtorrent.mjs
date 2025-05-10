import { isString, ensureURLProtocol, isValidURL, isFunction, throwError, isStringFull, joinURLPaths, stringIncludesNoCase, versionCompare, replaceBackslashToForward } from '../common-utils/js-utils.mjs';
import '../common-utils/node-utils.mjs';
import { formatRatio } from '../helpers.mjs';
import { URL } from 'url';
import { join } from 'path';

class RTorrent {
  config;
  state = {};
  rpc;
  constructor({
    baseUrl = "",
    apiPath = "",
    username = "",
    password = "",
    xmlrpc,
  }) {
    if (isString(baseUrl)) {
      baseUrl = ensureURLProtocol(baseUrl, "http://");
    }
    if (
      !isValidURL(baseUrl) ||
      !isString(username) ||
      !isString(password) ||
      !isFunction(xmlrpc?.createClient)
    ) {
      throwError([
        "5726eace-d53b-5ac8-9304-560638737e60",
        baseUrl,
        apiPath,
        username,
        password,
        xmlrpc,
      ]);
    }
    if (!isStringFull(apiPath)) {
      apiPath = "/RPC2";
    }
    let { hostname, port, pathname, protocol } = new URL(
      joinURLPaths(baseUrl, apiPath)
    );
    let rpcOptions = {
      host: hostname,
      port: parseInt(port),
      path: pathname,
      headers: {
        "User-Agent": "NodeJS XML-RPC Client",
        "Content-Type": "text/xml",
        Accept: "text/xml",
        "Accept-Charset": "UTF8",
        Connection: "Close",
      },
    };
    if (username && password) {
      rpcOptions.basic_auth = {
        user: username,
        pass: password,
      };
    }
    this.rpc = stringIncludesNoCase(protocol, "https")
      ? xmlrpc.createSecureClient(rpcOptions)
      : xmlrpc.createClient(rpcOptions);
  }
  // createRpcClient() {

  // }
  async getAppVersion() {
    await this.checkVersion();
    return this.state.version;
  }
  async getApiVersion() {
    await this.checkVersion();
    return this.state.apiVersion;
  }
  methodCall(method, params = []) {
    return new Promise((res, rej) => {
      this.rpc.methodCall(method, params, function (err, result) {
        if (err) {
          return rej(err);
        }
        res(result);
      });
    });
  }
  async checkVersion() {
    if (!this.state.version) {
      let res = await this.methodCall("system.multicall", [
        [
          { methodName: "system.api_version", params: [] },
          { methodName: "system.client_version", params: [] },
          { methodName: "system.library_version", params: [] },
        ],
      ]);
      let apiVersion = res[0][0];
      let version = res[1][0];
      let libraryVersion = res[2][0];
      Object.assign(this.state, {
        version,
        versionNum: parseFloat(version),
        apiVersion,
        apiVersionNum: parseFloat(apiVersion),
        libraryVersion,
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
    return {};
    // let res = await this.methodCall("system.listMethods");
    // return res;
    // console.log(res);
  }
  async setPreferences(preferences) {
    return true;
  }
  async getTorrents() {
    return [];
  }
  async getTorrentFiles(hash) {
    return [];
  }
  async startTorrents(hashes) {
    return true;
  }
  async stopTorrents(hashes) {
    return true;
  }
  setTorrentUploadSpeed(hashes, limitKbps) {
    return true;
  }
  async renameFile(hash, oldPath, newPath) {
    return;
  }
  normalizeStatus(status, isFinished, error) {}
  normalizeTorrents(torrents) {
    return torrents.map((s) => {
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
        uploadLimitKBps: s.uploadLimit,
        downloaded: s.downloadedEver,
        downloadRate: s.rateDownload,
        downloadLimit: s.downloadLimit,
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
}

export { RTorrent };
