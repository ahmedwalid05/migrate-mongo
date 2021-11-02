const _ = require("lodash");
const pEachSeries = require("p-each-series");

const status = require("./status");
const config = require("../env/config");
const runner = require("../env/runner");
const migrationsDir = require("../env/migrationsDir");

module.exports = async (db, client) => {
  const statusItems = await status(db);
  const pendingItems = _.filter(statusItems, { appliedAt: "PENDING" });
  const migrated = [];

  const migrateItem = async (item) => {
    try {
      const migration = await migrationsDir.loadMigration(item.fileName);
      await runner.runWithCustomRunner(migration.up, db, client);
    } catch (err) {
      const error = new Error(
        `Could not migrate up ${item.fileName}: ${err.message}`
      );
      error.stack = err.stack;
      error.migrated = migrated;
      throw error;
    }

    const { changelogCollectionName, useFileHash } = await config.read();
    const changelogCollection = db.collection(changelogCollectionName);

    const { fileName, fileHash } = item;
    const appliedAt = new Date();

    try {
      await changelogCollection.insertOne(
        useFileHash === true
          ? { fileName, fileHash, appliedAt }
          : { fileName, appliedAt }
      );
    } catch (err) {
      throw new Error(`Could not update changelog: ${err.message}`);
    }
    migrated.push(item.fileName);
  };

  await pEachSeries(pendingItems, migrateItem);
  return migrated;
};
