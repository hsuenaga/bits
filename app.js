/**
Copyright 2017 LGS Innovations

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
**/
(() => {
  'use strict';

  const parseArgs = require('minimist');
  const path = require('path');

  // Parsing args
  const args = parseArgs(process.argv, {
    string: ['rootDataDir', 'proxy'],
    default: {rootDataDir: path.join(__dirname, '/data')},
    alias: {rootDataDir: ['d'], p: 'proxy'},
  });

  // Set initial Globals
  if (!global.hasOwnProperty('paths')) {
    global.paths = {};
  }
  global.paths.data = args.rootDataDir;
  global.use_reverse_proxy = args.proxy;

  const os = require('os');
  const cluster = require('cluster');
  const Base = require('./lib/bits-base');
  const LoggerFactory = require('./lib/logging/logger-factory');

  // Create instance managers
  const logger = LoggerFactory.getLogger();

  global.numberOfCpu = os.cpus();

  const base = new Base();

  // Master specific
  if (cluster.isMaster) {
    // Set up the normal bits stack
    process.on('uncaughtException', (err) => logger.error('Uncaught Exception: %s', err.message, {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }));

    process.on('unhandledRejection', (err) => logger.error('Unhandled Rejection: %s', err.message, err));

    return Promise.resolve()
    .then(() => base.initialize())
    .then(() => {
      logger.info('Application started');
    })
    .then(() => base.load())
    .catch((err) => {
      logger.error('Error starting application: %s', err.toString(), {error: err});
      logger.error(err.stack);
      process.exit(1);
    });
  } else if (cluster.isWorker) {
    const encodedModuleInfo = process.env.mod;
    const moduleInfo = JSON.parse(encodedModuleInfo);
    const moduleName = moduleInfo.name;

    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught exception in module ${moduleName}: ${err.message}\n ${err.stack}`);
    });

    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled rejection in module ${moduleName}: ${err.message}\n ${err.stack}`);
    });

    base.dispatchModule(moduleInfo);
  }
})();
