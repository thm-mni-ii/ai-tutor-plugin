FROM jupyter/base-notebook:python-3.11

USER root
# Install system dependencies
RUN apt-get update && \
    apt-get install -y curl build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Switch back to the notebook user
USER ${NB_UID}

# Upgrade Node.js using mamba (Jupyter's preferred package manager)
RUN mamba install -y -c conda-forge nodejs=22.* && \
    mamba clean --all -f -y

# Set the working directory
WORKDIR /home/jovyan/extension
