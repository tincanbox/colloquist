## Usage

Create your project directory.

    mkdir ./myproject
    cd ./myproject


Init your npm project directory.

    npm init


In your `package.json`, add below configuration.

    "dependencies": {
      "colloquist":
        "git+https://@gitlab.com/nigratruo/colloquist.git"
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
              debug.js
              mail.js
              path.js
              puppet.js
              spice.js
          ▾ devel/
          ▾ prod/
          local.js
      ▾ shelf/
        ▾ draft/
            sample.js
        ▸ template/mail/
          sample.js

Now let's run demo Story.

    npx colloquist run sample


