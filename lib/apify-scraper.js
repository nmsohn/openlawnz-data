// currently running on single case page only

function pageFunction(context) {
	// called on every page the crawler visits, use it to extract data from it
	var $ = context.jQuery;

	function getNeutralCitation(str) {
		// try for neutral citation
		const regCite = /(\[?\d{4}\]?)(\s*?)NZ(D|F|H|C|S|L)(A|C|R)(\s.*?)(\d+)*/;
		if (str.match(regCite)) {
			return str.match(regCite)[0];
		} else {
			return null;
		}
	}

	function getOtherCitationData(str) {
		// try for other types of citation
		const otherCite = /(\[|\()\d{4}(\]|\))\s((\d*\s\S*\s\S*\s\d*)|(\w*\s\d*))/gi;
		if (str.match(otherCite)) {
			return str.match(otherCite);
		} else {
			return null;
		}
	}

	function getAllCitations(str) {
		// try for other types of citation
		const otherCite = /((HC\s)(\w*\s*\w*\s)((CIV|CRI)(\s|-)(\d*(-|\s)\d*(-|\s)\d*)|(\w*\d*\/\d*)))|((\()*(HC|DC|FC|COA|SC|CA)\s*(\d*\/\d*))|(\[|\()\d{4}(\]|\))\s((\d*\s\S*\s\S*\s\d*)|(\w*\s\d*))/gi;
		if (str.match(otherCite)) {
			return str.match(otherCite);
		} else {
			return null;
		}
	}

	function getDate(str) {
		// grab date (dd month yyyy)
		const regExDate = /\(\d*\s\w*\s\d*\)/gi;
		if (str.match(regExDate)) {
			return str.match(regExDate);
		} else {
			return null;
		}
	}

	function formatName(longName) {
		// change this - currently matches either or. should substring at the index of the earliest of these two matches
		const regExName = /^(.*?)\ \[/;
		const regExFileNumber = /(.*)(?= HC| COA| SC| FC| DC| CA)/;
		// regexName gets everything up to square bracket
		// if that matches, return that
		if (longName.match(regExName)) {
			return longName.match(regExName)[1];
		}
		// if not, regExFileNumber matches everything up to the first " HC", coa, sc, fc or dc, those usually signifying the start of case reference
		else {
			if (longName.match(regExFileNumber)) {
				return longName.match(regExFileNumber)[1];
			} else {
				return "Unknown case";
			}
		}
	}

	var longTitle = $("body h2:eq(0)").text();
	var shortTitle = formatName($("body h2:eq(0)").text());
	// var neutralCitation = getNeutralCitation($("body h2:eq(0)").text());
	var citations = getAllCitations($("body h2:eq(0)").text());
	var pdfURL = $("a:contains('PDF')").attr("href")
		? $("a:contains('PDF')").attr("href")
		: null;
	var rtfURL = $("a:contains('RTF')").attr("href")
		? $("a:contains('RTF')").attr("href")
		: null;
	var caseDate = getDate($("body h2:eq(0)").text());
	var caseDate2 = caseDate[0].substring(1, caseDate[0].length - 1);

	// TODO: make this mirror the MOJ style
	var result = {
		longTitle: longTitle,
		shortTitle: shortTitle,
		pdfURL: pdfURL,
		rtfURL: rtfURL,
		citations: citations,
		date: caseDate2
	};

	return result;
}
