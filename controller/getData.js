/**
 * @file This file performs a search on a website to retrieve links to case pdf's.
 * It will then break the result into batches of (e.g.) 10, and spawn child processors to process them
 */

/**
 * IMPORTANT NOTE: Do not run this multiple times as it may affect the server you are downloading from
 */

const processor = require("../processor");

/**
 * Spawns a child process to process cases array. Delays by 10 seconds before returning to ease pressure on services.
 * @param {Array} cases
 */

const run = async (env, datasource, datalocation, pdfconverteradapter, trylocaldatalocation) => {
	if (!datasource) {
		throw new Error("Missing datasource");
	}
	if (!env) {
		throw new Error("Missing env");
	}

	let legalCases;

	if (datasource === "moj") {
		legalCases = await require("./getData/moj")();
	} else if (datasource === "url") {
		if (!datalocation) {
			throw new Error("Missing datalocation");
		}
		legalCases = await require("./getData/generic/url")(datalocation);
	} else if (datasource === "s3") {
		if (!datalocation) {
			throw new Error("Missing datalocation");
		}
		legalCases = await require("./getData/generic/s3")(datalocation);
	} else if (datasource === "localfile") {
		if (!datalocation) {
			throw new Error("Missing datalocation");
		}
		legalCases = await require("./getData/generic/localfile")(datalocation);
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
				processor(env, legalCases, pdfconverteradapter, trylocaldatalocation)
					.then(newCases => {
						if(newCases.length > 0) {
							console.log('newcases', newCases)
							setTimeout(resolve, 10000);
						} else {
							console.log("No new cases in this batch, processing next.")
							resolve()
						}
					})
					.catch(reject);
			});
		})();
	}
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			await run(argv.env, argv.datasource, argv.datalocation, argv.pdfconverteradapter, argv.trylocaldatalocation);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
