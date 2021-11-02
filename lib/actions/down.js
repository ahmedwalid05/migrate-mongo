const _ = require("lodash");

const status = require("./status");
const config = require("../env/config");
const runner = require("../env/runner");

const migrationsDir = require("../env/migrationsDir");

module.exports = async (db, client) => {
  const downgraded = [];
  const statusItems = await status(db);
  const appliedItems = statusItems.filter(
    (item) => item.appliedAt !== "PENDING"
  );
  const lastAppliedItem = _.last(appliedItems);

  if (lastAppliedItem) {
    try {
      const migration = await migrationsDir.loadMigration(
        lastAppliedItem.fileName
      );

      runner.runWithCustomRunner(migration.down, db, client);
    } catch (err) {
      throw new Error(
        `Could not migrate down ${lastAppliedItem.fileName}: ${err.message}`
      );
    }
    const { changelogCollectionName } = await config.read();
    const changelogCollection = db.collection(changelogCollectionName);
    try {
      await changelogCollection.deleteOne({
        fileName: lastAppliedItem.fileName,
      });
      downgraded.push(lastAppliedItem.fileName);
    } catch (err) {
      throw new Error(`Could not update changelog: ${err.message}`);
    }
  }

  return downgraded;
};
