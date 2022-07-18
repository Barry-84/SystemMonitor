set -ex

# download llvm’s server public key to verify package signature (needed for clang)
wget -O - https://apt.llvm.org/llvm-snapshot.gpg.key | apt-key add -
apt-add-repository "deb http://apt.llvm.org/xenial/ llvm-toolchain-xenial-6.0 main" -y
apt-add-repository ppa:ubuntu-toolchain-r/test -y
apt-get update -y
apt-get install -y --no-install-recommends gcc-7 g++-7 clang-6.0
rm -rf /var/lib/apt/lists/*

# reconfigure the system so that clang refers to clang-6
update-alternatives --install /usr/bin/clang++ clang++ /usr/bin/clang++-6.0 1000
update-alternatives --install /usr/bin/clang clang /usr/bin/clang-6.0 1000
update-alternatives --config clang
update-alternatives --config clang++
