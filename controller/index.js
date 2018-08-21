/**
 * @file Runs all the steps for processing law data
 */

const async = require("async");

const connection = require("../lib/db.js");

const updateCaseText = require("./update_casetext");
const step1 = require("./step1_processMOJData");
const step2 = require("./step2_parseEmptyCitations");
const step3 = require("./step3_parseCaseCitations");
const step4 = require("./step4_parseCaseToCase");
const step5 = require("./step5_parseLegislation");
const step6 = require("./step6_parseLegislationToCases");
const step7 = require("./step7_updateSearchIndex");
const log4js = require('log4js');
const logger = log4js.getLogger();

let heartBeatOn = true;

logger.level = process.env.LOG_LEVEL;
log4js.configure({
	appenders: {
	  out: { type: 'stdout' },
	  app: { type: 'file', filename: `logs/${Date.now()}.log` },
	  server: { type: 'multiprocess', mode: 'master', appender: 'app', loggerHost: 'localhost' }
	},
	categories: {
	  default: { appenders: [ 'out', 'app' ], level: 'all' }
	}
  });

/**
 * Keeps the sql connection alive by running a heartbeat select statement every 10s, shuts down at end of procees
 * @param {connection} connect The mysql connection to keep alive
 * @param {callback} cb The callback function to trigger an error on if the heartbeat is unsuccessful
 */
const sqlHeartBeat = (connect,cb) => {
	if (heartBeatOn) {
		connect.query("SELECT 1", (err, results, fields) => {
			logger.debug("SQL heartbeat");
			if (err) {
				loggger.fatal("Error with sql heartbeat");
				cb(err);
			}
			else {
				setTimeout(() => {
					sqlHeartBeat(connect,cb);
				}, 10000)
			}
		})
	}
	else {
		logger.info("SQL heartbeat ended");
	}
}



async.series(
	[
		
		
		/**
		 * Connect to DB
		 */
		cb => {
			connection.connect(err => {
				if (err) {
					cb(err);
					return;
				}
				sqlHeartBeat(connection,cb);
				cb();
			});
		},
		//updateCaseText.bind(this, connection),
		step1.bind(this, connection),
		step2.bind(this, connection),
		step3.bind(this, connection),
		step4.bind(this, connection),
		step5.bind(this, connection),
		step6.bind(this, connection)
		//step7
	],
	err => {
		heartBeatOn = false;
		connection.end();
		if (err) {
			logger.fatal(err);
		} else {
			logger.info("Success");
		}
		log4js.shutdown(err => {
			if (err) {
				console.log(err);
				return;
			}
			console.log("log4js Shutdown");
		});
	}
);
