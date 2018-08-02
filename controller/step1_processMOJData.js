/**
 * @file Entry point to processing Ministry of Justice (MOJ) case data.
 * This file performs a search on the MOJ website to retrieve links to case pdf's.
 * It will then break the result into batches of (e.g.) 10, and spawn child processors to process them
 */

/**
 * IMPORTANT NOTE: Do not run this multiple times as it may affect the MOJ servers
 */

const { exec } = require("child_process");
const download = require("download");
const fs = require("fs");
const async = require("async");
const path = require("path");
const lib = require("../lib/functions.js");
const log4js = require('log4js');
const logger = log4js.getLogger();


// TODO: Fix uri encode - need to add !, (, ), ', _, * and . to encodeURIcomponent
const encodeURIfix = str => {
	return encodeURIComponent(str)
		.replace(/!/g, "%21")
		.replace(/\(/g, "%28")
		.replace(/\)/g, "%29")
		.replace(/'/g, "%27")
		.replace(/_/g, "%5F")
		.replace(/\*/g, "%2A")
		.replace(/\./g, "%2E");
};

// Currently limited to 10 results for testing
const casesPerInstance = 10;
const maxRows = 30000;
const fromDate = "2012-1-31";
const toDate = new Date();;
const jsonURL = [
	"https://forms.justice.govt.nz/solr/jdo/select",
	"?q=*",
	"&facet=true",
	"&facet.field=Location",
	"&facet.field=Jurisdiction",
	"&facet.limit=-1",
	"&facet.mincount=1",
	"&rows=" + maxRows,
	"&json.nl=map",
	`&fq=JudgmentDate%3A%5B${fromDate}T00%3A00%3A00Z%20TO%20${toDate.getFullYear()}-${toDate.getMonth()}-${toDate.getDate()}`,
	"T23%3A59%3A59Z%5D",
	"&sort=JudgmentDate%20desc",
	"&fl=CaseName%2C%20JudgmentDate%2C%20DocumentName%2C%20id%2C%20score",
	"&wt=json"
].join("");

/**
 * Spawns a child process to process cases array. Delays by 10 seconds before returning to ease pressure on services.
 * @param {Array} cases
 * @param {function} cb
 */
const spawnCaseProcessor = (cases, cb) => {
	logger.info("Processing " + cases.length + " cases");

	const encodedCommand = encodeURIfix(JSON.stringify(cases));

	var cmd = `node index.js --cases=${encodedCommand}`;
	

	const e = exec(
		cmd,
		{ cwd: "../pdfToDBProcessor/" },
		(err, stdout, stderr) => {
			if (err) {
				cb(err);
				return;
			}
			logger.info("Delay 10 seconds before next batch");
			setTimeout(() => {
				cb();
			}, 10000);
		}
	);

	e.stdout.on("data", data => {
		console.log(data);
	});
};

const run = (connection, cb) => {
	logger.info("Process MOJ Data");
	download(jsonURL).then(data => {
		data = JSON.parse(data.toString()).response.docs;
		const newCases = [];
		
		connection.query("SELECT bucket_key FROM cases INNER JOIN case_pdf ON cases.pdf_id = case_pdf.pdf_id WHERE is_valid = 1", function(
			err,
			result
		) {
			if (err) {
				cb(err);
				return;
			}

			// Only add invalid cases/cases that havent been processed to list of cases to process, 
			// should significantly speed up resuming after incomplete runs
			data.forEach(caseJSON => {

				let bucketKey = lib.slashToDash(caseJSON.id);

				if (!result.some(row => {
					return row.bucket_key == bucketKey;
				})){
					newCases.push(caseJSON);
				}
				
			});
			let caseArrays = [];
			while (newCases.length > 0) {
				caseArrays.push(
					newCases.splice(0, Math.min(newCases.length, casesPerInstance))
				);
			}

			async.series(
				caseArrays.map(caseArray => {
					return spawnCaseProcessor.bind(null, caseArray);
				}),
				(err, results) => {
					if (err) {
						cb(err);
						return;
					}
					cb();
				}
			);
		});
	});
};

if (require.main === module) {
	run(err => {
		connection.end();
		if (err) {
			logger.error(err);
			return;
		}
		logger.info("Step 1 Done");
	});
} else {
	module.exports = run;
}
