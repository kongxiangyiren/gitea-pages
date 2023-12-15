# 打包
FROM node:alpine as build-stage
# 维护者信息
MAINTAINER kongxiangyiren
# 设置工作目录
WORKDIR /app
# 拷贝项目到app目录下
COPY ./ .

RUN yarn install

# 打包
RUN yarn build

# ======================== 上：打包  下：运行 ========================

# 设置基础镜像
FROM mhart/alpine-node:12
# 定义作者
MAINTAINER kongxiangyiren
# 设置工作目录
WORKDIR /app
# 复制依赖文件
COPY --from=build-stage /app/dist ./

RUN npm config set registry https://registry.npmmirror.com

# 安装依赖
RUN yarn install

# 设置环境
ENV DOCKER=true
# 暴露端口
EXPOSE 8360
# 运行项目
CMD [ "node", "/app/production.js" ]
