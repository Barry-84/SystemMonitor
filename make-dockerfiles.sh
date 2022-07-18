#!/bin/bash

mkdir -p target

sed -e "s=CPU_OR_GPU=cpu=g" Dockerfile.template > target/Dockerfile.cpu
sed -e "s=CPU_OR_GPU=gpu=g" Dockerfile.template > target/Dockerfile.gpu
