## Preparation

This module requires the libraries described below.
Use sudo if you need enough permission.
(e.g. Installing within SELinux environment.)

### Chromium

This module does NOT include chromium binary in NPM packages as default.
You must get Chromium executable bin and its path manually.
See `config/local.default.js` file's description about `puppet.executable`.

OR You can just install `npm install puppeteer` (NOT puppeteer-core),
and this module will find `puppeteer` automatically and uses its Chromium binary.


### for example...

In Ubuntu, you can install with `apt install -y chromium-browser`.
and default executable's path is `/snap/bin/chromium`.


### OS

#### Ubuntu

    apt install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
    apt install -y nodejs npm git
    npm update npm
    npm install -g n
    n lts
    exec $SHELL


#### AWS Linux

    yum install -y pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 ipa-gothic-fonts xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic xorg-x11-fonts-Type1 xorg-x11-fonts-misc
    amazon-linux-extras install epel
    yum install -y nodejs npm git
    npm update npm
    npm install -g n
    n lts
    exec $SHELL


## Installation

At first, create your project directory.
And then, enter in new project directory.

    mkdir ./myproject
    cd ./myproject


Init your npm project directory.

    npm init


In your `package.json`, add below parameter to `dependencies` section.
(add # hash to URL, if you want specific version.)

    "dependencies": {
      "colloquist": "https://github.com/tincanbox/colloquist.git"
    }


Then let's install all deps. (This will take a bit...)

    npm install


Then generate the workspace. Mandatory directory will be made within your cwd.

    npx colloquist create


Or if you have yourown burden directory, put it up.


Now let's run demo Story.
(You can find entry-point of this command at: burden/shelf/draft/sample/yahoo-news.js)

    npx colloquist run sample/yahoo-news


## Basic Structure

You will see burden directory like below. `burden` is portable environment.

    ▾ burden/
      ▾ config/
        ▾ stage/            # You can toggle env config files via ini.js (attr:stage)
          ▾ default/
              database.js
              debug.js
              mail.js
              puppet.js
              server.js
              spice.js
          ▸ devel/
          ▸ prod/
          local.js          # Local configuration file.
      ▾ shelf/              # Main working directory.
        ▸ draft/
        ▸ schema/
        ▸ server/
        ▸ story/
        ▸ template/
        ini.js




## CLI Options

You can call `colloquist` command as local-node-module with `npx colloquist`.

### create

Copies default `burden` directory to your current working directory.
You must call this command from your project-root directory.

    npx colloquist create

### run

Calls draft with its name and parameters.

    npx colloquist run <draft_name> <options>

* -p, --param

  You can supply arguments with `-p` option.

        npx colloquist run something -p foo=1 baz=2 bar=3

* --gui (<-> -h, --headless)

  You can run Puppeteer with GUI (headless:true is default.)

        npx colloquist run something --gui

* -s, --slomo,

  You can run Puppeteer with slo-motion(number-unit is `milli-seconds`.)


### tell

Calls a Story directly.

    npx colloquist tell <story_name> <options>


### server

    npx colloquist server <server_name> <options>

* -n,--name (default)

  Below example calls shelf/server/SampleServer.js

      npx colloquist server -n SampleServer

* -o, --option

  Supplies options to ```start()``` method.


### help

W.I.P.

### version

W.I.P.


## Docker

This module includes basic Dockerfile with minimum configurations.
As default, `npx colloquist server` will be CMDed by Docker.

### Server Development

#### Source Watcher (nodemon and chokidar)

This module uses `nodemon` as a source observer.
As default, whole `burden` directory is observed by this watcher.
If you want to use dev-mode docker, call dev.yml file like as below.

    docker-compose -f docker-compose.dev.yml run