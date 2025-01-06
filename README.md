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
| Browser | Platform | Rendering time (ms) | Standard Deviation (ms) |
| --- | --- | --- | --- |
| Chrome | MacOS, M1 | 0.86 | 0.12
| Chrome | Android, Pixel 9 | 1.76 | 0.23
| Safari | MacOS, M1 | 1.16 | 0.16

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
| Browser | Platform | Rendering time (ms) | Standard Deviation (ms) |
| --- | --- | --- | --- |
| Chrome | MacOS, M1 | 0.26 | 0.18
| Chrome | Android, Pixel 9 | 0.51 | 0.14
| Safari | MacOS, M1 | 0.36 | 0.07


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
| Browser | Platform | Rendering time (ms) | Standard Deviation (ms) |
| --- | --- | --- | --- |
| Chrome | MacOS, M1 | 0.22 | 0.07
| Chrome | Android, Pixel 9 | 0.41 | 0.10
| Safari | MacOS, M1 | 0.31 | 0.08
