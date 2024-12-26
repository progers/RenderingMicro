class Snippet {
  constructor(name, html) {
    this.name = name;
    this.html = html;
  }
}

class Times {
  constructor(name) {
    this.name = name;

    this.parseTime = 0;
    this.styleLayoutTime = 0;
    this.paintTime = 0;
  }
}

// Benchmark each Snippet in `inputSnippets`, returning Times for each.
export default async function benchmark(inputSnippets, benchmarkContainer) {
  const debugTimestamps = true;
  const repeatCount = 20;

  const snippets = generateUnique(inputSnippets, repeatCount);
  shuffleArray(snippets); // Randomize the order.

  const results = [];
  for (const snippet of snippets)
    results.push(new Times(snippet.name));

  // TODO: Ensure the rest of the DOM isn't affecting this.
  const benchDiv = document.createElement('div');
  benchmarkContainer.replaceChildren(benchDiv);

  // TODO: Add warmup.

  await benchmarkInternal(snippets, results, benchDiv);

  // The test names were shuffled, so use the original order from inputSnippets.
  const names = inputSnippets.map(snippet => snippet.name);
  return sumTimes(results, names);
}

async function benchmarkInternal(snippets, results, benchDiv) {
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

    results[i].parseTime = startStyleLayoutTime - startParseTime;
    results[i].styleLayoutTime = startPaintTime - startStyleLayoutTime;
    results[i].paintTime = endPaintTime - startPaintTime;

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

// Return an array of `Times` where each entry corresponds to a name from
// `orderedName`, and the sum of all times with the same name.
function sumTimes(times, orderedNames) {
  const sumByName = {};
  times.forEach(times => {
    if (!sumByName[times.name]) {
      sumByName[times.name] = {
        count: 0,
        parseTime: 0,
        styleLayoutTime: 0,
        paintTime: 0
      };
    }
    sumByName[times.name].count++;
    sumByName[times.name].parseTime += times.parseTime;
    sumByName[times.name].styleLayoutTime += times.styleLayoutTime;
    sumByName[times.name].paintTime += times.paintTime;
  });

  const outputTimes = [];
  orderedNames.forEach(name => {
    times = new Times(name);
    let sum = sumByName[name];
    times.parseTime = sum.parseTime / sum.count;
    times.styleLayoutTime = sum.styleLayoutTime / sum.count;
    times.paintTime = sum.paintTime / sum.count;
    outputTimes.push(times);
  });
  return outputTimes;
}

export {
  benchmark,
  Snippet,
  Times,
};
