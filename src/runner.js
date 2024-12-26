const debugTimestamps = true;

class Snippet {
  constructor(name, html) {
    this.name = name;
    this.html = html;
  }
}

class RawTimes {
  constructor() {
    this.parseTime = 0;
    this.styleLayoutTime = 0;
    this.paintTime = 0;
  }
}

class TimeStats {
  constructor(name) {
    this.name = name;

    this.parseTimeAvg = 0;
    this.styleLayoutTimeAvg = 0;
    this.paintTimeAvg = 0;
    this.totalTimeAvg = 0;

    this.parseTimeStdDev = 0;
    this.styleLayoutTimeStdDev = 0;
    this.paintTimeStdDev = 0;
    this.totalTimeStdDev = 0;
  }
}

// Benchmark each Snippet in `inputSnippets`, returning `SnippetTimesAndStats`
// for each.
export default async function benchmark(inputSnippets, benchmarkContainer) {
  const repeatCount = 20;

  const snippets = generateUnique(inputSnippets, repeatCount);
  shuffleArray(snippets); // Randomize the order.

  const rawTimes = [];
  for (const snippet of snippets)
    rawTimes.push(new RawTimes());

  // TODO: Ensure the rest of the DOM isn't affecting this.
  const benchDiv = document.createElement('div');
  benchmarkContainer.replaceChildren(benchDiv);

  // TODO: Add warmup.

  await benchmarkInternal(snippets, rawTimes, benchDiv);

  // The test names were shuffled, so use the original order from inputSnippets.
  const names = inputSnippets.map(snippet => snippet.name);
  return getTimeStats(snippets, rawTimes, names);
}

async function benchmarkInternal(snippets, rawTimes, benchDiv) {
  let startParseTime = 0;
  let startStyleLayoutTime = 0;
  let startPaintTime = 0;
  let endPaintTime = 0;

  // Wait for quiescence.
  await waitForTimeout(200);

  for (let i = snippets.length - 1; i >= 0; i--) {
    benchDiv.innerHTML = '';

    // Give gc a chance between repeats.
    await waitForTimeout(20);
    await waitForFrame();
    await waitForFrame();

    startParseTime = performance.now();
    benchDiv.innerHTML = snippets[i].html;
    startStyleLayoutTime = performance.now();
    benchDiv.offsetWidth; // force layout.
    startPaintTime = performance.now();
    await waitForTimeout();
    endPaintTime = performance.now();

    rawTimes[i].parseTime = startStyleLayoutTime - startParseTime;
    rawTimes[i].styleLayoutTime = startPaintTime - startStyleLayoutTime;
    rawTimes[i].paintTime = endPaintTime - startPaintTime;

    if (debugTimestamps) {
      performance.mark(`${snippets[i].name} - startParse`, {startTime: startParseTime});
      performance.mark(`startStyleLayout`, {startTime: startStyleLayoutTime});
      performance.mark(`startPaintTime`, {startTime: startPaintTime});
      performance.mark(`endPaintTime`, {startTime: endPaintTime});
    }
  }
}

async function waitForFrame() {
  return new Promise(requestAnimationFrame);
}

async function waitForTimeout(t = 0) {
  return new Promise((resolve, reject) => setTimeout(resolve, t))
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

// Return an array of `TimeStats` where each entry corresponds to stats from
// `orderedNames`.
function getTimeStats(snippets, rawTimes, orderedNames) {
  function totalTime(times) {
    return times.parseTime + times.styleLayoutTime + times.paintTime;
  }

  const sumByName = {};
  for (let i = 0; i < snippets.length; i++) {
    let name = snippets[i].name;
    if (!sumByName[name]) {
      sumByName[name] = {
        count: 0,
        parseTime: 0,
        styleLayoutTime: 0,
        paintTime: 0,
        totalTime: 0
      };
    }
    sumByName[name].count++;
    sumByName[name].parseTime += rawTimes[i].parseTime;
    sumByName[name].styleLayoutTime += rawTimes[i].styleLayoutTime;
    sumByName[name].paintTime += rawTimes[i].paintTime;
    sumByName[name].totalTime += totalTime(rawTimes[i]);
  }

  const snippetTimeStats = [];
  orderedNames.forEach(name => {
    let timeStats = new TimeStats(name);
    let sum = sumByName[name];
    timeStats.parseTimeAvg = sum.parseTime / sum.count;
    timeStats.styleLayoutTimeAvg = sum.styleLayoutTime / sum.count;
    timeStats.paintTimeAvg = sum.paintTime / sum.count;
    timeStats.totalTimeAvg = sum.totalTime / sum.count;

    // Calculate variances
    let parseTimeVariance = 0;
    let styleLayoutTimeVariance = 0;
    let paintTimeVariance = 0;
    let totalTimeVariance = 0;
    for (let i = 0; i < snippets.length; i++) {
      if (snippets[i].name === name) {
        parseTimeVariance += Math.pow(rawTimes[i].parseTime - timeStats.parseTimeAvg, 2);
        styleLayoutTimeVariance += Math.pow(rawTimes[i].styleLayoutTime - timeStats.styleLayoutTimeAvg, 2);
        paintTimeVariance += Math.pow(rawTimes[i].paintTime - timeStats.paintTimeAvg, 2);
        totalTimeVariance += Math.pow(totalTime(rawTimes[i]) - timeStats.totalTimeAvg, 2);
      }
    }

    // Calculate standard deviations
    timeStats.parseTimeStdDev = Math.sqrt(parseTimeVariance / snippets.length);
    timeStats.styleLayoutTimeStdDev = Math.sqrt(styleLayoutTimeVariance / snippets.length);
    timeStats.paintTimeStdDev = Math.sqrt(paintTimeVariance / snippets.length);
    timeStats.totalTimeStdDev = Math.sqrt(totalTimeVariance / snippets.length);

    snippetTimeStats.push(timeStats);
  });
  return snippetTimeStats;
}

export {
  benchmark,
  Snippet,
  TimeStats,
};
