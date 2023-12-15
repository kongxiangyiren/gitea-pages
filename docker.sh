#!/bin/bash
WORK_PATH='./'
cd $WORK_PATH
echo '先清除老代码'
git reset --hard origin/master
git clean -f
echo '拉取新代码'
git pull origin master
# 检查容器是否存在
if docker ps -a | grep -q "gitea-pages"; then
    echo "容器 gitea-pages 存在，正在删除..."
    # 删除容器
    docker stop gitea-pages
    docker rm gitea-pages
    echo "容器 gitea-pages 已删除。"
else
    echo "容器 gitea-pages 不存在。"
fi
# 获取 gitea-pages-gitea-pages 镜像的 IMAGE ID
IMAGE_ID=$(docker images | grep gitea-pages-gitea-pages | awk '{print $3}')
if [ -n "$IMAGE_ID" ]; then
    echo "删除 gitea-pages-gitea-pages 镜像"
    docker rmi $IMAGE_ID
fi

docker-compose up -d
