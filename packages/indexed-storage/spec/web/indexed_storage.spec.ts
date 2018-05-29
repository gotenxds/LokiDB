/* global describe, it, expect */
import { Loki } from "../../../loki/src/loki";
import { IndexedStorage } from "../../src/indexed_storage";

declare var require: (moduleId: string) => any;
const loki = require("../../../lokijs/lokijs.js");
const indexedAdapter = require("../../../lokijs/loki-indexed-adapter.js");

describe("testing indexed storage", function () {

  interface Name {
    name: string;
  }

  beforeAll(() => {
    IndexedStorage.register();
  });

  afterAll(() => {
    IndexedStorage.deregister();
  });

  it("LokiIndexedStorage", function (done) {
    const db = new Loki("myTestApp");
    const adapter = {adapter: new IndexedStorage()};
    db.initializePersistence(adapter)
      .then(() => {
        db.addCollection<Name>("myColl").insert({name: "Hello World"});
        return db.saveDatabase();
      })
      .then(() => {
        const db2 = new Loki("myTestApp");
        return db2.initializePersistence()
          .then(() => {
            return db2.loadDatabase();
          }).then(() => {
            expect(db2.getCollection<Name>("myColl").find()[0].name).toEqual("Hello World");
          });
      })
      .then(() => {
        const db2 = new Loki("myTestApp");
        return db2.initializePersistence({persistenceMethod: "indexed-storage"})
          .then(() => {
            return db2.loadDatabase();
          }).then(() => {
            expect(db2.getCollection<Name>("myColl").find()[0].name).toEqual("Hello World");
          });
      })
      .then(() => {
        const db3 = new Loki("other");
        return db3.initializePersistence()
          .then(() => {
            return db3.loadDatabase();
          }).then(() => {
            expect(false).toEqual(true);
          }, () => {
            expect(true).toEqual(true);
          });
      })
      .then(() => {
        return db.deleteDatabase();
      })
      .then(() => {
        return db.loadDatabase()
          .then(() => {
            expect(db.getCollection<Name>("myColl").find()[0].name).toEqual("Hello World");
            expect(false).toEqual(true);
            done();
          }, () => {
            expect(true).toEqual(true);
            done();
          });
      });
  });

  it("from lokijs", (done) => {
    const legacyDB = new loki("legacyDB", {adapter: new indexedAdapter()});
    const coll = legacyDB.addCollection("myColl");
    coll.insert({name: "Hello World"});
    legacyDB.saveDatabase(() => {
      // Load with LokiDB.
      const db = new Loki("legacyDB");
      return db.initializePersistence()
        .then(() => {
          return db.loadDatabase();
        }).then(() => {
          expect(db.getCollection<Name>("myColl").find()[0].name).toEqual("Hello World");
          return db.deleteDatabase();
        }).then(() => {
          done();
        });
    });
  });
});
