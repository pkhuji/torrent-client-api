import http from 'http';
import https from 'https';
import 'dns';
import { mkdir, writeFile, readFile, access, lstat } from 'fs/promises';
export { access as fs_access, appendFile as fs_appendFile, copyFile as fs_copyFile, lstat as fs_lstat, mkdir as fs_mkdir, readFile as fs_readFile, readdir as fs_readdir, rename as fs_rename, rm as fs_rm, unlink as fs_unlink, writeFile as fs_writeFile } from 'fs/promises';
export { createHash as crypto_createHash, getHashes as crypto_getHashes } from 'crypto';
export { EOL } from 'os';
import { execSync, exec } from 'child_process';
export { exec as child_process_exec, execSync as child_process_execSync, spawn as child_process_spawn, spawnSync as child_process_spawnSync } from 'child_process';
export { appendFileSync as fs_appendFileSync, constants as fs_constants, copyFileSync as fs_copyFileSync, createReadStream as fs_createReadStream, createWriteStream as fs_createWriteStream, readFileSync as fs_readFileSync, writeFileSync as fs_writeFileSync, lstat as fsc_lstat, rename as fsc_rename } from 'fs';
import { URL } from 'url';
export { URL as url_URL, fileURLToPath as url_fileURLToPath, pathToFileURL as url_pathToFileURL } from 'url';
import { stringify } from 'querystring';
export { decode as qs_decode, encode as qs_encode, escape as qs_escape, parse as qs_parse, unescape as qs_unescape } from 'querystring';
import { isAbsolute, sep, dirname, basename, join } from 'path';
export { basename as path_basename, dirname as path_dirname, extname as path_extname, isAbsolute as path_isAbsolute, join as path_join, parse as path_parse, relative as path_relative, resolve as path_resolve, sep as path_sep } from 'path';
import { createConnection, isIPv4, isIPv6 } from 'net';
export { isIPv4, isIPv6 } from 'net';
import 'zlib';
export { pipeline as stream_pipeline } from 'stream/promises';
import { stringIncludesAny, isStringFull, isArrayOfStrings, throwError, ensureInSubstring, isString, isArrayFull, stringIncludesAll, isFloat, getPortFromIP, removePortFromIP, isNumber, promiseWithTimeout, replaceBackslashToForward, isBool, isArray, isObject, splitPathToArray, stringifyCopyObj, isObjectFull, getUniqueElements, arrayHasAny, isStringEqual, ensureLastSubString, removeLastPathSep, getPathDepth, hasLastPathSep, removeFirstPathSep } from './js-utils.mjs';

function execute(cmd, sync) {
  return new Promise((res, rej) => {
    exec(cmd, function (error, stdout, stderr) {
      if (error) {
        return rej(error);
      }
      res({
        stdout,
        stderr,
      });
    });
  });
}

const isOSWinGlobal = stringIncludesAny(
  process.platform,
  ["win32", "win64"],
  false
);

function isOSWindows() {
  return isOSWinGlobal;
}

!isOSWindows() &&
  isCmdOk("rsync", {
    args: "--help",
    cmdInQuotes: false,
    sync: true,
    outputIncludes: "Copyright",
  });

function getFileBaseName(fullpath) {
  return basename(fullpath);
}

async function ensurePath(path, IS_FILE = false) {
  /* 
  check if file exists
  if yes return {fileExists: true}
  if not 
  check directory exists
  if yes return {dirExists: true}
  of not then create dir and return {dirCreated: true}
  on any error return false
  */
  if (!isPathAbsolute(path) || !isBool(IS_FILE)) {
    throwError(["352840d9-3f80-50d8-8147-d6ea22ff79d0", path, IS_FILE]);
  }
  if (IS_FILE) {
    let fileExists = await isFileOrDir(path);
    if (fileExists) {
      return { fileExists };
    }
    let pathDirName = dirname(path);
    let parentDirExists = await isDir(pathDirName);
    if (parentDirExists) {
      return { fileExists, parentDirExists };
    }
    return mkdir(pathDirName, { recursive: true }).then(() => {
      return { fileExists, parentDirExists, parentDirCreated: true };
    });
  }
  let dirExists = await isDir(path);
  if (dirExists) {
    return { dirExists: true };
  }
  return mkdir(path, { recursive: true }).then(() => {
    return { dirExists: false, dirCreated: true };
  });
}

function isFileOrDir(fullpath, sync) {
  let ip = isNetworkPath(fullpath);
  if (ip) {
    fullpath = replaceBackslashToForward(fullpath);
  }
  return (async () => {
    if (ip && !(await isHostAlive(ip, { timeout: 500, count: 1 }))) {
      return false;
    }
    return access(fullpath)
      .then(() => true)
      .catch(() => false);
  })();
}

function isDir(fullpath, sync) {
  let ip = isNetworkPath(fullpath);
  if (ip) {
    fullpath = replaceBackslashToForward(fullpath);
  }
  return (async () => {
    if (ip && !(await isHostAlive(ip, { timeout: 500, count: 1 }))) {
      return false;
    }
    return lstat(fullpath)
      .then((stats) => stats.isDirectory())
      .catch(() => false);
  })();
}

function ensureLastPathSep(dir) {
  if (!isString(dir)) {
    throwError(["9e61f19b-ea10-45e4-b5d1-65f4ffe66c9d", dir]);
  }
  dir = dir.trim();
  let pathSeps = ["/", "\\"];
  let sepToUse = getSepFromPath(dir);
  return !pathSeps.includes(dir.slice(-1)) ? dir + sepToUse : dir;
}

function getSepFromPath(fullPath) {
  if (!isString(fullPath)) {
    throwError(["9e61f19b-ea10-45e4-b5d1-65f4ffe66c9d", fullPath]);
  }
  fullPath = fullPath.trim();
  if (fullPath.includes("\\")) {
    return "\\";
  } else if (fullPath.includes("/")) {
    return "/";
  }
  return sep;
}

function isPathAbsolute(path) {
  return isString(path) && isAbsolute(path);
}

function replacePathSepToOS(str) {
  if (!isString(str)) {
    throwError("102b7708-efc7-586d-a097-3bd5b00d264f");
  }
  if (isNetworkPath(str)) {
    return replaceBackslashToForward(str);
  }
  return str.replace(/[\\/]/g, sep);
}

function replaceStartOfPath(
  replaceFrom,
  toReplace,
  replaceWith = "",
  keep = 0
) {
  if (
    !isString(replaceFrom) ||
    !isString(toReplace) ||
    !isString(replaceWith) ||
    !isNumber(keep)
  ) {
    throwError([
      "f9cac70e-51e4-405a-9b5a-29a5d739c52f",
      replaceFrom,
      toReplace,
      replaceWith,
      keep,
    ]);
  }

  if (!isArrayFull(splitPathToArray(replaceFrom))) {
    return replaceFrom;
  }

  if (replaceWith && keep !== 0) {
    return replaceFrom;
  }
  replaceFrom = replaceFrom.trim();
  toReplace = toReplace.trim();
  if (!replaceFrom || !toReplace) {
    return replaceFrom;
  }
  let pathArr = splitPathToArray(toReplace);
  if (!isArrayFull(pathArr)) {
    return replaceFrom;
  }
  pathArr = pathArr.slice(0, pathArr.length - keep);

  let firstPathSepMatched = replaceFrom.match(/^[\\/]+/);
  let sep = getSepFromPath(replaceFrom);
  let hadLastSep = hasLastPathSep(replaceFrom);
  replaceFrom = replaceFrom.replace(/[\\/]/g, "/");
  toReplace = toReplace.replace(/[\\/]/g, "/");

  toReplace = pathArr.join("/");

  toReplace = removeFirstPathSep(toReplace);
  toReplace = ensureLastSubString(toReplace, "/");
  replaceFrom = removeFirstPathSep(replaceFrom);
  replaceFrom = ensureLastSubString(replaceFrom, "/");

  if (replaceWith) {
    replaceWith = ensureLastSubString(replaceWith, "/");
    replaceWith = removeFirstPathSep(replaceWith);
  }

  if (replaceFrom.startsWith(toReplace)) {
    replaceFrom = replaceFrom.slice(toReplace.length);
    replaceFrom = replaceWith + replaceFrom;
  } else {
    if (firstPathSepMatched) {
      replaceFrom = firstPathSepMatched[0] + removeFirstPathSep(replaceFrom);
    } else {
      replaceFrom = removeFirstPathSep(replaceFrom);
    }
  }

  if (!hadLastSep) {
    replaceFrom = removeLastPathSep(replaceFrom);
  }

  return replaceFrom.replace(/[\\/]/g, sep);
}

function isPathsEqualByOS(
  fullPath1 = "",
  fullPath2 = "",
  matchCase = true,
  matchAbsolute = true
) {
  if (!isStringFull(fullPath1) || !isStringFull(fullPath2)) {
    return false;
  }
  if (
    matchAbsolute &&
    (!isPathAbsolute(fullPath1) || !isPathAbsolute(fullPath2))
  ) {
    return false;
  }
  /* 
  linux filenames are case sensitive
  a1 and A1 file names can exist under same directory
  windows filenames are not case sensitive. 
  the are just case preserving
  */
  fullPath1 = replacePathSepToOS(removeLastPathSep(fullPath1));
  fullPath2 = replacePathSepToOS(removeLastPathSep(fullPath2));
  if (isOSWindows() || !matchCase) {
    return fullPath1.toLowerCase() === fullPath2.toLowerCase();
  }
  return fullPath1 === fullPath2;
}

function isChildOfParentDir({
  parentPath = "",
  childPath = "",
  isAbsolute = true,
  matchCase = true,
  directChild = false,
} = {}) {
  if (
    !isString(parentPath) ||
    !isString(childPath) ||
    !isBool(isAbsolute) ||
    !isBool(matchCase)
  ) {
    throwError(["374cae95-45ed-42e5-abdc-593620e8b38f", parentPath, childPath]);
  }
  parentPath = ensureLastPathSep(parentPath);
  childPath = ensureLastPathSep(childPath);
  if (
    isAbsolute &&
    (!isPathAbsolute(parentPath) || !isPathAbsolute(childPath))
  ) {
    throwError(["e99249e5-feba-5027-90c8-26beed84526d", parentPath, childPath]);
  }
  if (!matchCase) {
    parentPath = parentPath.toLowerCase();
    childPath = childPath.toLowerCase();
  }
  if (childPath === parentPath) {
    return false;
  }
  parentPath = ensureLastPathSep(replacePathSepToOS(parentPath));
  childPath = removeLastPathSep(replacePathSepToOS(childPath));

  if (directChild && getPathDepth(parentPath) !== getPathDepth(childPath) - 1) {
    return false;
  }

  return childPath.startsWith(parentPath);
}

function saveAsJson(obj, fullpath, sync, overwrite = true) {
  /* 
  nodejs writeFile method replaces existing file.
  so better to check file if exists and throw error if you not want to overwrite file
  */
  if (!isPathAbsolute(fullpath)) {
    throwError(["ac929088-8dbf-54d2-894a-cefa8b183bbd", fullpath]);
  }
  let flag = overwrite ? "w" : "wx";
  return writeFile(fullpath, JSON.stringify(obj), { flag }).catch((e) => {
    throwError(["441d6cc3-50ba-42ef-b8a2-ab288cf512bc", obj, fullpath, e]);
  });
}

function readJsonFile(fullpath, sync) {
  if (!isPathAbsolute(fullpath)) {
    throwError(["2b946801-c847-554a-9917-9d71d2667e8d", fullpath]);
  }
  return (async () => {
    try {
      return JSON.parse(await readFile(fullpath, "utf8"));
    } catch (e) {
      throwError(["5c20364b-426a-5346-b8de-1ebc32591aaf", fullpath, e]);
    }
  })();
}

async function isHostAlive(ip, { timeout = 700, count = 1 } = {}) {
  if (!isNumber(timeout) || !isNumber(count) || !isString(ip)) {
    throwError(["75a26861-dc75-56c7-820e-7230b6f925d0", timeout, count, ip]);
  }
  let result;
  let cmd = "";
  let testString = "";
  if (timeout < 200) {
    timeout = 200;
  }
  if (count < 1) {
    count = 1;
  }
  if (isOSWindows()) {
    cmd = `ping -n ${count} -w ${timeout}`;
    testString = "(100% loss)";
  } else {
    timeout = (timeout / 1000).toFixed(1);
    cmd = `ping -c ${count} -W ${timeout}`;
    testString = "100% packet loss";
  }

  try {
    result = await promiseWithTimeout(
      new Promise((res, rej) => {
        execute(cmd + " " + ip)
          .then((r) => res(r))
          .catch((e) => rej(e));
      }),
      count * timeout + 20
    );
  } catch (e) {
    // console.log(e)
    return false;
  }

  if (result.stdout && !result.stdout.includes(testString)) {
    return true;
  }
  return false;
}

async function httpRequest(
  url,
  {
    method = "GET",
    body,
    timeoutS = 5,
    headers = {},
    rejectUnauthorized = false,
    query,
    params,
    querySlash,
    jsonResponse = false,
    agent,
  } = {}
) {
  if (!isStringFull(url) || !isObject(headers) || !isFloat(timeoutS)) {
    throwError([
      "1e7f9925-530d-4c76-9f08-bac736d94c63",
      url,
      headers,
      timeoutS,
    ]);
  }
  if (query && params) {
    throwError(["b49dcbc0-cf53-4e35-94d4-21fe54a7cedd", query, params]);
  }
  timeoutS = timeoutS * 1000;
  headers = stringifyCopyObj(headers);

  if (isObjectFull(body)) {
    let keys = getUniqueElements(Object.keys(headers));
    if (!arrayHasAny(keys, ["Content-Type", "content-type"])) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
    let contentTypeValue = headers["Content-Type"] || headers["content-type"];
    if (isStringEqual(contentTypeValue, "application/json", false)) {
      body = JSON.stringify(body);
    } else {
      body = stringify(body);
    }
    if (!arrayHasAny(keys, ["Content-Length", "content-length"])) {
      headers["Content-Length"] = body.length;
    }
  } else if (isStringFull(body) || isFloat(body)) {
    body = body + "";
  }

  let hasBody = isStringFull(body);

  query = query || params;

  let { protocol, hostname, pathname, port, searchParams } = new URL(url);

  if (query instanceof URLSearchParams) {
    searchParams = new URLSearchParams([...searchParams, ...query]);
  } else if (isObjectFull(query)) {
    for (let k in query) {
      searchParams.append(k, query[k]);
    }
  }
  searchParams = searchParams.toString();

  if (isStringFull(searchParams)) {
    if (querySlash) {
      pathname = ensureLastSubString(pathname, "/");
    }
    pathname += "?" + searchParams;
  }
  let httpx = http;
  if (protocol.includes("https")) {
    httpx = https;
  }
  let res = {
    data: "",
    status: null,
    headers: null,
    statusMessage: "",
    statusCode: null,
    error: null,
    ok: true,
    pathname,
    protocol,
    hostname,
    port,
    reqHeaders: headers,
  };
  await new Promise((resolve) => {
    let req = httpx.request(
      {
        rejectUnauthorized,
        hostname,
        port: port || 80,
        path: pathname,
        method,
        headers,
        timeout: timeoutS,
        agent,
      },
      (r) => {
        res.headers = r.headers;
        res.status = r.statusCode;
        res.statusCode = r.statusCode;
        res.statusMessage = r.statusMessage;
        r.on("data", (chunk) => {
          res.data += chunk;
        });
        r.on("end", () => {
          resolve(res);
        });
        r.on("error", (e) => {
          r.destroy();
          res.error = e;
          resolve(res);
          // reject(e);
        });
      }
    );
    req.on("error", (e) => {
      res.error = e;
      req.destroy();
      resolve(res);
      // reject(e);
    });
    req.on("timeout", (e) => {
      res.error = e;
      req.destroy();
      resolve(res);
      // reject(e);
    });
    if (hasBody) {
      req.write(body);
    }
    req.end();
  });

  if (jsonResponse && isStringFull(res.data)) {
    try {
      res.data = JSON.parse(res.data);
    } catch (e) {
      res.error = e;
    }
  }
  res.ok = !res.error;
  let { statusCode } = res;
  if (statusCode >= 400 && statusCode < 600) {
    res.ok = false;
    res.error = true;
  }
  return res;
}

async function isPortListening({ ip, port, timeout = 1 } = {}) {
  if (!isFloat(timeout) || !isStringFull(ip)) {
    throwError(["852b4850-ba7d-46ac-8aec-d20b70d5150a", timeout, ip]);
  }
  if (!port) {
    port = getPortFromIP(ip);
    if (port) {
      ip = removePortFromIP(ip);
    }
  }
  if (!isNumber(port, { checkInteger: true, parse: true })) {
    throwError(["e444fcf4-2d94-4a64-9a2b-369f17d5a3a3", port]);
  }
  port = parseInt(port);
  let socket;
  let result = false;
  try {
    result = await promiseWithTimeout(
      new Promise((resolve) => {
        socket = createConnection(port, ip, function () {
          resolve(true);
        });
        socket.on("error", function () {
          resolve(false);
        });
      }),
      timeout * 1000
    );
  } catch (e) {
    result = false;
  } finally {
    if (socket && socket.destroy) {
      socket.destroy();
    }
  }
  return result;
}

function isCmdOk(
  cmd,
  {
    args,
    outputIncludes,
    matchCase = false,
    matchAll = true,
    cmdInQuotes = true,
    sync = false,
  } = {}
) {
  let output = "";
  if (isString(args)) {
    args = [args];
  }
  if (isString(outputIncludes)) {
    outputIncludes = [outputIncludes];
  }
  if (
    !isStringFull(cmd) ||
    !isArrayOfStrings(args, { emptyStringAllowed: false }) ||
    !isArrayOfStrings(outputIncludes, { emptyStringAllowed: false })
  ) {
    throwError([
      "20c6703e-072b-4955-b827-3937bb7c6436",
      cmd,
      args,
      outputIncludes,
    ]);
  }
  if (cmdInQuotes) {
    cmd = ensureInSubstring(cmd, '"');
  }
  args.unshift(cmd);

  let checkOutput = function (output) {
    if (isArrayFull(outputIncludes)) {
      if (!isStringFull(output?.stdout)) {
        return false;
      }
      output = output.stdout;
      if (matchAll) {
        if (!stringIncludesAll(output, outputIncludes, matchCase)) {
          return false;
        }
      } else {
        if (!stringIncludesAny(output, outputIncludes, matchCase)) {
          return false;
        }
      }
    }
    return true;
  };

  if (sync) {
    try {
      output = execSync(args.join(" "));
    } catch (e) {
      return false;
    }
    return checkOutput(output);
  }

  return (async () => {
    try {
      output = await execute(args.join(" "));
    } catch (e) {
      return false;
    }
    return checkOutput(output);
  })();
}

function isNetworkPath(fullPath) {
  if (!isStringFull(fullPath)) {
    return false;
  }
  if (!isPathAbsolute(fullPath)) {
    // console.log("if (!isPathAbsolute(fullPath)) {");
    return false;
  }
  let ip = splitPathToArray(fullPath)[0];
  // console.log(ip);
  if (!(isIPv4(ip) || isIPv6(ip))) {
    return false;
  }
  return ip;
}

function pathsToTree(paths, key = "path", rootPathToRemove) {
  if (!isArray(paths)) {
    throwError(["f5fc8e73-ef42-461b-8b2e-17c85f5c6874", paths]);
  }
  if (isStringFull(rootPathToRemove)) {
    paths = paths.map((s) => replaceStartOfPath(s, rootPathToRemove, ""));
  }
  let isObj = isObject(paths[0]);
  let result = [];
  let level = { result };
  for (let path of paths) {
    if (isObj) {
      if (!isString(path[key])) {
        throwError(["6197ab15-7e95-42d4-8ef7-b1e1be4cb5c3", path, key]);
      }
      path = path[key];
    }
    splitPathToArray(path).reduce((r, fNameS) => {
      if (!r[fNameS]) {
        r[fNameS] = { result: [] };
        r.result.push({
          fNameS,
          children: r[fNameS].result,
        });
      }
      return r[fNameS];
    }, level);
  }
  let attachPaths = function (children, parent = "") {
    return children.map((s) => {
      s[key] = join(parent, s[key] || s.fNameS);
      delete s.fNameS;
      if (isObj) {
        let found = paths.find((s1) =>
          isPathsEqualByOS(s1[key], s[key], true, false)
        );
        if (found) {
          s = { ...found, ...s };
        }
      }
      if (isArrayFull(s.children)) {
        s.children = attachPaths(s.children, s[key]);
      } else {
        delete s.children;
      }
      return s;
    });
  };
  result = attachPaths(result, "");
  return result;
}

// cU shouldn't have any methods from node cU

export { ensureLastPathSep, ensurePath, execute, getFileBaseName, getSepFromPath, httpRequest, isChildOfParentDir, isCmdOk, isDir, isFileOrDir, isHostAlive, isNetworkPath, isOSWindows, isPathAbsolute, isPathsEqualByOS, isPortListening, pathsToTree, readJsonFile, replacePathSepToOS, replaceStartOfPath, saveAsJson };
