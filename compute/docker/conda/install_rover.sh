set -ex

export CONDA_PATH='/opt/conda'

cd /opt

export PATH="$CONDA_PATH/bin:$PATH"
source $CONDA_PATH/bin/activate

conda env create -f /opt/web-terminal/compute/docker/conda/rover.yml
