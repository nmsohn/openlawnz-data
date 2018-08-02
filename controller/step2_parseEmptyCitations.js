/**
 * Fill empty citations
 * @param MysqlConnection connection
 * @param {function} cb
 */
// search for rows in the case_citations table where citation is blank
// get the full case data including case text
// trim the case text to first 200 characters and look for a neutral citation there
// if found, add that citation to case_citations table

const regNeutralCite = /((?:\[\d{4}\]\s*)(?:(NZDC|NZFC|NZHC|NZCA|NZSC|NZEnvC|NZEmpC|NZACA|NZBSA|NZCC|NZCOP|NZCAA|NZDRT|NZHRRT|NZIACDT|NZIPT|NZIEAA|NZLVT|NZLCDT|NZLAT|NZSHD|NZLLA|NZMVDT|NZPSPLA|NZREADT|NZSSAA|NZSAAA|NZTRA))(?:\s*(\w{1,6})))/g;
const log4js = require('log4js');
const logger = log4js.getLogger();
const async = require("async");

const run = (connection, cb) => {
	logger.info("Parse empty citations");
	connection.query(
		"select * from cases INNER JOIN case_citations ON case_citations.case_id = cases.id WHERE case_citations.citation = ''",
		function(err, results, fields) {
			if (err) {
				cb(err);
				return;
			}

			if (results.length > 0) {
				async.eachLimit(results,1,(row, callback) => {
					if (!row.case_text) {
						//return console.log("No text to parse for missing citation")
						logger.debug("No text to parse for missing citation, case_id: " + row.case_id);
						callback();
						return;
					}

					const case_text = JSON.stringify(row.case_text).substr(0, 550);
					// regex for neutral citation
					
					let citation = case_text.match(regNeutralCite);
					// for now, limit to the first citation found (in case double citation appears in header - deal with double citations in header later)
					citation = citation[0];
					// add to array of update statements
					if (citation) {
						connection.query(
							"update case_citations set citation = '" +
								citation +
								"' where case_id = '" +
								row.id +
								"'",
								(err,
								results,
								fields) => {
									if (err) {
										logger.error(err)
										callback();
										return;
									}
									logger.debug("Update citation complete, case id: " + row.case_id);
									callback();
								});
					}
					else {
						logger.debug("No citations found, case id: " + row.case_id);
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
				logger.info("No empty citations found")
				cb();
			}
		});
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
	module.exports.regNeutralCite = regNeutralCite;
}
