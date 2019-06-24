/**
 * Parse Invalid Characters
 * @param MysqlConnection connection
 */

const characterReplaceMap = [
	["‖", ""],
	["…", ""],
	["‘", "'"],
	["’", "'"],
	["“", '"'],
	["”", '"'],
	["", ""],
	["﻿", ""]
];

const replaceText = text => {
	let hasInvalidCharacter = false;

	if (text !== null) {
		characterReplaceMap.forEach(mapItem => {
			if (text.indexOf(mapItem[0]) !== -1) {
				hasInvalidCharacter = true;
				text = text.replace(new RegExp(mapItem[0], "g"), mapItem[1]);
			}
		});
	}
	return [text, hasInvalidCharacter];
};

const run = async (connection, logDir) => {
	console.log("\n-----------------------------------");
	console.log("Parse invalid characters");
	console.log("-----------------------------------\n");

	let invalidCaseTextCount = 0;
	let invalidFootnotesCount = 0;
	let invalidFootnoteContextsCount = 0;

	console.log("Loading all cases");

	const [results] = await connection.query("SELECT * FROM cases");

	try {
		await connection.beginTransaction();

		for (let x = 0; x < results.length; x++) {
			const row = results[x];

			console.log(`Processing ${x + 1}/${results.length}`);

			const [case_text, caseTextHasInvalidCharacter] = replaceText(
				row.case_text
			);
			const [case_footnotes, caseFootnotesHasInvalidCharacter] = replaceText(
				row.case_footnotes
			);
			const [
				case_footnote_contexts,
				caseFootnoteContextsHasInvalidCharacter
			] = replaceText(row.case_footnote_contexts);

			let updateObj = {};
			if (caseTextHasInvalidCharacter) {
				updateObj["case_text"] = case_text;
				invalidCaseTextCount++;
			}

			if (caseFootnotesHasInvalidCharacter) {
				updateObj["case_footnotes"] = case_footnotes;
				invalidFootnotesCount++;
			}

			if (caseFootnoteContextsHasInvalidCharacter) {
				updateObj["case_footnote_contexts"] = case_footnote_contexts;
				invalidFootnoteContextsCount++;
			}

			if (Object.keys(updateObj).length > 0) {
				await connection.query("UPDATE cases SET ? WHERE id = ?", [
					updateObj,
					row.id
				]);
			}
		}

		console.log(`Invalid case text: ${invalidCaseTextCount}`);
		console.log(`Invalid footnotes: ${invalidFootnotesCount}`);
		console.log(`Invalid footnote contexts: ${invalidFootnoteContextsCount}`);

		console.log(
			`Updating ${invalidCaseTextCount +
				invalidFootnotesCount +
				invalidFootnoteContextsCount} texts that have invalid characters`
		);

		await connection.commit();
	} catch (ex) {
		await connection.rollback();
		console.log(ex);
	}

	console.log("Done");
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			const { connection, logDir } = await require("../common/setup")(argv.env);
			await run(connection, logDir);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
	module.exports.characterReplaceMap = characterReplaceMap;
	module.exports.replaceText = replaceText;
}
