const argv = require("yargs").argv;
const fs = require("fs");
const { execSync } = require("child_process");
const adapterConfig = require("../adapterconfig.json");

const run = pdfFolder => {
	if (!pdfFolder) {
		throw new Error("Missing path to folder");
	}

	if (!fs.existsSync(adapterConfig.autobatch_path)) {
		throw new Error(
			"Cannot find AutoBatch path. Check your adapterconfig.json file."
		);
	}

	// AutoBatch takes a folder

	try {
		execSync(`${adapterConfig.autobatch_path} ${pdfFolder}`);
	} catch (ex) {
		throw ex;
	}
};

if (require.main === module) {
	run(argv.folder);
} else {
	module.exports = run;
}
