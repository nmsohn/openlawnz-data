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
const logging = require("./loggingFunctions");
const argv = require("yargs").argv;

// Set up logging array, which will be saved if exportPath tag is specified,
// Otherwise just printed to console as a summary
logArray = [];
logArray.exportPath = argv.exportPath;

async.series(
	[
		
		//step1.bind(this,logArray),
		/**
		 * Connect to DB
		 */
		cb => {
			connection.connect(err => {
				if (err) {
					cb(err);
					return;
				}
				cb();
			});
		},
		updateCaseText.bind(this, connection),
		//step2.bind(this, connection),
		//step3.bind(this, connection),
		//step4.bind(this, connection),
		step5.bind(this, connection),
		step6.bind(this, connection)
		//step7
	],
	err => {
		connection.end();
		if (err) {
			console.log(err);
		} else {
			console.log("Success");
		}
	}
);
