let MAX_LEGISLATION_TITLE_WORDS_LENGTH;

/*------------------------------
 Helpers
------------------------------*/
// If legisation name has special characters in it
RegExp.escape = function(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
};

String.prototype.matchAll = function(regexp) {
  var matches = [];
  this.replace(regexp, function() {
    var arr = [].slice.call(arguments, 0);
    var extras = arr.splice(-2);
    arr.index = extras[0];
    arr.input = extras[1];
    matches.push(arr);
  });
  return matches.length ? matches : null;
};

/**
 * Find all legislation title indices in case text
 * @param {string} legislationTitle
 * @param {string} caseText
 */
const findLegislationTitleIndicesInCaseText = (legislationTitle, caseText) => {
  const search = new RegExp(RegExp.escape(legislationTitle), "gi");
  return caseText.matchAll(search);
};

/**
 * Check to see if there's a legislation name, followed by a space then round brackets
 * e.g. Care of Children Act 2004 (the Act) or (CCA)
 * @param {string} legislationTitle
 * @param {string} caseText
 */
const findLegislationDefinedTermsInCaseText = (legislationTitle, caseText) => {
  const search = new RegExp(
    // `${RegExp.escape(legislationTitle)} \\((the\\s)?(.*?)\\)`,
    `${RegExp.escape(
      legislationTitle
    )} \\((?:“|'|')?((the\\s)?(.*?))(?:”|'|')?\\)`,
    "gi"
  );
  return caseText.matchAll(search);
};

/**
 * Find all defined term indices in case text
 * @param {string} definedTerm
 * @param {string} caseText
 */
const findDefinedTermIndicesInCaseText = (definedTerm, caseText) => {
  const search = new RegExp(RegExp.escape(definedTerm), "gi");
  return caseText.matchAll(search);
};

/**
 * Find legislation at index
 * @param {number} index
 * @param {Array} legisationReferences
 */
const findLegislationAtIndex = (index, legisationReferences) => {
  return legisationReferences.find(legislationReference =>
    legislationReference.indexesInCase.find(
      indexInCase => indexInCase === index
    )
  );
};

/**
 * Find legislation at index with missing year
 * @param {number} index
 * @param {Array} legisationReferences
 */
const findLegislationMissingYearAtIndex = (index, legisationReferences) => {
  return legisationReferences.find(legislationReference =>
    legislationReference.indexesMissingYear.find(
      indexesMissingYear => indexesMissingYear === index
    )
  );
};

/**
 * Find legislation by id
 * @param {number} id
 * @param {Array} legisationReferences
 */
const findLegislationById = (id, legisationReferences) => {
  return legisationReferences.find(
    legislationReference => legislationReference.id === id
  );
};

/**
 * Find definedTerm at index
 * @param {number} index
 * @param {Array} definedTerms
 */
const findDefinedTermAtIndex = (index, definedTerms) => {
  return definedTerms.find(definedTerm =>
    definedTerm.indexesInCase.find(indexInCase => indexInCase === index)
  );
};

/**
 * Whether a legislation title's words has a word at an index
 * @param {number} index
 * @param {string} word
 * @param {Array} legislationTitleWords
 */
const legislationTitleHasWordAtWordIndex = (
  index,
  word,
  legislationTitleWords
) => {
  if (!legislationTitleWords[index]) {
    return false;
  }
  return word.includes(legislationTitleWords[index].toLowerCase());
};

/**
 * Iterates through the next few words until the "under" "of" or
 * "in" part of a section reference (or equivalent for non standard refs)
 * is encountered.
 * @param {number} offset
 * @param {number} oldi
 * @param {Array} legislation
 * @param {Array} caseWords
 */
const iterateThroughMultipleSections = (
  offset,
  oldi,
  legislation,
  caseWords
) => {
  let j = 2;
  while (j < offset) {
    if (caseWords[oldi + j].match(/^[0-9]+/)) {
      legislation.sections.push(caseWords[oldi + j]);
    }
    j++;
  }
};

// let footnoteLegislationReferences = legislation.map(legislation => {
//   return {
//     indexesInCase: [],
//     indexesMissingYear: [],
//     sections: [],
//     legislationTitleWords: legislation.title.split(/\s/),
//     ...legislation
//   };
// });

// returns
// updatesCurrenthi wiLegislation
const findAndAssociateTextWithLegislation = (
  text,
  legislationReferences,
  currentLegislation
) => {
  // Go through all case text
  // If find section, find its associated legislation
  // If footnote, run nested function, passing in current legislation (maybe using preexisting array
  // Footnote can change its current legislation, but that's just references to the global legislation dictionary

  let definedTermReferences = [];

  // Find legislation title indices and populate definedTerms mentioned
  legislationReferences.forEach(legislation => {
    // Set max legislation title length. This will be used when doing a forward search later in the code
    MAX_LEGISLATION_TITLE_WORDS_LENGTH = Math.max(
      MAX_LEGISLATION_TITLE_WORDS_LENGTH,
      legislation.legislationTitleWords.length
    );

    const foundTitleIndices = findLegislationTitleIndicesInCaseText(
      legislation.title,
      text
    );
    if (foundTitleIndices) {
      foundTitleIndices.forEach(found => {
        legislation.indexesInCase.push(found.index);
      });

      // If this legislation is referenced, treat all following references
      // for a legislation with this title but no year as referring to this
      const foundMissingYear = findLegislationTitleIndicesInCaseText(
        legislation.title.substring(
          0,
          legislation.title.indexOf(legislation.title.match(/\s[0-9]+/))
        ),
        text
      );

      if (foundMissingYear) {
        foundMissingYear.forEach(missing => {
          if (!legislation.indexesInCase.includes(missing.index)) {
            legislation.indexesMissingYear.push(missing.index);
          }
        });
      }
    }

    const foundDefinedTerms = findLegislationDefinedTermsInCaseText(
      legislation.title,
      text
    );

    if (foundDefinedTerms) {
      foundDefinedTerms.forEach(found => {
        definedTermReferences.push({
          legislationId: legislation.id,
          name: found[1].trim().replace(/'|"/g, ""),
          indexesInCase: [],
          sections: []
        });
      });
    }
  });

  // Find definedTerms indices
  definedTermReferences.forEach(term => {
    const foundDefinedTermIndices = findDefinedTermIndicesInCaseText(
      term.name,
      text
    );
    if (foundDefinedTermIndices) {
      foundDefinedTermIndices.forEach(found => {
        term.indexesInCase.push(found.index);
      });
    }
  });

  const caseWords = text.split(/\s/);

  let wordIndices = [];
  let currentIndex = 0;
  for (let i = 0; i < caseWords.length; i++) {
    wordIndices[i] = currentIndex;
    currentIndex += caseWords[i].length + 1;
  }

  for (let i = 0; i < caseWords.length; i++) {
    const word = caseWords[i].toLowerCase();
    const nextWord = caseWords[i + 1];

    let singleSection = false;
    let multiSection = false;
    // i needs to be retained for multiple section checking
    let oldi = i;
    let offset = 2;

    // Find the right legislation at aggregate word index
    const currentLegislationCheck = findLegislationAtIndex(
      wordIndices[i],
      legislationReferences
    );

    if (currentLegislationCheck) {
      currentLegislation = currentLegislationCheck;
    } else {
      const currentDefinedTermCheck = findDefinedTermAtIndex(
        wordIndices[i],
        legislationReferences
      );
      if (currentDefinedTermCheck) {
        currentLegislation = findLegislationById(
          currentDefinedTermCheck.legislationId,
          legislationReferences
        );
      }
    }

    if (
      ((word === "s" ||
        word === "section" ||
        word === "ss" ||
        word === "sections") &&
        (nextWord && nextWord.match(/[0-9]+/))) ||
      // catch cases with no space between s and number e.g s47 instead of s 47
      (nextWord && nextWord.match(/^s[0-9]+/))
    ) {
      singleSection = true;

      // Check if there are multiple sections being referenced, and
      // find the point where the list ends
      while (
        i + offset < caseWords.length &&
        (caseWords[i + offset].match(/[0-9]+/) ||
          caseWords[i + offset] === "and" ||
          caseWords[i + offset] === "to" ||
          caseWords[i + offset] === "-") &&
        !caseWords[i + offset - 1].match(/\.$/) // terminate if word ends on full stop (won't terminate on subsection period)
      ) {
        multiSection = true;
        singleSection = false;
        offset++;
      }
    }

    /*
    Match:
    - s 57
    - section 57
    */
    if (singleSection || multiSection) {
      /*
          Check if it's got "under the" or "of the" following it, then it's not related
          to the current legislation. Instead put it in the following act name / legislation
          - s 57 of the
          - section 57 under the <Legislation Title>
          */
      if (
        (caseWords[i + offset] === "under" ||
          caseWords[i + offset] === "of" ||
          caseWords[i + offset] === "in") &&
        caseWords[i + offset + 1] === "the"
      ) {
        // Check if the index matches that of a missing year index
        const checkForMissingYear = findLegislationMissingYearAtIndex(
          wordIndices[i + offset + 2],
          legislationReferences
        );

        // First test for definedTerms --- changed to search by index to account for multi-word terms
        var foundDefinedTerm = findDefinedTermAtIndex(
          wordIndices[i + offset + 2],
          definedTermReferences
        );

        // Handles edge case where definedTerm is "the <definedTerm>" eg "the act", so first word includes "the"
        if (!foundDefinedTerm) {
          foundDefinedTerm = findDefinedTermAtIndex(
            wordIndices[i + offset + 1],
            definedTermReferences
          );
        }

        if (foundDefinedTerm) {
          const associatedLegislation = findLegislationById(
            foundDefinedTerm.legislationId,
            legislationReferences
          );
          associatedLegislation.sections.push(nextWord);
          // If multiple sections, iterate through each one
          if (multiSection) {
            iterateThroughMultipleSections(
              offset,
              oldi,
              associatedLegislation,
              caseWords
            );
          }
          i += 1;

          currentLegislation = associatedLegislation;

          // Missing year legislation check
        } else if (checkForMissingYear) {
          checkForMissingYear.sections.push(nextWord);
          // If multiple sections, iterate through each one
          if (multiSection) {
            iterateThroughMultipleSections(
              offset,
              oldi,
              checkForMissingYear,
              caseWords
            );
          }

          currentLegislation = checkForMissingYear;
        } else {
          // Find the following legislation
          let subsequentLegislationReference;
          let startWordIndex = i + offset + 2;
          let currentTestWordIndex = 0;
          let maxLegislationTitleLengthFinish = MAX_LEGISLATION_TITLE_WORDS_LENGTH;
          let allLegislationTitlesAndId = [...legislationReferences].map(
            legislation => {
              return {
                id: legislation.id,
                legislationTitleWords: legislation.legislationTitleWords
              };
            }
          );
          while (
            !subsequentLegislationReference &&
            currentTestWordIndex !== maxLegislationTitleLengthFinish &&
            startWordIndex !== caseWords.length
          ) {
            // Progressively filter all legislation titles that have the aggregate of words in its title
            let testWord;

            try {
              testWord = caseWords[startWordIndex].toLowerCase();
            } catch (ex) {
              console.log(ex);
              break;
            }
            allLegislationTitlesAndId = allLegislationTitlesAndId.filter(
              legislation =>
                legislationTitleHasWordAtWordIndex(
                  currentTestWordIndex,
                  testWord,
                  legislation.legislationTitleWords
                )
            );

            if (allLegislationTitlesAndId.length === 1) {
              subsequentLegislationReference = findLegislationById(
                allLegislationTitlesAndId[0].id,
                legislationReferences
              );
            }
            startWordIndex++;
            currentTestWordIndex++;
          }
          // Set i to be the current wordlookahead
          i = startWordIndex;

          if (subsequentLegislationReference) {
            subsequentLegislationReference.sections.push(nextWord);

            // If multiple sections, iterate through each one
            if (multiSection) {
              iterateThroughMultipleSections(
                offset,
                oldi,
                subsequentLegislationReference,
                caseWords
              );
            }
            // Update current legislation (or block current legislation)

            currentLegislation = subsequentLegislationReference;
          }
        }
      } else {
        if (currentLegislation) {
          currentLegislation.sections.push(nextWord);
          // If multiple sections, iterate through each one
          if (multiSection) {
            iterateThroughMultipleSections(
              offset,
              oldi,
              currentLegislation,
              caseWords
            );
          }
        }
      }
    }
  }
};


function flattenDeep(arr1) {
  return arr1.reduce(
    (acc, val) =>
      Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val),
    []
  );
}


// console.log(
//   "footnotes: ",
//   footnotes.length,
//   " | found footnotes: ",
//   foundFootnotes.length
// );
//console.log(footnotes)


const run = async connection => {
	console.log("Parse legislation to cases");

	const [[cases, legislations]] = await connection.query(
		"SELECT * FROM cases.cases WHERE case_footnotes_is_valid != 0; SELECT * FROM cases.legislation;"
  );

  for await (const legalCase of cases) {

    let bodyLegislationReferences = legislations.slice(0).map(legislation => {
      return {
        indexesInCase: [],
        indexesMissingYear: [],
        sections: [],
        legislationTitleWords: legislation.title.split(/\s/),
        ...legislation
      };
    });

    let case_text = legalCase.case_text;
    const footnotes = legalCase.case_footnotes ? legalCase.case_footnotes.split('\n') : [];
    const footnoteContexts = legalCase.case_footnote_contexts ? legalCase.case_footnote_contexts.split('\n') : [];

    // Remove footnotes from case

    footnotes.forEach(f => {
      let matchStr = RegExp.escape(f.trim()).replace(/\s+/g, "\\s+");
      case_text = case_text.replace(new RegExp(matchStr), "");
    });


    findAndAssociateTextWithLegislation(case_text, bodyLegislationReferences);

    const allBodyReferenceIndexes = flattenDeep(
      bodyLegislationReferences
        .filter(b => b.indexesInCase.length > 0 || b.indexesMissingYear.length > 0)
        .map(b => [b.indexesInCase, b.indexesMissingYear])
    );

    footnoteContexts.forEach((f, fi) => {
      const footnoteIndex = case_text.indexOf(f) + f.length;
      // Look through the legislation references and find the closest to get the start
      let foundCurrentLegislationIndex = null;
      // current running total
      let aggregateIndex = 0;
      for (var i = 0; i < allBodyReferenceIndexes.length; i++) {
        aggregateIndex += allBodyReferenceIndexes[i];
        if (footnoteIndex > aggregateIndex) {
          foundCurrentLegislationIndex = allBodyReferenceIndexes[i];
          break;
        }
      }
      const foundLegislation =
        foundCurrentLegislationIndex !== null
          ? findLegislationAtIndex(
              foundCurrentLegislationIndex,
              bodyLegislationReferences
            ) ||
            findLegislationMissingYearAtIndex(
              foundCurrentLegislationIndex,
              bodyLegislationReferences
            )
          : null;

      //console.log("associate", foundLegislation, footnotes[fi]);
      findAndAssociateTextWithLegislation(
        footnotes[fi],
        bodyLegislationReferences,
        foundLegislation
      );
    });

    // https://www.jstips.co/en/javascript/deduplicate-an-array/
    // Instead of dedupe, using section count field, increment for every dupe encountered
    bodyLegislationReferences = bodyLegislationReferences
      .filter(legislationReference => legislationReference.sections.length > 0)

    bodyLegislationReferences.map(legislationReference => {
      legislationReference.sections = legislationReference.sections
        .map(section => {
          var str = section;
          if (str[0].toLowerCase() === "s") {
            str = str.substring(1);
          }
          // if (str.match(/\.|\(|\)/)) {
          //   str = str.substring(0, str.indexOf(str.match(/\.|\(|\)/)));
          // }
          str = str.replace(
            /(~|`|!|@|#|$|%|^|&|\*|{|}|\[|\]|;|:|"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=)/g,
            ""
          );
          return { id: str, count: 1 };
        })
        .filter((el, i, arr) => {
          var firstIndex = arr.findIndex(element => {
            return element.id === el.id;
          });

          var isNotDupe = firstIndex === i;

          if (!isNotDupe) {
            arr[firstIndex].count++;
          }

          return isNotDupe;
        });
    });

    const totalSections = [...bodyLegislationReferences].reduce(
      (accumulator, legislationReference) =>
        accumulator + legislationReference.sections.length,
      0
    );
    //console.log(`> Found ${totalSections} unique legislation sections`);
    let caseLegislationReferences;

    if (totalSections > 0) {
      caseLegislationReferences = bodyLegislationReferences.filter(
        legislationReference => legislationReference.sections.length > 0
      );
    }
    if (caseLegislationReferences) {

      await connection.query(
        "INSERT INTO legislation_to_cases (legislation_id, section, case_id, count) VALUES ?",
        
        caseLegislationReferences.map(caseLegislationReference => {
          return caseLegislationReference.sections.map(section => {
            return [
              caseLegislationReference.id, section.id, legalCase.id, section.count
            ]
          })
          
        })
        
      );

    }
    
  }

}



if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			const connection = await require("../common/setup")(argv.env);
			await run(connection);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
