# Gitland Timelapse
Repo to show an interactive timelapse of the gitland game: https://github.com/programical/gitland

## How to use
#You can either got to the github page (link once it actually works) to see the latest state I prepared, or make your own:

From master, run
```
npm install
node fetch.js
```

This will create a work dir, clone the gitland repo and process all the turns. This may take a while. It will then update the `docs` folder for the github page. You can serve the contents of that branch with any webserver to get the interactive version.

## How it works
TODO