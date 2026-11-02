// A small in-memory IndexedDB for the Node tests: only what app.js uses (open with an upgrade,
// object stores with a keyPath, readonly/readwrite transactions, get / getAll / put / delete / clear,
// openCursor with continue() and delete(), oncomplete / onerror). Every request answers on a later
// turn of the event loop, as in a browser, and values are copied in and out (structured clone).
//
//   const { createFakeIndexedDB } = require("./_fakeidb.js");
//   const indexedDB = createFakeIndexedDB();
//   load({ globals: { indexedDB } });
//   indexedDB.dump("ludus.remotePgnCache.v1", "verdicts")   // the stored values, for assertions

"use strict";

function later(fn) {
  setTimeout(fn, 0);
}

function createFakeIndexedDB() {
  const databases = new Map(); // name -> { version, stores: Map(name -> { keyPath, data: Map }) }
  const stats = { opens: 0, transactions: 0 };

  function makeDb(record) {
    const db = {
      get objectStoreNames() {
        return { contains: (name) => record.stores.has(name), length: record.stores.size };
      },
      createObjectStore(name, options = {}) {
        record.stores.set(name, { keyPath: options.keyPath || "key", data: new Map() });
      },
      close() {},
      transaction(names, mode = "readonly") {
        const list = Array.isArray(names) ? names : [names];
        list.forEach((name) => {
          if (!record.stores.has(name)) throw new Error(`NotFoundError: no object store ${name}`);
        });
        stats.transactions += 1;
        let pending = 0;
        let finished = false;
        const tx = { oncomplete: null, onerror: null, mode };
        const settle = () => {
          if (pending > 0 || finished) return;
          later(() => {
            if (pending > 0 || finished) return;
            finished = true;
            if (typeof tx.oncomplete === "function") tx.oncomplete();
          });
        };
        const request = (work) => {
          const req = { result: undefined, onsuccess: null, onerror: null };
          pending += 1;
          later(() => {
            req.result = work();
            if (typeof req.onsuccess === "function") req.onsuccess();
            pending -= 1;
            settle();
          });
          return req;
        };
        const writable = () => {
          if (mode !== "readwrite") throw new Error("ReadOnlyError");
        };
        tx.objectStore = (name) => {
          const store = record.stores.get(name);
          return {
            get: (key) => request(() => (store.data.has(key) ? structuredClone(store.data.get(key)) : undefined)),
            getAll: () => request(() => Array.from(store.data.values()).map((value) => structuredClone(value))),
            put: (value) => {
              writable();
              return request(() => {
                store.data.set(value[store.keyPath], structuredClone(value));
                return value[store.keyPath];
              });
            },
            delete: (key) => {
              writable();
              return request(() => store.data.delete(key));
            },
            clear: () => {
              writable();
              return request(() => store.data.clear());
            },
            openCursor: () => {
              const keys = Array.from(store.data.keys());
              let index = -1;
              const req = { result: null, onsuccess: null, onerror: null };
              const step = () => {
                pending += 1;
                later(() => {
                  index += 1;
                  while (index < keys.length && !store.data.has(keys[index])) index += 1;
                  if (index < keys.length) {
                    const key = keys[index];
                    req.result = {
                      key,
                      value: structuredClone(store.data.get(key)),
                      continue: step,
                      delete: () => {
                        writable();
                        store.data.delete(key);
                      },
                    };
                  } else {
                    req.result = null;
                  }
                  if (typeof req.onsuccess === "function") req.onsuccess();
                  pending -= 1;
                  settle();
                });
              };
              step();
              return req;
            },
          };
        };
        settle();
        return tx;
      },
    };
    return db;
  }

  const api = {
    stats,
    open(name, version = 1) {
      stats.opens += 1;
      const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      later(() => {
        let record = databases.get(name);
        if (!record) {
          record = { version: 0, stores: new Map() };
          databases.set(name, record);
        }
        req.result = makeDb(record);
        if (version > record.version) {
          record.version = version;
          if (typeof req.onupgradeneeded === "function") req.onupgradeneeded();
        }
        if (typeof req.onsuccess === "function") req.onsuccess();
      });
      return req;
    },
    deleteDatabase(name) {
      databases.delete(name);
      return { onsuccess: null, onerror: null };
    },
    // Test helpers.
    dump(name, storeName) {
      const record = databases.get(name);
      const store = record && record.stores.get(storeName);
      return store ? Array.from(store.data.values()).map((value) => structuredClone(value)) : [];
    },
    seed(name, version, storeName, values, keyPath = "key") {
      let record = databases.get(name);
      if (!record) {
        record = { version, stores: new Map() };
        databases.set(name, record);
      }
      if (!record.stores.has(storeName)) record.stores.set(storeName, { keyPath, data: new Map() });
      values.forEach((value) => record.stores.get(storeName).data.set(value[keyPath], structuredClone(value)));
    },
  };
  return api;
}

module.exports = { createFakeIndexedDB };
