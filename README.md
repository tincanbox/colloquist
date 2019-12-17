## Preparation

Use sudo if you need enough permission.

### Ubuntu

    apt install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
    apt install -y nodejs npm git
    npm update npm
    npm install -g n
    n lts
    exec $SHELL


### AWS Linux

    yum install -y pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 ipa-gothic-fonts xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic xorg-x11-fonts-Type1 xorg-x11-fonts-misc
    amazon-linux-extras install epel
    yum install -y nodejs npm git
    npm update npm
    npm install -g n
    n lts
    exec $SHELL


## Usage

Create your project directory.

    mkdir ./myproject
    cd ./myproject


Init your npm project directory.

    npm init


In your `package.json`, add below configuration.

    "dependencies": {
      "colloquist": "https://github.com/tincanbox/colloquist.git"
    }


Then let's install all deps. (This will take a bit...)

    npm install


Generate colloquist workspace. Mandatory directory will be made within your cwd.

    npx colloquist create


Or if you have yourown burden directory, put it up.

You will see burden directory like below. `burden` is portable colloquist environment.

    ▾ burden/
      ▾ config/
        ▾ stage/
          ▾ default/
              database.js
              debug.js
              mail.js
              puppet.js
              server.js
              spice.js
          ▸ devel/
          ▸ prod/
          local.js
      ▾ shelf/
        ▸ draft/
        ▸ schema/
        ▸ story/
        ▸ template/
        ini.js


Now let's run demo Story.

    npx colloquist run sample/basic


