/**
 * Case Citations
 * @param MysqlConnection connection
 * @param {function} cb
 */
// search through all cases and all citations
// find all double citations in the full text of each case eg R v Smith [2012] NZHC 1234, [2012] 2 NZLR 123.
// check to see if first part of match already has id in database
// if so, add second part of match to case_citation database with same id
const regDoubleCites = /(\[|\()\d{4}(\]|\))[\s\S](\d{0,3}[\s\S])\w{1,5}[\s\S]\d{1,5}(([\s\S]\(\w*\))?)(;|,)\s(\[|\()\d{4}(\]|\))[\s\S](\d{0,3}[\s\S])\w{1,5}[\s\S]\d{1,5}(([\s\S]\(\w*\))?)/g;
const log4js = require('log4js');
const logger = log4js.getLogger();
const async = require("async");

const run = (connection, cb) => {
	logger.info("Parse case citations - may take some time for initial retieval");
	const commaOrSemi = /,|;/g; // for splitting double citations - delimted by comma or semicolon

	// this wont scale but rewrite in sql later cos we cant be fucked right now
	connection.query(
		"select * from cases ; select * from case_citations",
		function(err, results, fields) {
			if (err) {
				cb(err);
				return;
			}
			logger.info("Cases & citations retrieved");
			var allCases = results[0];
			var allCitations = results[1];

			var insertQueries = [];

			function findCaseByCitation(citation) {
				return allCitations.find(function(row) {
					return row.citation === citation;
				});
			}

			if (allCases.length > 0) {
				async.eachLimit(allCases,1,(row, callback) => {
					// if no text, quit
					if (!row.case_text) {
						logger.debug("No case_text found for case_id: " + row.id);
						callback();
						return;
					}
					// regex match for all double citations inside case text
					var citationsMatch = row.case_text.match(regDoubleCites);
					// if match:
					if (citationsMatch) {
						// split into first and second citation
						var separatedCitations = citationsMatch[0].split(
							commaOrSemi
						);
						// separatedCitations[0] has first of double citation
						// separatedCitations[1] has second of double citation
						// we want to search for first citation to see if it is in the db already
						var citation = separatedCitations[0];
						var foundCase = findCaseByCitation(citation);
						if (foundCase) {
							// if there's a match - ie if the first citation is in the db, then we know we can add another citation that refers to the same case
							connection.query(
								"insert into case_citations (case_id, citation) values ('" +
									foundCase.case_id +
									"', '" +
									separatedCitations[1].trim() +
									"')",
									(err, results, fields) => {
										if (err) {
											logger.error(err)
											callback();
											return;
										}
										logger.debug("Double citation insert complete, case id: " + row.id);
										callback();
									});
						}
						else {
							logger.debug("No match for this citation found in table: " + citation);
							callback();
						}
					}
					else {
						logger.debug("No double citations found, case id: " + row.id);
						callback();
					}
				},
				err => {
					if (err) {
						logger.error(err);
					}
					logger.info("Insertions finished");
					cb();
				});
			}
			else {
				logger.error("No cases found? Check cases table for data");
				cb();
			}
		}
	);
};

if (require.main === module) {
	const connection = require("../lib/db");
	connection.connect(err => {
		if (err) {
			console.log("Error connecting");
			return;
		}
		run(connection, err => {
			connection.end();
			if (err) {
				console.log(err);
				return;
			}
			console.log("Done");
		});
	});
} else {
	module.exports = run;
	module.exports.regDoubleCites = regDoubleCites;
}
