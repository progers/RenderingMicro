class Snippet {
  constructor(name, html) {
    this.name = name;
    this.html = html;
  }
}

class RawTimes {
  constructor(name) {
    this.name = name;
    this.parse = 0;
    this.style = 0;
    this.layout = 0;
    this.paint = 0;
  }
}

class TimeStats {
  constructor(name) {
    this.name = name;

    this.parseAvg = 0;
    this.styleAvg = 0;
    this.layoutAvg = 0;
    this.paintAvg = 0;
    this.totalAvg = 0;

    this.parseStdDev = 0;
    this.styleStdDev = 0;
    this.layoutStdDev = 0;
    this.paintStdDev = 0;
    this.totalStdDev = 0;
  }
}

// Benchmark each Snippet in `inputSnippets`, returning `TimeStats` for each.
async function benchmark(inputSnippets, container) {
  // Selected using tests/experiments/repeat_count.html.
  const repeatCount = 50;

  // Run additional "no-op" snippets to establish minimum times (see:
  // `subtractMinimumRawTimes`).
  const noopSnippet = new Snippet('__noop', '.');
  const inputSnippetsWithNoop = [noopSnippet, ...inputSnippets];

  const snippets = generateUnique(inputSnippetsWithNoop, repeatCount);
  shuffleArray(snippets); // Randomize the order.

  const rawTimes = [];
  for (const snippet of snippets)
    rawTimes.push(new RawTimes(snippet.name));

  const debugTimestamps = true;
  await benchmarkInternal(snippets, rawTimes, container, debugTimestamps);

  // Adjust `rawTimes` to subtract out the overhead of the benchmark.
  subtractMinimumRawTimes(rawTimes);

  // The test names were shuffled, so use the original order from inputSnippets.
  const orderedNames = inputSnippets.map(snippet => snippet.name);
  return getTimeStats(rawTimes, orderedNames);
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

    rawTimes[i].parse = startStyleTime - startParseTime;
    rawTimes[i].style = startLayoutTime - startStyleTime;
    rawTimes[i].layout = startPaintTime - startLayoutTime;
    rawTimes[i].paint = endPaintTime - startPaintTime;

    if (debugTimestamps) {
      performance.mark(`${snippets[i].name} - startParse`,
        {startTime: startParseTime});
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

// To remove the overhead of the benchmark itself, we run additional "no-op"
// snippets which will calculate minimum times, and then adjust the times by
// subtracting out these minimums.
function subtractMinimumRawTimes(rawTimes) {
  let minParse = Infinity;
  let minStyle = Infinity;
  let minLayout = Infinity;
  let minPaint = Infinity;
  for (const times of rawTimes) {
    minParse = Math.min(minParse, times.parse);
    minStyle = Math.min(minStyle, times.style);
    minLayout = Math.min(minLayout, times.layout);
    minPaint = Math.min(minPaint, times.paint);
  }
  for (const times of rawTimes) {
    times.parse -= minParse;
    times.style -= minStyle;
    times.layout -= minLayout;
    times.paint -= minPaint;
  }
}

// Return an array of `TimeStats` where each entry corresponds to stats from
// `orderedNames`.
function getTimeStats(rawTimes, orderedNames) {
  function totalTime(t) {
    return t.parse + t.style + t.layout + t.paint;
  }

  const sumByName = {};
  for (const times of rawTimes) {
    if (!sumByName[times.name]) {
      sumByName[times.name] = {
        count: 0,
        parse: 0,
        style: 0,
        layout: 0,
        paint: 0,
        total: 0
      };
    }
    sumByName[times.name].count++;
    sumByName[times.name].parse += times.parse;
    sumByName[times.name].style += times.style;
    sumByName[times.name].layout += times.layout;
    sumByName[times.name].paint += times.paint;
    sumByName[times.name].total += totalTime(times);
  }

  const snippetTimeStats = [];
  for (const name of orderedNames) {
    const timeStats = new TimeStats(name);
    const sum = sumByName[name];

    // Calculate averages.
    timeStats.parseAvg = sum.parse / sum.count;
    timeStats.styleAvg = sum.style / sum.count;
    timeStats.layoutAvg = sum.layout / sum.count;
    timeStats.paintAvg = sum.paint / sum.count;
    timeStats.totalAvg = sum.total / sum.count;

    // Calculate variances.
    let parseVariance = 0;
    let styleVariance = 0;
    let layoutVariance = 0;
    let paintVariance = 0;
    let totalVariance = 0;
    for (const times of rawTimes) {
      if (times.name === name) {
        parseVariance += Math.pow(times.parse - timeStats.parseAvg, 2);
        styleVariance += Math.pow(times.style - timeStats.styleAvg, 2);
        layoutVariance += Math.pow(times.layout - timeStats.layoutAvg, 2);
        paintVariance += Math.pow(times.paint - timeStats.paintAvg, 2);
        totalVariance += Math.pow(totalTime(times) - timeStats.totalAvg, 2);
      }
    }

    // Calculate standard deviations.
    timeStats.parseStdDev = Math.sqrt(parseVariance / sum.count);
    timeStats.styleStdDev = Math.sqrt(styleVariance / sum.count);
    timeStats.layoutStdDev = Math.sqrt(layoutVariance / sum.count);
    timeStats.paintStdDev = Math.sqrt(paintVariance / sum.count);
    timeStats.totalStdDev = Math.sqrt(totalVariance / sum.count);

    snippetTimeStats.push(timeStats);
  }
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
