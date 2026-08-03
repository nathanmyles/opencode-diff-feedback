FROM mcr.microsoft.com/devcontainers/typescript-node:latest

RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun

RUN bun --version
