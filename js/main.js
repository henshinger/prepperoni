$("#recorded").hide();
$("#results-div").hide();
$("#see-results").hide();
var mediaSource = new MediaSource();
mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
var mediaRecorder;
var recordedBlobs;
var sourceBuffer;

var gumVideo = document.querySelector('video#gum');
var recordedVideo = document.querySelector('video#recorded');

var recordButton = document.querySelector('button#record');
// var playButton = document.querySelector('button#play');
var downloadButton = document.querySelector('button#downloads');
recordButton.onclick = toggleRecording;
// playButton.onclick = play;
downloadButton.onclick = download;


var final_transcript = '';
var recognizing = false;
var confidences = [];
var ignore_onend;
var start_timestamp;

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent

// var grammar = '#JSGF V1.0; grammar colors; public <color> = aqua | azure | beige | bisque | black | blue | brown | chocolate | coral | crimson | cyan | fuchsia | ghostwhite | gold | goldenrod | gray | green | indigo | ivory | khaki | lavender | lime | linen | magenta | maroon | moccasin | navy | olive | orange | orchid | peru | pink | plum | purple | red | salmon | sienna | silver | snow | tan | teal | thistle | tomato | turquoise | violet | white | yellow ;'
var recognition = new SpeechRecognition();
// var speechRecognitionList = new SpeechGrammarList();
// speechRecognitionList.addFromString(grammar, 1);
// recognition.grammars = speechRecognitionList;
recognition.continuous = true;
recognition.lang = 'en-US';
recognition.interimResults = true;
recognition.maxAlternatives = 1;

function randQuestion() {
  var arr = [
    "Tell me about yourself",
    "Why should we hire you?",
    "What is your greatest strength?",
    "What is your greatest weakness?",
    "Why do you want to work for us?",
    "Why did you leave your last job?",
    "What is your greatest accomplishment?",
    "What is your greatest failure?",
    "Describe a difficult work situation and how you overcomed it",
    "Where do you see yourself in five years?",
    "Do you any questions for me?"
  ];
  return arr[Math.floor(Math.random() * arr.length)];
}

$("#downloads").hide();


function getAvg(grades) {
 if (grades.length < 1) return 0;
 return grades.map((c, i, arr) => c * 100 / arr.length).reduce((p, c) => c + p);
}


// window.isSecureContext could be used for Chrome
// var isSecureOrigin = location.protocol === 'https:' ||
// location.host === 'localhost';
// if (!isSecureOrigin) {
//   alert('getUserMedia() must be run from a secure origin: HTTPS or localhost.' +
//     '\n\nChanging protocol to HTTPS');
//   location.protocol = 'HTTPS';
// }

// Use old-style gUM to avoid requirement to enable the
// Enable experimental Web Platform features flag in Chrome 49

var constraints = {
  audio: true,
  video: true
};

function handleSuccess(stream) {
  console.log('getUserMedia() got stream: ', stream);
  window.stream = stream;
  if (window.URL) {
    gumVideo.src = window.URL.createObjectURL(stream);
  } else {
    gumVideo.src = stream;
  }
}

function handleError(error) {
  console.log('navigator.getUserMedia error: ', error);
}

navigator.mediaDevices.getUserMedia(constraints).
    then(handleSuccess).catch(handleError);

function handleSourceOpen(event) {
  console.log('MediaSource opened');
  sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
  console.log('Source buffer: ', sourceBuffer);
}

recordedVideo.addEventListener('error', function(ev) {
  console.error('MediaRecording.recordedMedia.error()');
  alert('Your browser can not play\n\n' + recordedVideo.src
    + '\n\n media clip. event: ' + JSON.stringify(ev));
}, true);

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function handleStop(event) {
  console.log('Recorder stopped: ', event);
}

function toggleRecording() {
  if ((recordButton.textContent === 'Next Question') ||  (recordButton.textContent === 'Start')) {
    startRecording();
  } else {
    stopRecording();
    recordButton.textContent = 'Next Question';
    // playButton.disabled = false;
    downloadButton.disabled = false;
  }
}

// The nested try blocks will be simplified when Chrome 47 moves to Stable
function startRecording() {
  $("#recorded").hide();
  $("#gum").show();
  $("#question").text(randQuestion());

  recordedBlobs = [];
  var options = {mimeType: 'video/webm;codecs=vp9'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.log(options.mimeType + ' is not Supported');
    options = {mimeType: 'video/webm;codecs=vp8'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log(options.mimeType + ' is not Supported');
      options = {mimeType: 'video/webm'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log(options.mimeType + ' is not Supported');
        options = {mimeType: ''};
      }
    }
  }
  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder: ' + e);
    alert('Exception while creating MediaRecorder: '
      + e + '. mimeType: ' + options.mimeType);
    return;
  }
  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
  // playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(10); // collect 10ms of data
  console.log('MediaRecorder started', mediaRecorder);
  
  transcript = '';
  confidences = [];
  recognition.start();
}

function fillerCounter(sentence) {
  var arr = sentence.split(" "),
      obj = {},
      total = 0;
  obj["think"] = 0;
  obj["maybe"] = 0;
  obj["sorry"] = 0;
  obj["possibly"] = 0;
  obj["probably"] = 0;
  obj["basically"] = 0;
  arr.forEach(function(word){
    if (obj.hasOwnProperty(word)) {
      obj[word] += 1;
    } else {
      obj[word] = 1;
    }
    total += 1;
  });

  return Math.floor((obj["think"] + obj["maybe"] + obj["sorry"] + obj["possibly"] + obj["basically"] + obj["probably"]) * 100 / total);
}

function stopRecording() {
  mediaRecorder.stop();
  console.log('Recorded Blobs: ', recordedBlobs);
  recordedVideo.controls = true;
  
  recognition.stop();
  // recordButton.disabled = true;
  // recordButton.destroy();
  $("#clarity_score").text(Math.floor(getAvg(confidences)) + "%");
  $("#conf_score").text(fillerCounter(final_transcript) + "%")
  $("#transcript").text(final_transcript);
  $("#downloads").show();
  // $("#record").hide();
  $("#gum").hide();
  $("#recorder").show();
  $("#results-div").show();
  $("#see-results").show();
  play();

}

function play() {
  var superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
}

function download() {
  var blob = new Blob(recordedBlobs, {type: 'video/webm'});
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

recognition.onresult = function(event) {
  // The SpeechRecognitionEvent results property returns a SpeechRecognitionResultList object
  // The SpeechRecognitionResultList object contains SpeechRecognitionResult objects.
  // It has a getter so it can be accessed like an array
  // The first [0] returns the SpeechRecognitionResult at position 0.
  // Each SpeechRecognitionResult object contains SpeechRecognitionAlternative objects that contain individual results.
  // These also have getters so they can be accessed like arrays.
  // The second [0] returns the SpeechRecognitionAlternative at position 0.
  // We then return the transcript property of the SpeechRecognitionAlternative object 
  var interim_transcript = '';
  for (var i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) {
      final_transcript += event.results[i][0].transcript;
    } else {
      interim_transcript += event.results[i][0].transcript;
      confidences.push(event.results[i][0].confidence);

    }

  }  
  final_transcript = interim_transcript;
}




// recognition.onnomatch = function(event) {
//   diagnostic.textContent = 'I didnt recognise that color.';
// }

// recognition.onerror = function(event) {
//   diagnostic.textContent = 'Error occurred in recognition: ' + event.error;
// }