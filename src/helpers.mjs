import { hasDuplicates, throwError, getNestedProp, isArrayFull, isDeepEqualObj, hasNestedProp, isObjectFull, isStringFull, isArray, isObject, isFloat } from './common-utils/js-utils.mjs';
import { isPortListening } from './common-utils/node-utils.mjs';

const clientTypes = {
  deluge: 1,
  rTorrent: 2,
  qBittorent: 3,
  uTorrent: 4,
  transmission: 5,
};

const filters = {
  stopped: 1,
  running: 2,
  downloading: 3,
  seeding: 4,
  completed: 5,
  error: 6,
  checking: 7,
  incomplete: 8,
};

const allStatus = {
  stopped: 1,
  downloading: 2,
  seeding: 3,
  error: 4,
  checking: 5,
};

const tFields = [
  "addedAt",
  "completedAt",
  "downloaded",
  "downloadingTime",
  "downloadLimitKBps",
  "downloadRate",
  "error",
  "fileCount",
  "hash",
  "hashV2",
  "isFinished",
  "isPrivate",
  "magnetLink",
  "message",
  "mimeType",
  "name",
  "peers",
  "percentDone",
  "pieceCount",
  "pieceSize",
  "position",
  "ratio",
  "recheckProgress",
  "savePath",
  "seedingTime",
  "size",
  "status",
  "totalSize",
  "uploaded",
  "uploadLimitKBps",
  "uploadRate",
];

const tfFields = ["path", "size", "progress"];

function formatRatio(ratio) {
  if (isFloat(ratio, { parse: true })) {
    ratio = parseFloat(parseFloat(ratio).toFixed(3));
  }
  return ratio;
}
function hashesToArray(hashes) {
  if (isStringFull(hashes)) {
    hashes = hashes.split("|");
  }
  return hashes || [];
}

function hashesToString(hashes) {
  if (isArray(hashes)) {
    hashes = hashes.join("|");
  }
  return hashes || "";
}

function setLoginCounter(state, errorToThrow) {
  if (!isObject(state)) {
    throwError(["8efbac44-ec52-4c90-9e25-5b6528984f53", state]);
  }
  if (!errorToThrow) {
    delete state.loginCounter;
    return;
  }
  if (!isArray(errorToThrow)) {
    errorToThrow = [errorToThrow];
  }
  state.loginCounter = (state.loginCounter || 0) + 1;
  if (state.loginCounter > 2) {
    throwError([
      "dd33ed5d-c532-45af-b3e0-34d05269b03a",
      state.loginCounter,
      ...errorToThrow,
    ]);
  }
}

async function matchPreferences(
  masterClients = [],
  allClients = [],
  prefsToInclude = {}
) {
  let duplicates = hasDuplicates(masterClients.map((s) => s.clientType));
  if (duplicates) {
    throwError(["701f3691-8489-4fbe-808d-9be84c532566", duplicates]);
  }
  for (let m of masterClients) {
    let { clientType } = m;
    let toInclude = getNestedProp(prefsToInclude, clientType, []);
    if (!isArrayFull(toInclude)) {
      continue;
    }
    let otherClients = allClients.filter(
      (s) => s.clientType === clientType && s.host !== m.host
    );
    if (!isArrayFull(otherClients)) {
      continue;
    }
    if (!(await isPortListening({ ip: m.host, timeout: 1 }))) {
      continue;
    }
    let masterPrefs = await m.getPreferences();
    if (clientType === clientTypes.uTorrent) {
      let prefsToUpdate = [];
      for (let k of masterPrefs) {
        if (toInclude.includes(k[0])) {
          prefsToUpdate.push(k);
        }
      }
      for (let s of otherClients) {
        if (!(await isPortListening({ ip: s.host, timeout: 1 }))) {
          continue;
        }
        let clientPrefs;
        try {
          clientPrefs = await s.getPreferences();
        } catch {
          continue;
        }
        let difference = [];
        for (let k of prefsToUpdate) {
          let found = clientPrefs.find((s) => s[0] === k[0]);
          if (found) {
            if (!isDeepEqualObj(found, k)) {
              difference.push(k);
            }
          }
        }
        if (isArrayFull(difference)) {
          try {
            await s.setPreferences(difference);
          } catch {}
        }
      }
    } else {
      let prefsToUpdate = {};
      for (let k in masterPrefs) {
        if (toInclude.includes(k)) {
          prefsToUpdate[k] = masterPrefs[k];
        }
      }
      for (let s of otherClients) {
        if (!(await isPortListening({ ip: s.host }))) {
          continue;
        }
        let clientPrefs;
        try {
          clientPrefs = await s.getPreferences();
        } catch {
          continue;
        }
        let difference = {};
        for (let k in prefsToUpdate) {
          if (hasNestedProp(clientPrefs, k)) {
            if (!isDeepEqualObj(clientPrefs[k], prefsToUpdate[k])) {
              difference[k] = prefsToUpdate[k];
            }
          }
        }
        if (isObjectFull(difference)) {
          try {
            await s.setPreferences(difference);
          } catch {}
        }
      }
    }
  }
}

export { allStatus, clientTypes, filters, formatRatio, hashesToArray, hashesToString, matchPreferences, setLoginCounter, tFields, tfFields };
