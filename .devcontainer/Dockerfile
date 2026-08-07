FROM mcr.microsoft.com/devcontainers/typescript-node:latest

RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun

RUN curl -fsSL https://opencode.ai/install | bash && \
    mv /root/.opencode/bin/opencode /usr/local/bin/opencode && \
    chmod +x /usr/local/bin/opencode

RUN bun --version && opencode --version

RUN mkdir -p /home/node/.local/share/opencode /home/node/.local/state/opencode && \
    chown -R node:node /home/node/.local
