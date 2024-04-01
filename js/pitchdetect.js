/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var fftSize = 4096;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var tempElem;
var volElem, freqElem;
var pitchElems;

window.onload = function() {
  audioContext = new AudioContext();
  MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));  // corresponds to a 5kHz signal
  tempElem = document.getElementById( "temperament" );
  pitchElems = document.getElementsByClassName( "pitch" );
  volElem = document.getElementById( "vol" );
  freqElem = document.getElementById( "freq" );
}

function startPitchDetect() {  
    // grab an audio context
    audioContext = new AudioContext();

    // Attempt to get audio input
    navigator.mediaDevices.getUserMedia(
    {
        "audio": {
            "mandatory": {
                "googEchoCancellation": "false",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "false",
                "googHighpassFilter": "false"
            },
            "optional": []
        },
    }).then((stream) => {
        // Create an AudioNode from the stream.
        mediaStreamSource = audioContext.createMediaStreamSource(stream);

      // Connect it to the destination.
      analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      mediaStreamSource.connect( analyser );
      updatePitch();
    }).catch((err) => {
        // always check for errors at the end.
        console.error(`${err.name}: ${err.message}`);
        alert('Stream generation failed.');
    });
}

var rafID = null;
var tracks = null;
var buf = new Float32Array( fftSize );
var temps = {
  "equal": [261.6, 277.2, 293.7, 311.1, 329.6, 349.2, 370.0, 392.0, 415.3, 440.0, 466.2, 493.9],
  "valotti": [262.4, 277.3, 293.9, 311.9, 329.3, 350.5, 369.7, 392.7, 415.9, 440.0, 467.9, 493.0]
}

function centsOffFromPitch( pitch, note ) {
  return Math.round( 1200 * Math.log( pitch / note )/Math.log(2) * 10 ) / 10;
}

function autoCorrelate( buf, sampleRate ) {
  // Implements the ACF2+ algorithm
  var SIZE = buf.length;
  var rms = 0;

  for (var i=0;i<SIZE;i++) {
    var val = buf[i];
    rms += val*val;
  }
  rms = Math.sqrt(rms/SIZE);

  var r1=0, r2=SIZE-1, thres=0.01;  // thres=0.2
  for (var i=0; i<SIZE/2; i++)
    if (Math.abs(buf[i])<thres) { r1=i; break; }
  for (var i=1; i<SIZE/2; i++)
    if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

  buf = buf.slice(r1,r2);
  SIZE = buf.length;

  var c = new Array(SIZE).fill(0);
  for (var i=0; i<SIZE; i++)
    for (var j=0; j<SIZE-i; j++)
      c[i] = c[i] + buf[j]*buf[j+i];

  var d=0; while (c[d]>c[d+1]) d++;
  var maxval=-1, maxpos=-1;
  for (var i=d; i<SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  var T0 = maxpos;

  var x1=c[T0-1], x2=c[T0], x3=c[T0+1];
  a = (x1 + x3 - 2*x2)/2;
  b = (x3 - x1)/2;
  if (a) T0 = T0 - b/(2*a);

  return [sampleRate/T0, rms];
}

function updatePitch( time ) {
  var notes = temps[tempElem.value]
  var cycles = new Array;
  analyser.getFloatTimeDomainData( buf );
  var ac = autoCorrelate( buf, audioContext.sampleRate );

  volElem.innerText = (ac[1]/0.01).toFixed(1);
   if (ac[1] < 0.01) {  // not enough signal
    freqElem.innerText = "--"
    for (var i=0;i<12;i++) {
      pitchElems[i].innerText = "--";
    }
   } else {
    freqElem.innerText = ac[0].toFixed(1);
    for (var i=0;i<12;i++) {
      var offset = centsOffFromPitch(+ac[0], +notes[i])
      pitchElems[i].innerText = (offset - 1200 * Math.floor( offset/1200 + 0.5 )).toFixed(1);
    }
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = window.webkitRequestAnimationFrame;
  rafID = window.requestAnimationFrame( updatePitch );
}
