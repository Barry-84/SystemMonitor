# Terminal-IDE

Standalone Server + Client for remote machine introspection and development.

## How it works

The Terminal IDE server is composed of three different parts:
  - a node server (compute server)
  - a go proxy server (gocode/web-terminal-proxy)
  - a terminal instance manager (ptyserved)

### Node Server

The node server has a socket.io based "chatroom" used to synchronize state
between clients. It also features custom code for the terminal, files, and editor
plugins.

### Go Proxy

The go proxy is responsible for handling some things which would not be performant to handle
in the node server, for instance file uploading, executing child commands (the /exec route),
and rebooting of the node server itself (/reboot)

### ptyserved

ptyseved manages the terminal instances that appear in the ide. The node server interacts with
the ptyclient to create new terminals and shut them down - it is done this way so that the
node server going down does not kill terminals and their child processes.

### CL Folder

The CL folder contains various bits of runtime state for both ptyserved and the node server.

## To Install for Dev:

  - get docker community edition ^18
  - get node (at least v8) and npm (at least v5.6)
  - Ping #workspaces to request access to docker image on google cloud storage
  - install gcloud sdk
  - connect gcloud to docker with `gcloud auth configure-docker` [more info](https://cloud.google.com/sdk/gcloud/reference/auth/configure-docker)
  - from web-terminal run `./make-dockerfiles.sh` to generate `target/Dockerfile.*`
  - from web-terminal run `docker-compose up -d` to start the server

    NOTE: If you need to see the server log you may either leave off the `-d` or use `docker logs <container-id>`
    Get the containers ID from `docker ps`

    NOTE: To debug the node server, run `docker-compose --file docker-compose.dev.yml build && docker-compose --file docker-compose.dev.yml up -d`.
    Then in Chrome go to `chrome://inspect` and on that page,
    below `Remote Target` you should see
    `Target: compute/main.js file:///opt/web-terminal/compute/main.js inspect`.
    Click `inspect` to open a debugger window.

  - clone `web-terminal-client`, `npm install && npm start` to start the client development process
  - visit `http://localhost:5000` and you should see web-terminal
  - simply edit files in web-terminal-client and your changes will be reflected
  - changes to web-terminal will require `docker-compose build`

## Release

web-terminal is used in the several virtual machine images. 
Every time a commit is merged to master a build is triggered in [google cloud platform](https://console.cloud.google.com/gcr/builds?project=workspaces-162222).
However, it is not in production until we deploy the built disk to a pool of virtual machines.
