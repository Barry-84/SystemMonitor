#!/bin/bash

set -e
set -x

docker build . -t webterminal_compute --build-arg NPM_TOKEN=$NPM_TOKEN --build-arg GIT_AUTH=$GIT_AUTH
docker tag webterminal_compute:latest us.gcr.io/workspaces-162222/webterminal_compute:latest
gcloud docker -- push us.gcr.io/workspaces-162222/webterminal_compute:latest
