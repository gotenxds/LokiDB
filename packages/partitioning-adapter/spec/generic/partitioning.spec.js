/* global describe, it, expect */
import {Loki} from "../../../loki/src/loki";
import {LokiMemoryAdapter} from "../../../loki/src/memory_adapter";
import {LokiPartitioningAdapter} from "../../src/partitioning_adapter";

describe("partitioning adapter", () => {
  it("verify partioning adapter works", (done) => {
    const mem = new LokiMemoryAdapter();
    const adapter = new LokiPartitioningAdapter(mem);

    const db = new Loki("sandbox.db");
    let db2;

    db.initializePersistence({adapter: adapter});

    // Add a collection to the database
    const items = db.addCollection("items");
    items.insert({name: "mjolnir", owner: "thor", maker: "dwarves"});
    items.insert({name: "gungnir", owner: "odin", maker: "elves"});
    items.insert({name: "tyrfing", owner: "Svafrlami", maker: "dwarves"});
    items.insert({name: "draupnir", owner: "odin", maker: "elves"});

    const another = db.addCollection("another");
    const ai = another.insert({a: 1, b: 2});

    db.saveDatabase().then(() => {
      // should have partitioned the data
      expect(Object.keys(mem.hashStore).length).toEqual(3);
      expect(mem.hashStore.hasOwnProperty("sandbox.db")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.0")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.1")).toEqual(true);
      // all partitions should have been saved once each
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(1);

      // so let's go ahead and update one of our collections to make it dirty
      ai.b = 3;
      another.update(ai);

      // and save again to ensure lastsave is different on for db container and that one collection
      return db.saveDatabase();
    }).then(() => {
      // db container always gets saved since we currently have no 'dirty' flag on it to check
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(2);
      // we didn't change this
      expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(1);
      // we updated this collection so it should have been saved again
      expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(2);

      // ok now lets load from it
      db2 = new Loki("sandbox.db");

      db2.initializePersistence({adapter: adapter});

      return db2.loadDatabase();
    }).then(() => {
      expect(db2.collections.length).toEqual(2);
      expect(db2.collections[0].data.length).toEqual(4);
      expect(db2.collections[1].data.length).toEqual(1);
      expect(db2.getCollection("items").findOne({name: "gungnir"}).owner).toEqual("odin");
      expect(db2.getCollection("another").findOne({a: 1}).b).toEqual(3);
    }).then(done, done.fail);
  });

  it("verify partioning adapter with paging mode enabled works", (done) => {
    const mem = new LokiMemoryAdapter();

    // we will use an exceptionally low page size (128bytes) to test with small dataset
    const adapter = new LokiPartitioningAdapter(mem, {paging: true, pageSize: 128});

    const db = new Loki("sandbox.db");
    let db2;

    db.initializePersistence({adapter: adapter});

    // Add a collection to the database
    const items = db.addCollection("items");
    items.insert({name: "mjolnir", owner: "thor", maker: "dwarves"});
    items.insert({name: "gungnir", owner: "odin", maker: "elves"});
    const tyr = items.insert({name: "tyrfing", owner: "Svafrlami", maker: "dwarves"});
    items.insert({name: "draupnir", owner: "odin", maker: "elves"});

    const another = db.addCollection("another");
    const ai = another.insert({a: 1, b: 2});

    // for purposes of our memory adapter it is pretty much synchronous
    db.saveDatabase().then(() => {
      // should have partitioned the data
      expect(Object.keys(mem.hashStore).length).toEqual(4);
      expect(mem.hashStore.hasOwnProperty("sandbox.db")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.0.0")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.0.1")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.1.0")).toEqual(true);
      // all partitions should have been saved once each
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.0.1"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(1);

      // so let's go ahead and update one of our collections to make it dirty
      ai.b = 3;
      another.update(ai);

      // and save again to ensure lastsave is different on for db container and that one collection
      return db.saveDatabase();
    }).then(() => {
      // db container always gets saved since we currently have no 'dirty' flag on it to check
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(2);
      // we didn't change this
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(1);
      // we updated this collection so it should have been saved again
      expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(2);

      // now update a multi page items collection and verify both pages were saved
      tyr.maker = "elves";
      items.update(tyr);

      return db.saveDatabase();
    }).then(() => {
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(3);
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
      expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(2);

      // ok now lets load from it
      db2 = new Loki("sandbox.db");
      db2.initializePersistence({adapter: adapter});
      return db2.loadDatabase();
    }).then(() => {
      expect(db2.collections.length).toEqual(2);
      expect(db2.collections[0].data.length).toEqual(4);
      expect(db2.collections[1].data.length).toEqual(1);
      expect(db2.getCollection("items").findOne({name: "tyrfing"}).maker).toEqual("elves");
      expect(db2.getCollection("another").findOne({a: 1}).b).toEqual(3);

      // verify empty collection saves with paging
      db.addCollection("extracoll");
      return db.saveDatabase();
    }).then(() => {
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(4);
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
      expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
      expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(2);
      expect(mem.hashStore["sandbox.db.2.0"].savecount).toEqual(1);

      // now verify loading empty collection works with paging codepath
      db2 = new Loki("sandbox.db");
      db2.initializePersistence({adapter: adapter});
      return db2.loadDatabase();
    }).then(() => {
      expect(db2.collections.length).toEqual(3);
      expect(db2.collections[0].data.length).toEqual(4);
      expect(db2.collections[1].data.length).toEqual(1);
      expect(db2.collections[2].data.length).toEqual(0);
    }).then(done, done.fail);
  });

  it("verify throttled async works as expected", (done) => {
    const mem = new LokiMemoryAdapter({asyncResponses: true, asyncTimeout: 50});
    const adapter = new LokiPartitioningAdapter(mem);
    const throttled = true;
    const db = new Loki("sandbox.db");
    db.initializePersistence({adapter: adapter, throttledSaves: throttled});

    // Add a collection to the database
    const items = db.addCollection("items");
    items.insert({name: "mjolnir", owner: "thor", maker: "dwarves"});
    items.insert({name: "gungnir", owner: "odin", maker: "elves"});
    const tyr = items.insert({name: "tyrfing", owner: "Svafrlami", maker: "dwarves"});
    items.insert({name: "draupnir", owner: "odin", maker: "elves"});

    const another = db.addCollection("another");
    const ai = another.insert({a: 1, b: 2});

    db.saveDatabase().then(() => {
      // should have partitioned the data
      expect(Object.keys(mem.hashStore).length).toEqual(3);
      expect(mem.hashStore.hasOwnProperty("sandbox.db")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.0")).toEqual(true);
      expect(mem.hashStore.hasOwnProperty("sandbox.db.1")).toEqual(true);
      // all partitions should have been saved once each
      expect(mem.hashStore["sandbox.db"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(1);
      expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(1);

      // so let's go ahead and update one of our collections to make it dirty
      ai.b = 3;
      another.update(ai);

      // and save again to ensure lastsave is different on for db container and that one collection
      db.saveDatabase().then(() => {
        // db container always gets saved since we currently have no 'dirty' flag on it to check
        expect(mem.hashStore["sandbox.db"].savecount).toEqual(2);
        // we didn't change this
        expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(1);
        // we updated this collection so it should have been saved again
        expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(2);

        // now update a multi page items collection and verify both pages were saved
        tyr.maker = "elves";
        items.update(tyr);
        db.saveDatabase().then(() => {
          expect(mem.hashStore["sandbox.db"].savecount).toEqual(3);
          expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(2);
          expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(2);

          // ok now lets load from it
          let db2 = new Loki("sandbox.db");
          db2.initializePersistence({adapter: adapter, throttledSaves: throttled});
          db2.loadDatabase().then(() => {
            expect(db2.collections.length).toEqual(2);
            expect(db2.collections[0].data.length).toEqual(4);
            expect(db2.collections[1].data.length).toEqual(1);
            expect(db2.getCollection("items").findOne({name: "tyrfing"}).maker).toEqual("elves");
            expect(db2.getCollection("another").findOne({a: 1}).b).toEqual(3);

            // verify empty collection saves with paging
            db.addCollection("extracoll");
            db.saveDatabase().then(() => {
              expect(mem.hashStore["sandbox.db"].savecount).toEqual(4);
              expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(2);
              expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(2);
              expect(mem.hashStore["sandbox.db.2"].savecount).toEqual(1);

              // now verify loading empty collection works with paging codepath
              db2 = new Loki("sandbox.db");
              db2.initializePersistence({adapter: adapter, throttledSaves: throttled});
              db2.loadDatabase().then(() => {
                expect(db2.collections.length).toEqual(3);
                expect(db2.collections[0].data.length).toEqual(4);
                expect(db2.collections[1].data.length).toEqual(1);
                expect(db2.collections[2].data.length).toEqual(0);

                // since async calls are being used, use jasmine done() to indicate test finished
                done();
              });
            });
          });
        });
      });
    });
  });
});