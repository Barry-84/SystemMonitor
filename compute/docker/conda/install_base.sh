set -ex

export CONDA_PATH='/opt/conda'

cd /opt

wget https://repo.continuum.io/archive/Anaconda2-5.0.0-Linux-x86_64.sh -q -O /opt/web-terminal/compute/docker/conda/conda.sh
bash /opt/web-terminal/compute/docker/conda/conda.sh -b -p $CONDA_PATH
rm /opt/web-terminal/compute/docker/conda/conda.sh
