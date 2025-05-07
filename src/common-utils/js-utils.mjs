const json_stringify = JSON.stringify;

function getForbiddenFileNameChars() {
  return ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
}

function ensureLastSubString(str, subStr, matchCase = true) {
  if (!isString(str) || !isString(subStr)) {
    throwError(["c79e853f-72b6-49ca-9c11-322b160f2173", str, subStr]);
  }
  let exists = false;
  let subStringLength = subStr.length;
  if (subStringLength === 0) {
    return str;
  }
  str = str.trim();
  if (matchCase) {
    exists = str.slice(-subStringLength) === subStr;
  } else {
    exists = str.slice(-subStringLength).toLowerCase() === subStr.toLowerCase();
  }
  if (exists) {
    return str;
  }
  return str + subStr;
}

function ensureFirstSubString(str, subStr, matchCase = true) {
  if (!isString(str) || !isString(subStr)) {
    throwError(["c79e853f-72b6-49ca-9c11-322b160f2173", str, subStr]);
  }
  let exists = false;
  let subStringLength = subStr.length;
  if (subStringLength === 0) {
    return str;
  }
  str = str.trim();
  if (matchCase) {
    exists = str.slice(0, subStringLength) === subStr;
  } else {
    exists =
      str.slice(0, subStringLength).toLowerCase() === subStr.toLowerCase();
  }
  if (exists) {
    return str;
  }
  return subStr + str;
}

function splitArrayIntoChunks(arr, chunkSize) {
  if (!isFloat(chunkSize) || chunkSize <= 0) {
    throwError([chunkSize, "02c3027a-94f5-5a16-a390-a09e09192709"]);
  }
  chunkSize = Math.ceil(chunkSize);
  let result = [];
  while (arr.length) {
    result.push(arr.splice(0, chunkSize));
  }
  return result;
}

function combineArrayChunks(a) {
  let result = [];
  while (a.length) {
    for (let single of a.shift()) {
      result.push(single);
    }
  }
  return result;
}

function isObject(value) {
  // return  typeof value === 'object' &&
  //   value !== null // && (value.constructor.toString().indexOf("Object") > -1)
  return typeof value === "object" && value !== null;
}
function isObjectFull(obj) {
  if (!isObject(obj)) {
    return false;
  }
  for (let s in obj) {
    if (hasOwnProp(obj, s)) {
      return true;
    }
  }
  return false;
}

function isArray(arr) {
  return Array.isArray(arr);
}
function isArrayFull(arr) {
  return isArray(arr) && arr.length > 0;
}

function isNumber(
  value,
  { checkInteger = true, parse = false, negative = false } = {}
) {
  if (parse && isString(value)) {
    value = value.trim();
    if (value.match(/^-?\d+(\.\d+)?$/)) {
      // if (value.match(/^\d+$/) || value.match(/^\d+\.\d+$/)) {
      value = parseFloat(value);
    }
  }
  if (typeof value === "number" && !isNaN(value)) {
    if (!negative && value < 0) {
      return false;
    }
    if (checkInteger) {
      if (Number.isInteger(value)) {
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isFloat(value, { parse = false, negative = false } = {}) {
  if (parse && isString(value)) {
    value = value.trim();
    if (value.match(/^-?\d+(\.\d+)?$/)) {
      value = parseFloat(value);
    }
  }
  if (typeof value === "number" && !isNaN(value)) {
    if (!negative && value < 0) {
      return false;
    }
    return true;
  }
  return false;
}

function removeFromStartIfExists(str, toRemoveList, matchCase = true) {
  if (isString(toRemoveList)) {
    toRemoveList = [toRemoveList];
  }
  if (!isString(str) || !isArrayOfStrings(toRemoveList)) {
    throwError([str, toRemoveList, "ae472ff3-f587-59de-aea5-205250606455"]);
  }
  toRemoveList = sortStringsByLength(toRemoveList, "d");
  let foundIndex = toRemoveList.findIndex((s) => {
    if (matchCase) {
      return str.startsWith(s);
    }
    return startsWithNoCase(str, s);
  });
  if (foundIndex === -1) {
    return str;
  }
  return str.slice(toRemoveList[foundIndex].length);
}

function removeFromEnd(s, numToRemove) {
  if (!isFunction(s?.slice)) {
    return s;
  }
  if (numToRemove > s.length) {
    numToRemove = s.length;
  }
  return s.slice(0, s.length - numToRemove);
}

function removeFromStart(s, numToRemove) {
  if (!isFunction(s?.slice)) {
    return s;
  }
  if (numToRemove > s.length) {
    numToRemove = s.length;
  }
  return s.slice(numToRemove);
}

function removeFirstPathSep(dir) {
  if (!isString(dir)) {
    throwError([dir, "589e098e-da2e-50be-9e83-6d73dd65b56a"]);
  }
  dir = dir.trim();
  if (dir.match(/^[/\\]+/)) {
    return dir.replace(/^[/\\]+/, "");
  }
  return dir;
}

function replaceBackslashToForward(str) {
  if (!isString(str)) {
    throwError("73f77d45-080c-5d91-9eb1-10ed4c5624a9");
  }
  return str.replace(/[\\]/g, "/");
}

function indexOfNoCase(arr, val) {
  return arr.findIndex((item) => {
    if (isString(val) && isString(item)) {
      return val.toLowerCase() === item.toLowerCase();
    }
    return val === item;
  });
}

function stringIndexOfNoCase(str, subStr) {
  return str.toLowerCase().indexOf(subStr.toLowerCase());
}

function startsWithNoCase(str, startStr) {
  return str.toLowerCase().startsWith(startStr.toLowerCase());
}

function startsWithAny(str, startStrList, matchCase = true) {
  if (isString(startStrList)) {
    startStrList = [startStrList];
  }
  if (!isString(str) || !isArrayOfStrings(startStrList)) {
    throwError(["a9b62fc3-72df-4b3a-93d6-71e641f98122", startStrList, str]);
  }
  return (
    startStrList.findIndex((s) => {
      if (matchCase) {
        return str.startsWith(s);
      }
      return startsWithNoCase(str, s);
    }) !== -1
  );
}

function stringIncludesNoCase(str, subStr) {
  return stringIndexOfNoCase(str, subStr) !== -1;
}

function includesNoCase(arr, val) {
  if (!isArray(arr)) {
    arr = [arr];
  }
  return indexOfNoCase(arr, val) !== -1;
}

function getDuplicates(arr = [], matchCase = false) {
  if (!isArray(arr)) {
    throwError([arr, "d4aa65ad-6936-58c0-9ace-02e5cecbcbb0"]);
  }
  if (!matchCase) {
    let duplicates = arr.filter((v, i, a) => indexOfNoCase(a, v) !== i);
    if (isArrayFull(duplicates)) {
      return arr.filter((v) => indexOfNoCase(duplicates, v) !== -1);
    }
    return duplicates;
  }
  return arr.filter((item, index) => arr.indexOf(item) !== index);
}

function hasDuplicates(arr = [], matchCase = false) {
  let duplicatesInArray = getDuplicates(arr, matchCase);
  return isArrayFull(duplicatesInArray) ? duplicatesInArray : false;
}

function getUniqueElements(arr, ignoreCase) {
  if (!isArray(arr)) {
    throwError(["10d97e53-455f-44cb-80e4-0f23e36786d0", arr]);
  }
  {
    return arr.filter((v, i, a) => indexOfNoCase(a, v) === i);
  }
}

function isDeepEqualObj(
  o1,
  o2,
  { propsToMatch, ignoreCase, skipLengthMatch } = {}
) {
  if (!isObject(o1) || !isObject(o2)) {
    return o1 === o2;
  }
  if (isString(propsToMatch)) {
    propsToMatch = [propsToMatch];
  }
  if (isArrayFull(propsToMatch)) {
    if (!isArrayOfStrings(propsToMatch, { emptyStringAllowed: false })) {
      throwError(["f94c5cdf-d461-47d7-a993-64a8739a7237", propsToMatch]);
    }
    let o3 = getNestedProps(o1, propsToMatch, undefined, true, true);
    let o4 = getNestedProps(o2, propsToMatch, undefined, true, true);
    if (ignoreCase) {
      for (let p of propsToMatch) {
        if (hasNestedProp(o3, p)) {
          let v1 = getNestedProp(o3, p);
          if (isString(v1)) {
            setNestedProp(o3, p, v1.toLowerCase());
          }
        }
        if (hasNestedProp(o4, p)) {
          let v1 = getNestedProp(o4, p);
          if (isString(v1)) {
            setNestedProp(o4, p, v1.toLowerCase());
          }
        }
      }
    }
    o1 = o3;
    o2 = o4;
  }
  const keys1 = Object.keys(o1);
  const keys2 = Object.keys(o2);
  if (!skipLengthMatch && keys1.length !== keys2.length) {
    return false;
  }
  for (const key of keys1) {
    const val1 = o1[key];
    const val2 = o2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (
      (areObjects && !isDeepEqualObj(val1, val2)) ||
      (!areObjects && val1 !== val2)
    ) {
      return false;
    }
  }
  return true;
}

function splitPathToArray(path) {
  if (!isString(path)) {
    throwError(["6f7a6ccb-7214-4175-85cf-fbdbcefd1caa", path]);
  }
  return path.split(/[\\/]+/).filter((single) => single);
}

function hasLastPathSep(path) {
  return ["\\", "/"].includes(path.slice(-1));
}

function removeLastPathSep(dir) {
  if (!isString(dir)) {
    throwError([dir, "74ebf18a-2b83-5788-98ff-c64695297c34"]);
  }
  dir = dir.trim();
  if (dir.match(/[/\\]+$/)) {
    return dir.replace(/[/\\]+$/, "");
  }
  return dir;
}

function isString(value) {
  return typeof value === "string" || value instanceof String;
}

function isStringFull(value) {
  return isString(value) && value.length > 0;
}

function isStringFullTrimmed(value) {
  return isString(value) && value.trim().length > 0;
}

function isStringEqual(str1, str2, matchCase = true) {
  if (!isString(str1) || !isString(str2) || matchCase) {
    return str1 === str2;
  }
  return str1.toLowerCase() === str2.toLowerCase();
}

function hasOwnProp(obj, propName) {
  if (!(isStringFull(propName) || isFloat(propName)) || !isObject(obj)) {
    throwError(["01231b1a-77fc-41fa-ac08-a5bab19e6c0f", propName, obj]);
  }
  return Object.hasOwn(obj, propName);
}

function hasNestedProp(obj, path) {
  if (isString(path)) {
    path = path.split(".").map((s) => s.trim());
  } else if (isFloat(path)) {
    path = [path];
  }
  if (
    !isArrayFull(path) ||
    !isArrayOfStringsOrFloats(path, { emptyStringAllowed: false })
  ) {
    throwError(["356e804d-2825-4fbc-93f0-74f4edc9f0ab", path]);
  }
  const lastKey = path.pop();
  const lastObj = path.reduce((obj, key) => {
    if (!isObject(obj) || !isObject(obj[key])) {
      return false;
    }
    return obj[key];
  }, obj);
  return lastObj && hasOwnProp(lastObj, lastKey);
}

function isArrayOfStringsOrFloats(arr, { emptyStringAllowed = true }) {
  return (
    isArray(arr) &&
    arr.every((single) => {
      if (isString(single) && !emptyStringAllowed && single.length === 0) {
        return false;
      }
      return isString(single) || isFloat(single);
    })
  );
}

function isStringOrFloat(val) {
  return isString(val) || isFloat(val);
}

function getNestedProp(
  obj,
  path,
  defaultValue = undefined,
  stringifyCopyObj = false
) {
  if (isString(path)) {
    path = path.split(".").map((s) => s.trim());
  } else if (isFloat(path)) {
    path = [path];
  }
  if (!isArrayOfStringsOrFloats(path, { emptyStringAllowed: false })) {
    throwError(["638c10d5-67d1-4d33-9286-647e4d897a24", path]);
  }
  let index = function (obj, i) {
    if (isObject(obj) && hasOwnProp(obj, i) && obj[i] !== undefined) {
      return obj[i];
    } else {
      return defaultValue;
    }
  };
  let value = path.reduce(index, obj);
  if (stringifyCopyObj && isObject(value)) {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

function getNestedProps(
  obj,
  paths,
  defaultValue = undefined,
  stringifyCopyObj = false,
  setOnlyIfExist
) {
  if (isStringOrFloat(paths)) {
    paths = [paths];
  }
  let resultObj = {};
  for (let s of paths) {
    if (setOnlyIfExist && !hasNestedProp(obj, s)) {
      continue;
    }
    setNestedProp(
      resultObj,
      s,
      getNestedProp(obj, s, defaultValue, stringifyCopyObj)
    );
  }
  return resultObj;
}

function setNestedProp(obj, path, val, skipIfHasValue = false) {
  if (isString(path)) {
    path = path.split(".").map((s) => s.trim());
  } else if (isStringOrFloat(path)) {
    path = [path];
  }
  if (
    !isArrayOfStringsOrFloats(path, { emptyStringAllowed: false }) ||
    !isObject(obj)
  ) {
    throwError(["638c10d5-67d1-4d33-9286-647e4d897a24", path]);
  }

  const lastKey = path.pop();
  const lastObj = path.reduce((obj, key) => (obj[key] = obj[key] || {}), obj);
  if (skipIfHasValue && lastObj[lastKey] !== undefined) {
    return obj;
  }
  lastObj[lastKey] = val;
  return obj;
}

function arrayHasAny(arr, values) {
  if (!isArray(arr) || !isArray(values)) {
    throwError(["3ff46e34-8d05-4649-96b0-e6187c4e178f", arr, values]);
  }
  return values.findIndex((s) => arr.includes(s)) !== -1;
}

function getUnixTimestampInS() {
  return Math.floor(Date.now() / 1000);
}

function sanitizeFilename(str = "", replaceWith = " ") {
  // if i use space to split then sapce thats already there willl also be replaced with replaceWith
  let specialString = "$--$$--$";
  // this special string should not contain any forbidden chars
  for (let single of getForbiddenFileNameChars()) {
    str = str.split(single).join(specialString);
  }
  str = str
    .split(specialString)
    .filter((single) => single !== "")
    .join(replaceWith);
  str = str.replace(/\s\s+/g, " ").trim();
  return str;
}

function sortObjects(arr = [], propertyName, order = "a") {
  if (
    !(isString(propertyName) || isArray(propertyName)) ||
    !isStringFull(order)
  ) {
    throwError([
      arr,
      propertyName,
      order,
      "3f55574d-bcbe-5329-aaf7-80ebc7d4be31",
    ]);
  }
  if (!isArray(arr)) {
    return arr;
  }
  let ascSort = includesNoCase(["a", "asc"], order);

  arr.sort(function (a1, b1) {
    let a1Prop = getNestedProp(a1, propertyName, "");
    let b1Prop = getNestedProp(b1, propertyName, "");
    if (isString(a1Prop) && isString(b1Prop)) {
      if (ascSort) {
        return a1Prop.localeCompare(b1Prop);
      } else {
        return b1Prop.localeCompare(a1Prop);
      }
    }
    if (ascSort) {
      if (a1Prop < b1Prop) {
        return -1;
      }
      if (a1Prop > b1Prop) {
        return 1;
      }
      return 0;
    } else {
      if (a1Prop < b1Prop) {
        return 1;
      }
      if (a1Prop > b1Prop) {
        return -1;
      }
      return 0;
    }
  });
  return arr;
}

function sortStringsByLength(arr, order = "a", stringify = false) {
  if (!isArray(arr) || !isStringFull(order)) {
    throwError(["f3bcd368-e4db-4417-93e5-77c865f31e20", arr, order]);
  }
  order = order.toLowerCase();
  if (stringify) {
    arr = stringifyCopyObj(arr);
  }
  return arr.sort((a, b) => {
    let l1 = isNumber(a?.length) ? a.length : 0;
    let l2 = isNumber(b?.length) ? b.length : 0;
    return order === "a" ? l1 - l2 : l2 - l1;
  });
}

function isError(s) {
  return (s && s?.stack) || s instanceof Error;
}

async function promiseWithTimeout(promise, timeoutMs) {
  if (timeoutMs < 1) {
    return promise;
  }
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`timed out in ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([promise, timeoutPromise])
    .then((result) => result)
    .finally(() => clearTimeout(timeoutHandle));
}

function isGUID(str) {
  return isString(str) && str.match(/[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/);
}

function throwError(errorInfo, ...args) {
  // i can't include a function that throws error inside this function
  let error = {
    time: new Date().toLocaleString(),
  };
  /*  
  let errorInfo = concatArrays(...args)
  this will make 1st arg as aray item

  flatten will make an array item merge with
  top array that I don't want to merge
  */
  if (isArrayFull(args)) {
    errorInfo = concatArrays(errorInfo, args);
  }
  if (isArray(errorInfo)) {
    error.message = error.errCode =
      errorInfo.find((s) => isGUID(s)) ||
      errorInfo.find((s) => isString(s)) ||
      "";
    let newErrorInfo = [...errorInfo.filter((s) => !isError(s))];
    // error.topInfo = [...newErrorInfo];
    const findNestedErrors = function (infoData) {
      let found = infoData.find((s) => isError(s));
      if (found) {
        newErrorInfo.push("--", found);
        // if (isArray(found.topInfo)) {
        //   newErrorInfo = [...newErrorInfo, ...found.topInfo];
        // }
        if (isArray(found.info)) {
          findNestedErrors(found.info);
        }
      }
    };
    findNestedErrors(errorInfo);
    errorInfo = newErrorInfo;
  } else if (isString(errorInfo) || isFloat(errorInfo)) {
    error.message = error.errCode = errorInfo;
  }
  error.info = errorInfo;
  let errorObj = new Error();
  /* no error stack
    Object.setPrototypeOf(error, Error.prototype);
    throw error;
 */
  Object.assign(errorObj, error);
  throw errorObj;
}

function isArrayOfStrings(arr, { emptyStringAllowed = true } = {}) {
  return (
    isArray(arr) &&
    arr.every((s) => {
      if (isString(s) && !emptyStringAllowed && s.length === 0) {
        return false;
      }
      return isString(s);
    })
  );
}

function ensureInSubstring(str, subStr, matchCase = true) {
  if (!isString(str) || !isString(subStr)) {
    throwError([str, subStr, "75aed006-652c-5412-bcb8-d735046c1a52"]);
  }
  str = ensureFirstSubString(str, subStr, matchCase);
  str = ensureLastSubString(str, subStr, matchCase);
  return str;
}

function isBool(boolVar) {
  return boolVar === true || boolVar === false;
}

function stringifyCopyObj(obj, keysToSkip) {
  if (!isObject(obj)) {
    return obj;
  }

  if (isStringOrFloat(keysToSkip)) {
    keysToSkip = [keysToSkip];
  }
  let str;
  try {
    if (isArrayFull(keysToSkip)) {
      str = JSON.stringify(obj, function (k, v) {
        if (keysToSkip.includes(k)) {
          return undefined;
        }
        return v;
      });
    } else {
      str = JSON.stringify(obj);
    }
    return JSON.parse(str);
  } catch (e) {
    throwError(["746a0a52-37d8-5477-b4b6-10ed37d36332", e]);
  }
}

function stringIncludesAny(str, words, matchCase = true) {
  if (isString(words)) {
    words = [words];
  }
  if (!isString(str) || !isArray(words)) {
    throwError(["d17ff8b7-5bb9-4983-ae9b-a1c5fc3e42c1", str, words]);
  }
  return (
    words.findIndex((w) => {
      if (!matchCase) {
        return stringIncludesNoCase(str, w);
      }
      return str.includes(w);
    }) !== -1
  );
}

function stringIncludesAll(str, words, matchCase = true) {
  if (isString(words)) {
    words = [words];
  }
  if (!isString(str) || !isArray(words)) {
    throwError(["a2f13891-5a48-58b6-b0a7-9ef012dcc0f2", str, words]);
  }
  return words.every((w) => {
    if (!matchCase) {
      return stringIncludesNoCase(str, w);
    }
    return str.includes(w);
  });
}

function isValidURL(url) {
  try {
    new URL(url);
  } catch {
    return false;
  }
  return true;
}

function joinURLPaths(...args) {
  let url = "";
  for (let s of args) {
    s = s + "";
    if (!isStringFull(s)) {
      continue;
    }
    s = s.trim();
    url += ensureLastSubString(removeLastPathSep(removeFirstPathSep(s)), "/");
  }
  if (!isValidURL(args[0])) {
    url = ensureFirstSubString(url, "/");
  }
  return removeLastPathSep(url);
}

function caseSnakeToCamel(str) {
  if (!isString(str)) {
    throwError(["1203df3d-25d1-4b4b-916d-f860a8e6117c", str]);
  }
  if (!str.match(/[\W_]/)) {
    return str;
  }
  return str.replace(/[\W_]+([^\W_])/g, (m, g) => g.toUpperCase());
}

function changePropsToCamel(obj, { toSkip, toChange } = {}) {
  if (!isObject(obj)) {
    return obj;
  }
  let newObj = {};
  if (toSkip && !isArray(toSkip)) {
    toSkip = [toSkip];
  }
  if (toChange && !isArray(toChange)) {
    toChange = [toChange];
  }
  for (let s in obj) {
    if (toSkip && toSkip.includes(s)) {
      newObj[s] = obj[s];
    } else {
      if (toChange) {
        if (toChange.includes(s)) {
          newObj[caseSnakeToCamel(s)] = obj[s];
        } else {
          newObj[s] = obj[s];
        }
      } else {
        newObj[caseSnakeToCamel(s)] = obj[s];
      }
    }
  }
  return newObj;
}

function isFunction(functionToCheck) {
  return (
    !!functionToCheck &&
    ({}.toString.call(functionToCheck) === "[object Function]" ||
      typeof functionToCheck === "function" ||
      functionToCheck.constructor === Function ||
      functionToCheck instanceof Function)
  );
}

function concatArrays(...args) {
  return [].concat(...args);
}

function parseCookie(cookie) {
  const list = {};
  if (isString(cookie)) {
    cookie = [cookie];
  }
  if (!isArrayFull(cookie)) {
    return list;
  }
  for (let s of cookie) {
    for (let s1 of s.split(`;`)) {
      let [name, ...rest] = s1.split(`=`);
      name = name?.trim();
      if (!name) {
        continue;
      }
      const value = rest.join(`=`).trim();
      if (!value) {
        continue;
      }
      list[name] = decodeURIComponent(value);
    }
  }
  return list;
}

function ensureURLProtocol(url, fullProtocol) {
  if (url.match(/^(https?:\/\/)/)) {
    return url;
  }
  if (fullProtocol.match(/^(https?:\/\/)?www/)) {
    fullProtocol = ensureLastSubString(fullProtocol, ".");
  }
  return fullProtocol + removeFromStartIfExists(url, ".");
}

function getPathDepth(fullPath) {
  return splitPathToArray(fullPath).length;
}

function versionCompare(a, b) {
  a = a + "";
  b = b + "";
  if (a.startsWith(b + "-")) {
    return -1;
  }
  if (b.startsWith(a + "-")) {
    return 1;
  }
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "case",
    caseFirst: "upper",
  });
}

function getPortFromIP(ipAddress) {
  const match = ipAddress.match(/\[.+]:(\d+)$|:(\d+)$/);
  if (match) {
    return match[1] || match[2];
  }
  return null;
}

function removePortFromIP(ipAddress) {
  return ipAddress.replace(/\[.+]:(\d+)$|:(\d+)$/, "");
}

function objectsToArrays(arr, keys) {
  if (!isArray(arr) || !isArray(keys)) {
    throwError(["9fbaef6f-6df4-44b0-bcd0-9f8371c8d6c0", arr, keys]);
  }
  return arr.map((s) => {
    if (isObject(s) && !isArray(s)) {
      let s1 = [];
      for (let k of keys) {
        s1.push(s[k]);
      }
      s = s1;
    }
    return s;
  });
}

function arraysToObjects(arr, keys) {
  if (!isArray(arr) || !isArray(keys)) {
    throwError(["a85551e4-5e0f-5a01-94d1-5f5dabdb1578", arr, keys]);
  }
  return arr.map((s) => {
    if (isArray(s)) {
      let s1 = {};
      let i = 0;
      for (let k of keys) {
        s1[k] = s[i];
        i++;
      }
      s = s1;
    }
    return s;
  });
}

export { arrayHasAny, arraysToObjects, caseSnakeToCamel, changePropsToCamel, combineArrayChunks, concatArrays, ensureFirstSubString, ensureInSubstring, ensureLastSubString, ensureURLProtocol, getDuplicates, getNestedProp, getNestedProps, getPathDepth, getPortFromIP, getUniqueElements, getUnixTimestampInS, hasDuplicates, hasLastPathSep, hasNestedProp, hasOwnProp, includesNoCase, indexOfNoCase, isArray, isArrayFull, isArrayOfStrings, isArrayOfStringsOrFloats, isBool, isDeepEqualObj, isError, isFloat, isFunction, isGUID, isNumber, isObject, isObjectFull, isString, isStringEqual, isStringFull, isStringFullTrimmed, isStringOrFloat, isValidURL, joinURLPaths, json_stringify, objectsToArrays, parseCookie, promiseWithTimeout, removeFirstPathSep, removeFromEnd, removeFromStart, removeFromStartIfExists, removeLastPathSep, removePortFromIP, replaceBackslashToForward, sanitizeFilename, setNestedProp, sortObjects, sortStringsByLength, splitArrayIntoChunks, splitPathToArray, startsWithAny, startsWithNoCase, stringIncludesAll, stringIncludesAny, stringIncludesNoCase, stringIndexOfNoCase, stringifyCopyObj, throwError, versionCompare };
