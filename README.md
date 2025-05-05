## Torrent Client API

Get/Update data fom various torrent clients.
Created as an exercise to understand different api types.
Inspired from: [scttcper/qbittorrent](https://github.com/scttcper/qbittorrent "scttcper/qbittorrent")

##### Supported clients:

Deluge, QBittorent, rTorrent (incomplete), Transmission, uTorrent.

**No warranty**
Please read and understand code then use it at your own risk.
Bug fix and feature request messages are welcome and appreciated.

#### API / Example usage:

```javascript
import {
  TorrentClientApi,
  torrentClientTypes,
  torrentFields,
  torrentFilters,
} from "./src/index.mjs";

const qBittorent = new TorrentClientApi({
  clientType: torrentClientTypes.qBittorent,
  baseUrl: "127.0.0.1:10000",
  username: "admin",
  password: "",
  cacheDir: "C:/test-data/cache",
  memCacheTimeout: 5,
});

const hash = "A torrent infohash";
const hashes = [hash];

console.log(
  await qBittorent.getTorrents({
    perPage: 1,
    searchTerm: "abc",
    hashes,
    filter: torrentFilters.completed,
    sort: torrentFields[0], // sort by any field
    reverse: false,
    //
    // if true then data will not be normalized and
    // sort, filter, cache not applied on raw result
    raw: false,
    //
    currentPage: 1,
    //
    fresh: false,
    // if true then fresh data from client will be fetched, else cache data will be returned
  })
);

console.log(
  await qBittorent.getTorrentFiles(hash, {
    // files will be returned as hierarchical tree object instead of array
    asTree: false,
    //
    // data will not be normalized
    raw: false,
    //
    // for ignoring cache and getting fresh data
    fresh: false,
  })
);

console.log(
  await qBittorent.getApiVersion(),
  await qBittorent.getAppVersion(),
  qBittorent.clientType,
  qBittorent.host
);

await qBittorent.renameFile(hash, "old-path", "new-path");

const preferences = await qBittorent.getPreferences();

// This only takes raw preferences data that is returned from getPreferences() method
await qBittorent.setPreferences(preferences);

await qBittorent.setTorrentUploadSpeed(hashes, 50); // limit in KBps
await qBittorent.startTorrents(hashes);
await qBittorent.stopTorrents(hashes);

// clear cache save timers so process can exit during testing
qBittorent.clearTimers();
```
