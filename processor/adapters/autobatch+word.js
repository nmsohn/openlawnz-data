const argv = require("yargs").argv;
const fs = require("fs");
const { execSync } = require("child_process");
const adapterConfig = require("../adapterconfig.json");

const run = async pdfFolder => {
	if (!pdfFolder) {
		throw new Error("Missing path to folder");
	}

	if (!fs.existsSync(adapterConfig.autobatch_path)) {
		throw new Error(
			"Cannot find AutoBatch path. Check your adapterconfig.json file."
		);
	}

	// AutoBatch takes a folder
	console.log("Converting to Word");
	try {
		execSync(`"${adapterConfig.autobatch_path}" "${pdfFolder}"`);
	} catch (ex) {
		// Need to wrap in trycatch for handling the return of execSync
	}

	const files = fs.readdirSync(pdfFolder).filter(f => f.endsWith(".docx"));

	console.log("Extracting data to text files");
	files.forEach(f => {
		try {
			console.log(
				`"${adapterConfig.word_path}" /mExtractFootnotes /q ${pdfFolder}\\${f}`
			);
			execSync(
				`"${adapterConfig.word_path}" /mExtractFootnotes /q ${pdfFolder}\\${f}`
			);
		} catch (ex) {}
	});
	// Make sure you back up the macro before trying this
	// const execAsync = require("util").promisify(require("child_process").exec);
	// await Promise.all(
	// 	files.map(f => {
	// 		console.log(`"${adapterConfig.word_path}" /mExtractFootnotes /q /w ${pdfFolder}\\${f}`)
	// 		return execAsync(`"${adapterConfig.word_path}" /mExtractFootnotes /q /w ${pdfFolder}\\${f}`);
	// 	})
	// );
};

if (require.main === module) {
	run(argv.folder);
} else {
	module.exports = run;
}
