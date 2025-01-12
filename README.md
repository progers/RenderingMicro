# Rendering Micro Benchmark

A benchmark for html rendering engines which calculates repeatable, cross-browser breakdowns of rendering performance.

Latest version: https://renderingmicro.pr.gg

## Example: drop-down icon

We can use this tool to measure the cost of various approaches for drawing a chevron icon for a drop-downs.

### 1. SVG data url background-image
```
<style>
  .svg-image {
    width: 24px;
    height: 24px;
    background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"></path></svg>');
  }
</style>
<div class="svg-image"></div>
```
This approach turns out to be surprisingly expensive:
| Browser | Platform | Total (ms) | Parse (ms) | Style (ms) | Layout (ms) | Paint (ms)
| --- | --- | --- | --- | --- | --- | --- |
| Chrome | MacOS, M1 | 0.76 | 0.05 | 0.58 | 0.01 | 0.12
| Chrome | Android, Pixel 9 | 1.58 | 0.12 | 1.14 | 0.01 | 0.31
| Safari | MacOS, M1 | 1.08 | 0.05 | 0.20 | 0.03 | 0.80
| Firefox | MacOS, M1 | 0.71 | 0.10 | 0.21 | 0.03 | 0.38

### 2. Inline SVG
```
<style>
  .inline-svg {
    width: 24px;
    height: 24px;
  }
</style>
<svg class="inline-svg" viewBox="0 0 24 24">
  <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"></path>
</svg>
<div class="css-clip-path"></div>
```
This is just an inline version of the background-image approach, but is significantly faster:
| Browser | Platform | Total (ms) | Parse (ms) | Style (ms) | Layout (ms) | Paint (ms)
| --- | --- | --- | --- | --- | --- | --- |
| Chrome | MacOS, M1 | 0.18 | 0.06 | 0.04 | 0.03 | 0.06
| Chrome | Android, Pixel 9 | 0.42 | 0.14 | 0.11 | 0.07 | 0.09
| Safari | MacOS, M1 | 0.26 | 0.07 | 0.08 | 0.06 | 0.06
| Firefox | MacOS, M1 | 0.33 | 0.10 | 0.08 | 0.04 | 0.09


### 3. CSS clip-path
```
<style>
  .css-clip-path {
    clip-path: path('M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z');
    width: 24px;
    height: 24px;
    background-color: black;
  }
</style>
<div class="css-clip-path"></div>
```
This is fairly close to using inline SVG:
| Browser | Platform | Total (ms) | Parse (ms) | Style (ms) | Layout (ms) | Paint (ms)
| --- | --- | --- | --- | --- | --- | --- |
| Chrome | MacOS, M1 | 0.12 | 0.05 | 0.03 | 0.01 | 0.03
| Chrome | Android, Pixel 9 | 0.27 | 0.13 | 0.06 | 0.02 | 0.07
| Safari | MacOS, M1 | 0.20 | 0.05 | 0.07 | 0.03 | 0.05
| Firefox | MacOS, M1 | 0.30 | 0.10 | 0.07 | 0.03 | 0.10
