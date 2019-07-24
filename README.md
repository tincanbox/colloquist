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
          "git+https://npm.private.repo:F-ryyxfqu6vdjz3wkjWr@gitlab.com/my-limb/colloquist.git#YOUR_LATEST_TAG"
      }
    }


Then let's install all deps. (This will take a bit...)

    npm install


If you want to use `colloquist` as CLI tool, you need to run below command.

    npm link
