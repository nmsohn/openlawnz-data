/**
 * This module populates the 'cited_cases' table, by selecting cases with case texts, and matching citations of other cases
 * within the case text. A relationship is established between the "case_origin" and "case_cited", which is stored
 * in the 'cited_cases' table.
 * 
 * last updated 7/21/2018 by Matt Frost :
 * changed the algorithm to pick out all citations from the case_text first using a regex match (much faster!).
 * then, counts the number of each case_id sited, and stores this in the count column along with the 
 * case relationship.
 * Keyed table means that a replace instead of an insert is needed.
 * 
 * @param MysqlConnection connection
 * @param {function} cb
 * 
 *
 */

const citation_reg = /((?:\[\d{4}\]\s*)(?:([a-zA-Z]{1,7}))(?:\s*(\w{1,6})))[,;.\s]/g;
//const old_citation_reg = /\[[0-9]{4}\]\s[a-zA-Z]{1,7}\s*(\w{0,6})[,;.\s]/g
const moment = require('moment')
const log4js = require('log4js');
const logger = log4js.getLogger();
const async = require("async");

const run = (connection, cb) => {
	var start = moment().unix()
	logger.info("Parse case to case");
	logger.debug("started at " + start)
	connection.query(
		"select id, case_text from cases; select citation, case_id from case_citations",
		function (err, results, fields) {
			if (err) {
				cb(err);
				return;
			}
			logger.debug("fetched tables in: " + (moment().unix() - start) + " secs");

			var allCases = results[0];
			var allCitations = results[1];

			var insertQueries = [];

			// initialize map of citation strings
			var case_citations = {};
			logger.info("started matching")
			/** 
			 * Loop over cases, pull out all citations
			 * 
			 */
			var totalcites = 0;
			allCases.forEach(function (caseRow) {
				// go through each case, check for blank text
				if (!caseRow.case_text) {
					logger.debug("No text to parse for missing citation, case_id: " + row.case_id);
					return;
				}
				// regex searches for the format of a citation, grabs all valid sitations and maps them under the id of the case
				var matches = caseRow.case_text.match(citation_reg);

				// create map entry with key as the ID, all citations as body
				if (matches) {
					totalcites += matches.length
					case_citations[caseRow.id] = matches

				}
				logger.debug("Row parsed");
			});
			logger.debug(`found a total of ${totalcites} citations within texts`)
			logger.debug("found regex in: " + (moment().unix() - start) + " secs")

			// assuming no blank text, inside each case look at all citation records in the db
			// see if any citations in the db are present in the case text
			logger.info("Generating citation inserts, may take some time")
			for (var key in case_citations) {
				var count = 0;

				mapped_count = {}
				// loop over all citations within keyed case text
				case_citations[key].forEach((caseCitation) => {
					// loop over all citations strings from database
					allCitations.forEach(function (citationRow) {
						// match against caseRow.case_text, and only match if the ids are not identical (dont need to add a case's reference to itself)
						if (citationRow.citation) {

							caseCitation = caseCitation.slice(0, -1)
							caseCitation += ";"
							//remove white space(could be inconsistent)
							caseCitation = caseCitation.replace(/\s/g, '')

							// if the citation is a substring of multiple other cases, we need to account for this by "ending"
							// the citation with a semicolon ;
							var w = citationRow.citation.concat(";");
							w = w.replace(/\s/g, '')

							// map the count udner its case_id - can add to this if it encounters this ID again
							if (caseCitation.indexOf(w) !== -1 && citationRow.case_id != key) {
								if (mapped_count[citationRow.case_id]) {
									mapped_count[citationRow.case_id] += 1;
								} else {
									mapped_count[citationRow.case_id] = 1;
								}
								count++;
								/** 
								 * here, we need to check for duplicates already in the case_to_case table?
								 * the script will likely be run regularly across the whole db (to account for new citations being added)
								 * this will result in duplicate entries
								 * UPDATE: put a key on (case_id_1, case_id_2)
								*/
							}
						}
					});

				});
				// replace current item in DB
				for (var count_key in mapped_count) {
					insertQueries.push(
						`replace into cases_cited (case_origin, case_cited, citation_count) values ('${key}', '${count_key}', ' ${mapped_count[count_key]}')`
					);
				}
			}

			logger.debug("Created insert queries in: " + (moment().unix() - start) + " secs")
			logger.debug("Insert", insertQueries.length);

			if (insertQueries.length > 0) {
				async.eachLimit(insertQueries, 1, (insertQuery,callback)=> {
					connection.query(insertQuery, (err,results,fields) => {
						if (err) {
							logger.error(err)
							callback();
							return;
						}
						logger.debug("Insertion complete");
						callback();
					});
				},
				err=> {
					if (err) {
						logger.error(err);
					}
					logger.info("Insertions finished");
					cb();
				});


			} else {
				logger.info("No insertions created")
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
}
