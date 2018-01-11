
"use strict";

// VARIABLES, DEPENDENCIES ETC
// ---------------------------
const   pdftohtml = require('pdftohtmljs'),
AWS = require('aws-sdk'),
async = require("async"),
mysql = require('mysql'),
limits = require('limits.js'),
download = require('download'),
fs = require('fs'),
_ = require("underscore"),
lib = require('./lib/functions.js');


// get the JSON file
var loadJSON = new Promise(
    function(fulfill, reject) {
      fulfill(JSON.parse(fs.readFileSync('jsons/data-limited.json', 'utf8')));
      reject(Error("Error loading JSON"));
    });

loadJSON.then(function(fulljson) {
    console.log("JSON Loaded. Processing Data.")
    // map json file
    _.map(fulljson, function(cases) {
        // here, var fulljson is whole file so cases =  [{cases[0], cases[1], etc}]
        // map again to iterate through each case
        _.map(cases, function(singleCase) {
            // add fields we need to object
            singleCase.pdf_fetch_date = new Date();
            singleCase.case_name = lib.getName(singleCase.CaseName);
            singleCase.bucket_ref = lib.slashToDash(singleCase.id);
            singleCase.mojPDFURL = lib.getMOJURL(singleCase.id);
            singleCase.case_neutral_citation = lib.getCitation(singleCase.CaseName);
            // probably unnecessary - just making new case_date field same as JudgmentDate:
            singleCase.case_date = singleCase.JudgmentDate;

            // get case fulltext tbc
            // something like child_process.exec('~./xpdf-tools-linux-4.00/bin64/pdftotext [PDF NAME]') but that will save to text file in same dir not save text to object

            console.log(singleCase);
        });
    });

});

