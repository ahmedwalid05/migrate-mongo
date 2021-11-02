const { promisify } = require("util");
const fnArgs = require("fn-args");

const migrationsDir = require("./migrationsDir");
const config = require("./config");
const hasCallback = require("../utils/has-callback");

module.exports = {
  async runWithCustomRunner(functionToRun, db, client) {
    const { customRunnerPath } = await config.read();

    const functionWrapper = hasCallback(functionToRun)
      ? promisify(functionToRun)
      : functionToRun;

    if (customRunnerPath) {
      const customRunner = await migrationsDir.loadCustomRunner();
      await customRunner.run(functionWrapper, db, client);
    } else if (hasCallback(functionToRun) && fnArgs(functionToRun).length < 3) {
      await functionWrapper(db);
    } else {
      await functionWrapper(db, client);
    }
  },
};
