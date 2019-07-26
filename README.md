## Usage

Create your project directory.

    mkdir ./myproject
    cd ./myproject


Init your npm project directory.

    npm init

In your `package.json`, add below configuration.

    {
      "dependencies": {
        "colloquist":
          "git+https://npm.private.repo:F-ryyxfqu6vdjz3wkjWr@gitlab.com/limbs/colloquist.git"
      }
    }


Then let's install all deps. (This will take a bit...)

    npm install


Generate colloquist workspace. Mandatory directory will be made within your cwd.

    npx colloquist init


You will see burden directory like below.

    ▾ burden/
      ▾ config/
        ▸ env/
          core.js
          spice.js
      ▾ shelf/
        ▸ draft/
        ▸ template/mail/
          sample.js


Now let's run demo Story.

    npx colloquist run sample


