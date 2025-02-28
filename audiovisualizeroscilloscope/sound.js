import { hslToRgb } from "./utils.js";

// const WIDTH = 1500;
// const HEIGHT = 1500;
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const CENTERLINE = HEIGHT / 2;
const FFT_SIZE = 2 ** 7; // 10;
// canvas.width = WIDTH;
// canvas.height = HEIGHT;
let analyzer;
let bufferLength;
let context;

function handleError() {
  console.log("You must give access to your mic in order to proceed.");
}

window.audio.src = "http://localhost:8080/api/wWXnqZ4ieknmWq2wUWb8oP.mp3";

async function getAudio() {
  // const stream = await navigator.mediaDevices
  //   .getUserMedia({ audio: true })
  //   .catch(handleError);
  // const stream = new Audio(
  //   "http://localhost:8080/api/wWXnqZ4ieknmWq2wUWb8oP.mp3"
  // );
  // stream.load();
  // stream.play();

  const context = new AudioContext();
  analyzer = context.createAnalyser();
  // const source = audioCtx.createMediaStreamSource(stream.srcObject);
  const source = context.createMediaElementSource(window.audio);
  source.connect(analyzer);

  // How much data should we collect?
  analyzer.fftSize = FFT_SIZE;

  // pull the data off the audio
  // how many pieces of data are there?
  bufferLength = analyzer.frequencyBinCount;
  const timeData = new Uint8Array(bufferLength);
  const frequencyData = new Uint8Array(bufferLength);
  drawTimeData(timeData);
  drawFrequency(frequencyData);
}

// window.audio.addEventListener("loadeddata", async () => {
window.audio.addEventListener("play", async (e) => {
  // const context = new AudioContext();
  context = context || new AudioContext();
  analyzer = analyzer || context.createAnalyser();
  // const source = audioCtx.createMediaStreamSource(stream.srcObject);
  const source = context.createMediaElementSource(e.target);
  source.connect(analyzer);
  analyzer.connect(context.destination); // so the audio can still play

  // How much data should we collect?
  analyzer.fftSize = FFT_SIZE;

  // pull the data off the audio
  // how many pieces of data are there?
  bufferLength = analyzer.frequencyBinCount;
  const timeData = new Uint8Array(bufferLength);
  const frequencyData = new Uint8Array(bufferLength);
  drawTimeData(timeData);
  // drawFrequency(frequencyData);
});

function drawTimeData(timeData) {
  // inject the time data into the time data array
  analyzer.getByteTimeDomainData(timeData);
  // now that we have the data, let's turn it into something visual
  // 1. clear the canvas
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  // 2. set up some canvas drawing
  // ctx.lineWidth = 2; // 5;
  // ctx.strokeStyle = "#ff0000"; // "#ffc600";
  ctx.fillStyle = "#ff0000"; // "#ffc600";
  // ctx.beginPath();
  const sliceWidth = WIDTH / bufferLength;
  let x = 0;
  const m = CENTERLINE / 128;

  timeData.forEach((data, i) => {
    // height of visualized data
    // const y = (v * HEIGHT) / 2;
    const y = data * m; // data / 128 * CENTERLINE;

    // draw the line segments
    // if (i === 0) ctx.moveTo(x, y);
    // else ctx.lineTo(x, y);
    ctx.fillRect(x, y, sliceWidth, sliceWidth);

    x += sliceWidth;
  });

  // ctx.stroke();

  // call itself as soon as possible!
  requestAnimationFrame(() => drawTimeData(timeData));
}

function drawFrequency(frequencyData) {
  // get the frequency data into our frequencyData array
  analyzer.getByteFrequencyData(frequencyData);

  // 1. clear the canvas
  // ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // figure out the bar width
  const barWidth = 1; // (WIDTH / bufferLength) * 5.5;
  let x = 0;
  frequencyData.forEach((amount) => {
    // frequency data comes in from 0 - 255
    const percent = 0.5; // amount / 255; // 0 - 100%
    const [h, s, l] = [360 / (percent * 360) - 0.5, 0.8, 0.5];
    // const barHeight = (HEIGHT * percent) / 2;
    const barHeight = CENTERLINE * Math.pow(percent, 3);
    const barHeight2 = barHeight * 2;

    const [r, g, b] = hslToRgb(h, s, l); // convert the color to HSL
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    // ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
    // ctx.fillRect(x, CENTERLINE - barHeight, barWidth, barHeight);
    // ctx.fillRect(x, CENTERLINE + barHeight, barWidth, barHeight * -1);
    ctx.fillRect(x, CENTERLINE - barHeight, barWidth, barHeight2); //
    // ctx.fillRect(x, CENTERLINE - barHeight2, barWidth, barHeight2);
    x += barWidth;
  });

  requestAnimationFrame(() => drawFrequency(frequencyData));
}

// window.audio.addEventListener("loadeddata", () => getAudio());
// getAudio();
