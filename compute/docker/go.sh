set -ex

apt-get update -y
apt-get install -y --no-install-recommends g++ gcc libc6-dev make pkg-config
rm -rf /var/lib/apt/lists/*

export GOLANG_VERSION=1.7.3
export GOLANG_DOWNLOAD_URL="https://golang.org/dl/go$GOLANG_VERSION.linux-amd64.tar.gz"
export GOLANG_DOWNLOAD_SHA256="508028aac0654e993564b6e2014bf2d4a9751e3b286661b0b0040046cf18028e"

curl -fsSL "$GOLANG_DOWNLOAD_URL" -o golang.tar.gz \
	  && echo "$GOLANG_DOWNLOAD_SHA256 golang.tar.gz" | sha256sum -c - \
	  && tar -C /usr/local -xzf golang.tar.gz \
	  && rm golang.tar.gz

cp /usr/local/go/bin/go /usr/local/bin/go

which go
