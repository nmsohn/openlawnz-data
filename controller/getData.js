/**
 * @file This file performs a search on a website to retrieve links to case pdf's.
 * It will then break the result into batches of (e.g.) 10, and spawn child processors to process them
 */

/**
 * IMPORTANT NOTE: Do not run this multiple times as it may affect the server you are downloading from
 */

const { exec } = require("child_process");
const common = require("../common/functions.js");

/**
 * Spawns a child process to process cases array. Delays by 10 seconds before returning to ease pressure on services.
 * @param {Array} cases
 */

const run = async (env, datasource, datalocation) => {
	if (!datasource) {
		throw new Error("Missing datasource");
	}
	if (!env) {
		throw new Error("Missing env");
	}

	let legalCases;

	if (datasource === "moj") {
		legalCases = await require("./adapters/moj")();
	} else if (datasource === "url") {
		if (!datalocation) {
			throw new Error("Missing datalocation");
		}
		legalCases = await require("./adapters/generic/url")(datalocation);
	} else if (datasource === "s3") {
		if (!datalocation) {
			throw new Error("Missing datalocation");
		}
		legalCases = await require("./adapters/generic/s3")(datalocation);
	} else if (datasource === "localfile") {
		if (!datalocation) {
			throw new Error("Missing datalocation");
		}
		legalCases = await require("./adapters/generic/localfile")(datalocation);
	} else {
		try {
			legalCases = JSON.stringify(JSON.parse(datasource));
		} catch (ex) {
			throw ex;
		}
	}

	let caseArrays = [];
	while (legalCases.length > 0) {
		caseArrays.push(legalCases.splice(0, Math.min(legalCases.length, 10)));
	}

	for (let legalCases of caseArrays) {
		await (() => {
			return new Promise((resolve, reject) => {
				const cmd = `node ../processor/index.js --env=${env} --cases=${common.encodeURIfix(
					JSON.stringify(legalCases)
				)}`;

				const e = exec(cmd, {}, err => {
					if (err) {
						reject(err);
						return;
					}
				});

				e.stderr.on("data", data => {
					reject(data);
				});

				e.stdout.on("data", data => {
					if (data.trim() === "[PROCESSOR_RESULT]") {
						setTimeout(resolve, 10000);
					} else {
						console.log(data);
					}
				});
			});
		})();
	}
};

if (require.main === module) {
	const argv = require("yargs").argv;
	try {
		run(argv.env, argv.datasource, argv.datalocation).finally(process.exit);
	} catch (ex) {
		console.log(ex);
	}
} else {
	module.exports = run;
}
