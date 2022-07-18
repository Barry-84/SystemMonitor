set -ex

apt-get update
echo "deb http://www.apache.org/dist/cassandra/debian 311x main" | sudo tee -a /etc/apt/sources.list.d/cassandra.sources.list
curl https://www.apache.org/dist/cassandra/KEYS | sudo apt-key add -
apt-key adv --keyserver pool.sks-keyservers.net --recv-key A278B781FE4B2BDA
apt-get update && apt-get install -y cassandra
