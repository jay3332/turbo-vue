<h1 align="center" id="turbovue">
  <img src="https://raw.githubusercontent.com/jay3332/turbo-vue/main/public/favicon.ico" align="center" width="100px">
  
  TurboVUE
</h1>
<p align="center">
  <sup>
    A fast, clean, and lightweight third-party alternative client to StudentVUE.    
    <br>
    <a href="https://turbovue.jay3332.tech"><b>Go to TurboVUE</b></a>
  </sup>
</p>

## Why a StudentVUE client?

The StudentVUE user experience is described by many as slow, clunky, and outdated.
TurboVUE aims to improve on the UI/UX of viewing your grades and assignments through a
clean, fast, and lightweight client.

## How it works with the "new" StudentVUE

TurboVUE was created after all other third-party StudentVUE clients stopped working
after major changes to the StudentVUE backend. This new backend is more 
restrictive: most data must be physically scraped via a proxy server to circumvent CORS,
and pages are dynamically loaded rather than being able to be fetched directly. As such,
TurboVUE makes use of a 
[simple proxy server](https://github.com/jay3332/turbo-vue/blob/main/proxy/main.py)
to fetch and serialize data from the StudentVUE backend.

## Features

- Fast, accessible, responsive, and modern design
- Much more streamlined view of grades and assignments
- "What If" grade calculator
  - Modify scores on any assignment, delete assignments, and add custom assignments
    to see how they would affect your grade
- Color-coded scores and assignment types
- Themes
- *more to come*