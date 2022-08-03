# Running automated smoke tests in Azure DevOps

## Setting up Azure DevOps agent for running smoke tests

1. [Create agent pools](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/pools-queues?view=azure-devops#creating-agent-pools) for running tests, for example `Smoke tests Windows` for Windows machines, `Smoke tests Linux` for Linux machines, `Smoke tests Mac` for Mac machines.
1. [Create PAT](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/v2-windows?view=azure-devops&viewFallbackFrom=azdevops#authenticate-with-a-personal-access-token-pat)

1. Open agent pool page, click **New agent**, and follow **Download the agent** instructions.
1. On **Configure the agent** stage choose the following setup for `config.sh` or `config.cmd`:
   * [**Windows**](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/v2-windows?view=azure-devops):

     * **Enter server URL**: `< Your Azure DevOps server url >`
     * **Enter authentication type (press enter for PAT)**: `< Press Enter >`
     * **Enter personal access token**: `< Insert PAT >`
     * **Enter agent pool (press enter for default)**: `< Specify agent pool name >`
     * **Enter agent name (press enter for vside-mbp)**: `< Specify agent name >`
     * **Enter run agent as service? (Y/N) (press enter for N)**: `< Press N >`
     * **Enter User account to use for the service**: `< Specify your account >`
     * **Enter Password for the account YOUR_ACCOUNT**: `< Enter password >`
     * **Enter work folder (press enter for _work)**: `< Press Enter >`

   * **[Mac](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/v2-osx?view=azure-devops)/[Linux](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/v2-linux?view=azure-devops)**:

     * **Enter server URL**: `< Your Azure DevOps server url >`
     * **Enter authentication type (press enter for PAT)**: `< Press Enter >`
     * **Enter personal access token**: `< Insert PAT >`
     * **Enter agent pool (press enter for default)**: `< Specify agent pool name >`
     * **Enter agent name (press enter for vside-mbp)**: `< Specify agent name >`
     * **Enter run agent as service? (Y/N) (press enter for N)**: `< Press N >`
     * **Enter work folder (press enter for _work)**: `< Press Enter >`

     Then run `./svc.sh install` and `./svc.sh start` subsequently on an agent machine.
     (**Mac** only) After that follow this [instructions](https://support.apple.com/en-us/HT201476) to enable autologin.

## Setting up agent machine for running tests
Follow [Running smoke tests locally](./run-locally.md) documentation page to set up Android and iOS environment for running tests.
