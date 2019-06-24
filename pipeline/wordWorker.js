/*****************************************
 * Watches a folder (and subfolder) for *.docx files
 * Processes a macro-enabled template that outputs 3 text files
 * Sends a message to the parent thread that the file is finished
 ****************************************/

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { exec, execSync } = require('child_process');
const terminate = require('terminate');
const adapterConfig = require("./adapterconfig.json");

const { isMainThread, parentPort, workerData } = require('worker_threads');

let queuedExec = [];
let runningExec = [];
let hasInitialised = false;

if (!isMainThread) {

	const { logDir } = workerData;

	const getFilesizeInBytes = filename => {
		const stats = fs.statSync(filename);
		if(!stats) {
			fs.writeFileSync(`${logDir}/error-filesize-${path.basename(filename)}.txt`, "");
			return 0;
		}
		return stats.size;
	};
	
	// Will either be called from itself, or from add
	const processQueue = () => {

		console.log(`[WORD] Queue: ${runningExec.length} running | ${queuedExec.length} queued`);
		
		if(runningExec.length <= adapterConfig.concurrent_word_processors && queuedExec.length > 0) {

			let queuedItem = queuedExec.shift();
			queuedItem.start = moment();
			
			runningExec.push(queuedItem);

			queuedItem.process = exec(queuedItem.execStr, (error, stdout, stderr) => {

				if(!queuedItem.isTerminated) {
				
					if(!error) {
						console.log('[WORD->CORE] Send case to be processed');
						parentPort.postMessage({
							cmd: 'PROCESS',
							data: {
								fileSize: queuedItem.fileSize,
								path: queuedItem.path
							}	
						});
						
						runningExec.splice(runningExec.findIndex(r => r.path === queuedItem.path), 1);
					}  else {
						delete queuedItem.process; // Too big for logging
						console.log('[WORD] Word Worker Queue Item Error');
						console.log(`item: ${JSON.stringify(queuedItem, null, 4)}`);
						console.log(`error: ${error}`);
						console.log(`stderr: ${stderr}`);
						console.log(`stdout: ${stdout}`);
					}

					processQueue();

				}

			});
		}

	};

	const getTempFileName = fileName => {
		return `~$${fileName.slice(2)}`;
	};

	const deleteWordResilienceKey = () => {
		// Remove Safe Mode prompt
		let keyExists = false;

		try {
			const q = execSync(`reg query HKCU\\Software\\Microsoft\\Office\\16.0\\Word`);
			keyExists = q.toString().includes("Word\\Resiliency");
		} catch(ex) { }

		if(keyExists) {
			try {
				execSync(`reg delete HKCU\\Software\\Microsoft\\Office\\16.0\\Word\\Resiliency /f`);
			} catch(ex) {

			}
		}
	};

	const checkQueueForBrokenProcesses = () => {

		let tableData = [];
		
		runningExec.forEach(runningItem => {

			const minutesTaken = moment().diff(runningItem.start, 'minutes');
			const fileName = path.basename(runningItem.path);

			tableData.push({
				fileName,
				fileSizeKB: runningItem.fileSize + '\t',
				minutesTaken: minutesTaken,
				PID: '\t' + runningItem.process.pid
			});

			if(minutesTaken > 5 && runningItem.fileSize < 50) {

				console.log(`\n[!] [WORD] ${runningItem.path} has taken over 5 minutes and is less than 50kb.\nProbably stuck. Logging, Killing process and requeuing.`);
				
				fs.writeFileSync(`${logDir}/error-5-${fileName}.txt`, JSON.stringify(runningItem));
				
				runningExec.splice(runningExec.findIndex(r => r.path === runningItem.path), 1);
				runningItem.isTerminated = true;
				
				// Remove Safe Mode prompt
				deleteWordResilienceKey();

				terminate(runningItem.process.pid, err => {
					
					if (err) {
						console.log("[WORD] Process termination failed: " + err);
					} else {

						console.log(`[WORD] Killed process: ${runningItem.process.pid}`);
						
						const newFolderName = 'retry-' + Math.ceil(Math.random() * 99999);
						const newFolder = path.join(path.dirname(runningItem.path), newFolderName);

						console.log(`[WORD] Retry folder: ${newFolder}`);

						fs.mkdir(newFolder, () => {

							const copyPath = path.join(newFolder, fileName);
							const templateName = copyPath.replace('.docx', '.dotm');
							const pdfName = copyPath.replace('.docx', '.pdf');
							const metaName = copyPath.replace('.docx', '.pdf.meta.json');

							//console.log(`Copying to:\n${copyPath}`);
							//console.log(`New template name:\n${templateName}`);

							Promise.all([
								fs.copy(runningItem.path.replace('.docx', '.dotm'), templateName),
								fs.copy(runningItem.path.replace('.docx', '.pdf'), pdfName),
								fs.copy(runningItem.path.replace('.docx', '.pdf.meta.json'), metaName),
								fs.copy(runningItem.path, copyPath)
							]).then(() => {

								const execStr = `"C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE" /z${templateName} /q`;

								//console.log(execStr);
								//console.log(copyPath);
								
								console.log(`[WORD] Requeued`);

								setTimeout(() => {

									queuedExec.push({
										execStr,
										templateName,
										fileSize: runningItem.fileSize,
										path: copyPath
									});

								}, 10000);

							});

						});

					}

				});

			}

		});

		tableData = tableData.filter(t => t.minutesTaken > 0);

		if(tableData.length > 0) {
			console.log('[WORD] Word processes > 1 min');
			tableData.sort((a,b) => b.minutesTaken - a.minutesTaken);
			console.log(toTable4(tableData));
		}

		// Run every 30 seconds
		setTimeout(checkQueueForBrokenProcesses, 30000);

	};

	// TODO: Move all filesize tests to pdfWorker
	const checkFileHasData = (docxFile, cb) => {
		var fileSize = getFilesizeInBytes(docxFile);
		if(fileSize > 0) {
			cb(fileSize);
		} else {
			console.log(`[WORD] Filesize is 0: ${docxFile}`);
			fs.writeFileSync(`${logDir}/error-zero-${path.basename(docxFile)}.txt`, docxFile);
			setTimeout(checkFileHasData.bind(null, docxFile, cb), 1000);
		}
	};

	parentPort.on('message', msg => {

		if(msg.cmd === "UPDATE_BATCH_QUEUE") {

			console.log("[WORD->CORE] New batch added");

			msg.data.newBatch.map(docxFile => {

				const templateName = docxFile.replace('.docx', '.dotm');

				return {
					path: docxFile,
					templateName,
					execStr: `"${adapterConfig.word_path}" /z${templateName} /q`,
				};
				
			})
			// Smallest to highest
			.sort((a, b) => a.fileSize - b.fileSize)
			.forEach(queueItem => {

				fs.copyFileSync(
					adapterConfig.word_dotm,
					queueItem.templateName
				);

				checkFileHasData(queueItem.path, fileSize => {

					queueItem.fileSize = fileSize / 1000;
					queuedExec.push(queueItem);

					// Will load up to 10
					processQueue();
				});

				

			});

			if(!hasInitialised) {
				console.log('[WORD] Set initialised');
				hasInitialised = true;
				// Wait for processes to start
				setTimeout(() => {
					parentPort.postMessage({
						cmd: 'INITIALISED',	
					});
				}, 10000);
			}


		}

	});

	checkQueueForBrokenProcesses();

}

// https://codereview.stackexchange.com/questions/157402/implementing-console-table-in-javascript

function toTable4(objectArray){
	//Extract keys
	const keys = Object.keys( objectArray[0] );
	//Build a list with keys and values  
	let list = [keys].concat( objectArray.map( o=>Object.values(o) ) );
	//For each key, get the maximum value or key length, add 1 to space out
	const lengths = keys.map( (key, index) => Math.max.apply(null, list.map( o => (o[index]+'').length ) ) + 1 );
	//Build a line of the right amount of '-'
	const line = '-'.repeat( lengths.reduce( (out,value)=>out+value , 0  ) + 1 );
	//Convert every object to an evenly spaced line with a lines separator
	list = list.map(  o => ' ' + o.map( ( value, index) => value + ' '.repeat( lengths[index] - value.length ) ).join('') + '\n' + line );
	//Return each line separated with a newline, prefixed with one more line
	return line + '\n' + list.join('\n');
  }