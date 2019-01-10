const fs = require("fs");

const common = require("../../../common/functions");

const run = async (filePath, pathArr) => {
	try {
		const jsonData = fs.readFileSync(filePath);

		const json = JSON.parse(jsonData);
		if (!pathArr) {
			return json;
		} else {
			return common.getNestedObject(json, pathArr);
		}
	} catch (ex) {
		throw ex;
	}
};

if (require.main === module) {
	try {
		run();
	} catch (ex) {
		console.log(ex);
	}
} else {
	module.exports = run;
}
