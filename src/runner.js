class Snippet {
  constructor(name, html) {
    this.name = name;
    this.html = html;
  }
}

class RawTimes {
  constructor() {
    this.parseTime = 0;
    this.styleTime = 0;
    this.layoutTime = 0;
    this.paintTime = 0;
  }
}

class TimeStats {
  constructor(name) {
    this.name = name;

    this.parseTimeAvg = 0;
    this.styleTimeAvg = 0;
    this.layoutTimeAvg = 0;
    this.paintTimeAvg = 0;
    this.totalTimeAvg = 0;

    this.parseTimeStdDev = 0;
    this.styleTimeStdDev = 0;
    this.layoutTimeStdDev = 0;
    this.paintTimeStdDev = 0;
    this.totalTimeStdDev = 0;
  }
}

// Benchmark each Snippet in `inputSnippets`, returning `SnippetTimesAndStats`
// for each.
async function benchmark(inputSnippets, container) {
  // Selected using tests/experiments/repeat_count.html.
  const repeatCount = 50;

  // Run an additional "no-op" snippet to determine overhead.
  const noopSnippet = new Snippet('__noop', '.');
  const inputSnippetsWithNoop = [noopSnippet, ...inputSnippets];

  const snippets = generateUnique(inputSnippetsWithNoop, repeatCount);
  shuffleArray(snippets); // Randomize the order.

  const rawTimes = [];
  for (const snippet of snippets)
    rawTimes.push(new RawTimes());

  const debugTimestamps = true;
  await benchmarkInternal(snippets, rawTimes, container, debugTimestamps);

  // Adjust `rawTimes` to subtract out the overhead of the "no-op" snippets.
  subtractAverageNoopRawTimes(noopSnippet.name, snippets, rawTimes);

  // The test names were shuffled, so use the original order from inputSnippets.
  const names = inputSnippets.map(snippet => snippet.name);
  return getTimeStats(snippets, rawTimes, names);
}

async function benchmarkInternal(snippets, rawTimes, container, debugTimestamps = false, useCpuWarmer = true) {
  let startParseTime = 0;
  let startStyleTime = 0;
  let startLayoutTime = 0;
  let startPaintTime = 0;
  let endPaintTime = 0;

  // Wait for quiescence.
  await waitForTimeout(200);

  if (useCpuWarmer) {
    CpuWarmer.start();
    // Wait for warmup. This reduces lower initial-run performance, as seen on
    // tests/experiments/repeat_count.html.
    await waitForTimeout(250);
  }

  for (let i = 0; i < snippets.length; i++) {
    // Reset the test, and wait a full frame for this to render.
    container.innerHTML = '';
    await waitForFrame();
    await waitForTimeout();

    // Wait for the next frame to start, then start the real test.
    await waitForFrame();

    // Stop the warmer during the measurement phase so that warming tasks do not
    // slip in prior to the post-paint task.
    if (useCpuWarmer)
      CpuWarmer.stop();

    startParseTime = performance.now();
    container.innerHTML = snippets[i].html;
    startStyleTime = performance.now();
    container.checkVisibility(); // force style.
    startLayoutTime = performance.now();
    container.offsetWidth; // force layout.
    startPaintTime = performance.now();
    await waitForTimeout(); // Post a task to allow paint to run.
    endPaintTime = performance.now();

    rawTimes[i].parseTime = startStyleTime - startParseTime;
    rawTimes[i].styleTime = startLayoutTime - startStyleTime;
    rawTimes[i].layoutTime = startPaintTime - startLayoutTime;
    rawTimes[i].paintTime = endPaintTime - startPaintTime;

    if (debugTimestamps) {
      performance.mark(`${snippets[i].name} - startParse`, {startTime: startParseTime});
      performance.mark(`startStyle`, {startTime: startStyleTime});
      performance.mark(`startLayout`, {startTime: startLayoutTime});
      performance.mark(`startPaint`, {startTime: startPaintTime});
      performance.mark(`endPaint`, {startTime: endPaintTime});
    }

    if (useCpuWarmer)
      CpuWarmer.start();
  }
}

async function waitForFrame() {
  return new Promise(requestAnimationFrame);
}

async function waitForTimeout(t = 0) {
  return new Promise((resolve, reject) => setTimeout(resolve, t))
}

// Class for continuously running busy-loop tasks. Keeping the CPU out of idle
// states dramatically reduces both total time and variance (see:
// test/experiments/cpu_warming.html).
class CpuWarmer {
  static start() {
    if (!window.onmessage) {
      window.onmessage = CpuWarmer.doWork;
      CpuWarmer.doWork();
    }
  }

  static stop() {
    window.onmessage = null;
  }

  static doWork() {
    if (!window.onmessage) {
      return;
    }
    // Busy loop for 1ms.
    let end = performance.now() + 1;
    let sum = 0;
    while (performance.now() < end) {
      sum += Math.random();
    }
    // Post a task to run the next loop.
    window.postMessage(null, '*');
  }
}

// Return an array of |snippets| * |repeatCount| "unique" snippets, where a
// snippet is made unique by replacing all instances of the name in the html
// with a unique id. This ensures browsers cannot simply cache data between
// multiple runs. For example, Chrome will cache the parsed data url for svg
// images (background-image: url('data:image/svg+xml,<svg name=foo ... ')), and
// we can ensure this doesn't get cached by replacing `foo` with `foo_4_1432`.
function generateUnique(snippets, repeatCount) {
  let uniqueSnippets = [];

  // Use an incrementing int from local storage as part of the unique id, to
  // prevent caching when running tests multiple times without refreshing.
  let noCacheInt = parseInt(localStorage.getItem('noCacheInt') || 1004);
  localStorage.setItem('noCacheInt', ++noCacheInt);

  for (const snippet of snippets) {
    for (let i = 0; i < repeatCount; i++) {
      let uniqueName = `${snippet.name}_${i}_${noCacheInt}`;
      let uniqueHtml = snippet.html.replaceAll(snippet.name, uniqueName);
      uniqueSnippets.push(new Snippet(snippet.name, uniqueHtml));
    }
  }
  return uniqueSnippets;
}

// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function subtractAverageNoopRawTimes(noopSnippetName, snippets, rawTimes) {
  let noopCount = 0;
  let noopParseTime = 0;
  let noopStyleTime = 0;
  let noopLayoutTime = 0;
  let noopPaintTime = 0;
  for (let i = 0; i < snippets.length; i++) {
    if (snippets[i].name == noopSnippetName) {
      noopCount++;
      noopParseTime += rawTimes[i].parseTime;
      noopStyleTime += rawTimes[i].styleTime;
      noopLayoutTime += rawTimes[i].layoutTime;
      noopPaintTime += rawTimes[i].paintTime;
    }
  }
  for (let i = 0; i < snippets.length; i++) {
    rawTimes[i].parseTime -= noopParseTime / noopCount;
    rawTimes[i].styleTime -= noopStyleTime / noopCount;
    rawTimes[i].layoutTime -= noopLayoutTime / noopCount;
    rawTimes[i].paintTime -= noopPaintTime / noopCount;
  }
}

// Return an array of `TimeStats` where each entry corresponds to stats from
// `orderedNames`.
function getTimeStats(snippets, rawTimes, orderedNames) {
  function totalTime(t) {
    return t.parseTime + t.styleTime + t.layoutTime + t.paintTime;
  }

  const sumByName = {};
  for (let i = 0; i < snippets.length; i++) {
    let name = snippets[i].name;
    if (!sumByName[name]) {
      sumByName[name] = {
        count: 0,
        parseTime: 0,
        styleTime: 0,
        layoutTime: 0,
        paintTime: 0,
        totalTime: 0
      };
    }
    sumByName[name].count++;
    sumByName[name].parseTime += rawTimes[i].parseTime;
    sumByName[name].styleTime += rawTimes[i].styleTime;
    sumByName[name].layoutTime += rawTimes[i].layoutTime;
    sumByName[name].paintTime += rawTimes[i].paintTime;
    sumByName[name].totalTime += totalTime(rawTimes[i]);
  }

  const snippetTimeStats = [];
  orderedNames.forEach(name => {
    let timeStats = new TimeStats(name);
    let sum = sumByName[name];
    timeStats.parseTimeAvg = sum.parseTime / sum.count;
    timeStats.styleTimeAvg = sum.styleTime / sum.count;
    timeStats.layoutTimeAvg = sum.layoutTime / sum.count;
    timeStats.paintTimeAvg = sum.paintTime / sum.count;
    timeStats.totalTimeAvg = sum.totalTime / sum.count;

    // Calculate variances
    let parseTimeVariance = 0;
    let styleTimeVariance = 0;
    let layoutTimeVariance = 0;
    let paintTimeVariance = 0;
    let totalTimeVariance = 0;
    for (let i = 0; i < snippets.length; i++) {
      if (snippets[i].name === name) {
        parseTimeVariance += Math.pow(rawTimes[i].parseTime - timeStats.parseTimeAvg, 2);
        styleTimeVariance += Math.pow(rawTimes[i].styleTime - timeStats.styleTimeAvg, 2);
        layoutTimeVariance += Math.pow(rawTimes[i].layoutTime - timeStats.layoutTimeAvg, 2);
        paintTimeVariance += Math.pow(rawTimes[i].paintTime - timeStats.paintTimeAvg, 2);
        totalTimeVariance += Math.pow(totalTime(rawTimes[i]) - timeStats.totalTimeAvg, 2);
      }
    }

    // Calculate standard deviations
    timeStats.parseTimeStdDev = Math.sqrt(parseTimeVariance / sum.count);
    timeStats.styleTimeStdDev = Math.sqrt(styleTimeVariance / sum.count);
    timeStats.layoutTimeStdDev = Math.sqrt(layoutTimeVariance / sum.count);
    timeStats.paintTimeStdDev = Math.sqrt(paintTimeVariance / sum.count);
    timeStats.totalTimeStdDev = Math.sqrt(totalTimeVariance / sum.count);

    snippetTimeStats.push(timeStats);
  });
  return snippetTimeStats;
}

export {
  benchmark,
  Snippet,
  TimeStats,
};

export const TestInternals = {
  getTimeStats,
  benchmarkInternal,
  generateUnique,
  RawTimes,
};
